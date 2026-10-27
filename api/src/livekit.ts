import { fail } from "./env";

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export async function signLivekitToken(apiKey: string, apiSecret: string, identity: string, room: string, now = new Date()) {
  const issued = Math.floor(now.getTime() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: apiKey,
        sub: identity,
        iat: issued,
        nbf: issued,
        exp: issued + 60 * 60,
        video: { roomJoin: true, room, canPublish: true, canSubscribe: true },
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64url(signature)}`;
}

export async function issueRoomToken(db: D1Database, apiKey: string | undefined, apiSecret: string | undefined, userId: string, room: string) {
  const key = apiKey?.trim() ?? "";
  const secret = apiSecret?.trim() ?? "";
  if (!key || !secret) fail("not configured", 500);
  if (!room.trim()) fail("bad room", 400);
  const banned = await db.prepare(`select 1 as n from bans where user_id = ?`).bind(userId).first();
  if (banned) fail("banned");
  const profile = await db.prepare(`select verified from profiles where id = ?`).bind(userId).first<{ verified: number }>();
  if (!profile?.verified) fail("verified only");
  return signLivekitToken(key, secret, userId, room.trim());
}
