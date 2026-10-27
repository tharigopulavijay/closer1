import { fail, type Env } from "./env";
import { dropDate } from "./time";

export type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const RECORD_SIZE = 4096;
/** Chrome/Android, Firefox, Safari/iOS and Edge push services. */
const PUSH_HOST = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/i;
const PUSH_LIMIT = 5;

/** The service says this phone is gone for good. */
class GoneSubscription extends Error {}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToB64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function b64urlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function uint32be(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value);
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8);
  return new Uint8Array(bits);
}

async function vapidJwt(audience: string, publicKey: string, privateKey: string, now: Date) {
  const pub = b64urlToBytes(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) fail("not configured", 500);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: privateKey },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  // The contact mailbox is the VAPID subject. TODO: point this at the real support inbox if it changes.
  const payload = bytesToB64url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
        sub: "mailto:support@closer.example",
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${bytesToB64url(signature)}`;
}

/** aes128gcm as used by Web Push (RFC 8291). The private VAPID key never enters this body. */
async function encryptPayload(p256dh: string, auth: string, plaintext: string) {
  const clientPublic = b64urlToBytes(p256dh);
  const clientAuth = b64urlToBytes(auth);
  // workers-types widens generateKey to a single key and names the ECDH field `$public`; the runtime follows WebCrypto.
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const remote = await crypto.subtle.importKey("raw", clientPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = { name: "ECDH", public: remote } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, local.privateKey, 256));
  const localPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(
    clientAuth,
    shared,
    concat([new TextEncoder().encode("WebPush: info\0"), clientPublic, localPublic]),
    32,
  );
  const contentKey = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const record = concat([new TextEncoder().encode(plaintext), new Uint8Array([2])]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));
  return concat([salt, uint32be(RECORD_SIZE), new Uint8Array([localPublic.length]), localPublic, ciphertext]);
}

async function assertMember(db: D1Database, userId: string) {
  const banned = await db.prepare(`select 1 as n from bans where user_id = ?`).bind(userId).first();
  if (banned) fail("banned");
  const profile = await db.prepare(`select deleted_at from profiles where id = ?`).bind(userId).first<{ deleted_at: string | null }>();
  if (!profile || profile.deleted_at) fail("auth required", 401);
}

export async function pushStatus(db: D1Database, userId: string, publicKey: string | undefined) {
  await assertMember(db, userId);
  const row = await db
    .prepare(`select count(*) as n from push_subscriptions where user_id = ? and opted_in = 1`)
    .bind(userId)
    .first<{ n: number }>();
  return { optedIn: Number(row?.n ?? 0) > 0, publicKey: publicKey?.trim() || null };
}

export async function subscribePush(
  db: D1Database,
  userId: string,
  input: { endpoint?: string; p256dh?: string; auth?: string },
  now = new Date(),
) {
  await assertMember(db, userId);
  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint ?? "");
  } catch {
    fail("bad subscription", 400);
  }
  // The cron POSTs to every saved endpoint, so only real browser push services are accepted.
  if (endpoint.protocol !== "https:" || !PUSH_HOST.test(endpoint.hostname)) fail("bad subscription", 400);
  const p256dh = input.p256dh?.trim() ?? "";
  const auth = input.auth?.trim() ?? "";
  if (!p256dh || !auth) fail("bad subscription", 400);
  const mine = await db
    .prepare(`select count(*) as n from push_subscriptions where user_id = ? and endpoint != ?`)
    .bind(userId, endpoint.toString())
    .first<{ n: number }>();
  if (Number(mine?.n ?? 0) >= PUSH_LIMIT) fail("too many devices", 400);
  await db
    .prepare(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, opted_in, created_at)
       values (?, ?, ?, ?, 1, ?)
       on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, opted_in = 1`,
    )
    .bind(userId, endpoint.toString(), p256dh, auth, now.toISOString())
    .run();
  return { optedIn: true };
}

export async function unsubscribePush(db: D1Database, userId: string) {
  await assertMember(db, userId);
  await db.prepare(`delete from push_subscriptions where user_id = ?`).bind(userId).run();
  return { optedIn: false };
}

async function deliverPush(env: Env, row: PushSubscriptionRow, body: string) {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) fail("not configured", 500);
  const endpoint = new URL(row.endpoint);
  const jwt = await vapidJwt(endpoint.origin, publicKey, privateKey, new Date());
  const encrypted = await encryptPayload(row.p256dh, row.auth, body);
  const response = await fetch(row.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${jwt}, k=${publicKey}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
    },
    body: encrypted,
  });
  if (response.status === 404 || response.status === 410) throw new GoneSubscription();
  if (!response.ok) fail("could not send reminder", 502);
}

/**
 * The 21:00 IST cron, five minutes after the Drop is built. Only members who opted in
 * and actually have picks in tonight's Drop are told it is open.
 */
export async function sendDropReminders(
  env: Env,
  deliver: (env: Env, row: PushSubscriptionRow, body: string) => Promise<void> = deliverPush,
  now = new Date(),
) {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) return { sent: [] as string[] };
  const rows = await env.DB.prepare(
    `select s.user_id, s.endpoint, s.p256dh, s.auth
     from push_subscriptions s
     join profiles p on p.id = s.user_id
     where s.opted_in = 1 and p.deleted_at is null
       and not exists (select 1 from bans b where b.user_id = s.user_id)
       and exists (select 1 from drops d join drop_picks k on k.drop_id = d.id where d.user_id = s.user_id and d.drop_date = ?)`,
  )
    .bind(dropDate(now))
    .all<PushSubscriptionRow>();
  const sent: string[] = [];
  for (const row of rows.results) {
    try {
      await deliver(env, row, JSON.stringify({ title: "The Drop is open", body: "Three people are waiting. Have a look before midnight." }));
      sent.push(row.user_id);
    } catch (error) {
      // A phone the service has forgotten is removed; any other failure must not stop the rest of the list.
      if (error instanceof GoneSubscription) {
        await env.DB.prepare(`delete from push_subscriptions where user_id = ? and endpoint = ?`).bind(row.user_id, row.endpoint).run();
      }
    }
  }
  return { sent };
}
