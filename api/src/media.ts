import { fail } from "./env";
import { canView } from "./policy";

const PHOTO_BYTES = 5 * 1024 * 1024;
const VOICE_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VOICE_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"]);

export async function storeMedia(db: D1Database, bucket: R2Bucket, userId: string, form: FormData) {
  const kind = String(form.get("kind") ?? "");
  const uploaded = form.get("file") as { type?: string; size?: number; name?: string; arrayBuffer?: () => Promise<ArrayBuffer> } | string | null;
  if (!uploaded || typeof uploaded === "string" || typeof uploaded.arrayBuffer !== "function") fail("bad upload", 400);
  const file = uploaded as { type: string; size: number; name: string; arrayBuffer: () => Promise<ArrayBuffer> };
  if (kind === "photo" || kind === "selfie") {
    if (!PHOTO_TYPES.has(file.type)) fail("bad type", 400);
    if (file.size > PHOTO_BYTES) fail("too large", 400);
  } else if (kind === "voice") {
    if (!VOICE_TYPES.has(file.type)) fail("bad type", 400);
    if (file.size > VOICE_BYTES) fail("too large", 400);
    const seconds = Number(form.get("seconds"));
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) fail("too long", 400);
  } else {
    fail("bad kind", 400);
  }
  const key = crypto.randomUUID();
  const bucketId = kind === "photo" ? "photos" : kind === "selfie" ? "selfies" : "voice";
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await db
    .prepare(`insert into media_objects (id, bucket_id, name, owner_id, bytes, kind) values (?, ?, ?, ?, ?, ?)`)
    .bind(key, bucketId, file.name || kind, userId, file.size, kind)
    .run();
  return { key, kind };
}

async function opsReviewing(db: D1Database, viewerId: string, ownerId: string) {
  const row = await db
    .prepare(
      `select 1 as n from staff_roles s
       join profiles p on p.id = ?
       where s.user_id = ? and s.role = 'ops' and p.verified = 0 and p.deleted_at is null
         and not exists (select 1 from bans b where b.user_id = s.user_id)`,
    )
    .bind(ownerId, viewerId)
    .first();
  return Boolean(row);
}

export async function readMedia(db: D1Database, bucket: R2Bucket, viewerId: string, key: string) {
  const row = await db
    .prepare(`select owner_id, kind from media_objects where id = ?`)
    .bind(key)
    .first<{ owner_id: string; kind: string }>();
  if (!row) fail("not visible", 404);
  const own = viewerId === row.owner_id;
  // Ops sees an unverified member's selfie and photos to compare them; every selfie view is logged.
  const reviewing = !own && (await opsReviewing(db, viewerId, row.owner_id));
  if (row.kind === "selfie") {
    if (!own && !reviewing) fail("not visible", 404);
    if (reviewing) {
      await db
        .prepare(`insert into audit_log (id, actor, role, action, detail, created_at) values (?, ?, 'ops', 'view_selfie', ?, ?)`)
        .bind(crypto.randomUUID(), viewerId, row.owner_id, new Date().toISOString())
        .run();
    }
  } else if (!own && !reviewing && !(await canView(db, viewerId, row.owner_id))) {
    fail("not visible", 404);
  }
  const object = await bucket.get(key);
  if (!object) fail("not visible", 404);
  const headers = new Headers();
  if (object.httpMetadata?.contentType) headers.set("content-type", object.httpMetadata.contentType);
  headers.set("cache-control", "private, max-age=0");
  // The stored type comes from the uploader; never let a browser guess another one.
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
