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
  if (kind === "photo") {
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
  const bucketId = kind === "photo" ? "photos" : "voice";
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await db
    .prepare(`insert into media_objects (id, bucket_id, name, owner_id, bytes, kind) values (?, ?, ?, ?, ?, ?)`)
    .bind(key, bucketId, file.name || kind, userId, file.size, kind)
    .run();
  return { key, kind };
}

export async function readMedia(db: D1Database, bucket: R2Bucket, viewerId: string, key: string) {
  const row = await db
    .prepare(`select owner_id from media_objects where id = ?`)
    .bind(key)
    .first<{ owner_id: string }>();
  if (!row || !(await canView(db, viewerId, row.owner_id))) fail("not visible", 404);
  const object = await bucket.get(key);
  if (!object) fail("not visible", 404);
  const headers = new Headers();
  if (object.httpMetadata?.contentType) headers.set("content-type", object.httpMetadata.contentType);
  headers.set("cache-control", "private, max-age=0");
  // The stored type comes from the uploader; never let a browser guess another one.
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
