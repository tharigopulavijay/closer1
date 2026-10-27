import { phoneDigits, randomCode, randomToken, sha256 } from "./crypto";
import { fail, type Env } from "./env";
import { smsSender } from "./sms";

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_LIMIT = 3;
const OTP_ATTEMPTS = 5;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export async function requestOtp(env: Pick<Env, "DB" | "DEV_OTP">, phone: string, now = new Date()) {
  const digits = phoneDigits(phone);
  if (digits.length < 10) fail("bad phone", 400);
  const phoneHash = await sha256(digits);
  const since = new Date(now.getTime() - OTP_WINDOW_MS).toISOString();
  const recent = await env.DB.prepare(
    `select count(*) as n from otp_codes where phone_hash = ? and created_at > ?`,
  )
    .bind(phoneHash, since)
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= OTP_LIMIT) fail("rate limit", 429);

  const dev = env.DEV_OTP?.trim() ?? "";
  const code = dev || randomCode();
  const expires = new Date(now.getTime() + OTP_WINDOW_MS).toISOString();
  await env.DB.prepare(
    `insert into otp_codes (id, phone_hash, code_hash, expires_at, attempts, created_at)
     values (?, ?, ?, ?, 0, ?)`,
  )
    .bind(crypto.randomUUID(), phoneHash, await sha256(code), expires, now.toISOString())
    .run();
  if (!dev) await smsSender().send(digits, code);
  return { sent: !dev };
}

export async function verifyOtp(env: Pick<Env, "DB" | "DEV_OTP">, phone: string, code: string, now = new Date()) {
  const digits = phoneDigits(phone);
  if (digits.length < 10 || !code.trim()) fail("bad phone", 400);
  const phoneHash = await sha256(digits);
  const row = await env.DB.prepare(
    `select id, code_hash, expires_at, attempts from otp_codes
     where phone_hash = ? and expires_at > ?
     order by created_at desc limit 1`,
  )
    .bind(phoneHash, now.toISOString())
    .first<{ id: string; code_hash: string; expires_at: string; attempts: number }>();
  if (!row) fail("expired code", 401);
  if (Number(row.attempts) >= OTP_ATTEMPTS) fail("too many attempts", 401);
  const codeHash = await sha256(code.trim());
  if (codeHash !== row.code_hash) {
    await env.DB.prepare(`update otp_codes set attempts = attempts + 1 where id = ?`).bind(row.id).run();
    fail("wrong code", 401);
  }
  await env.DB.prepare(`delete from otp_codes where phone_hash = ?`).bind(phoneHash).run();
  const userId = await ensureUser(env.DB, phoneHash, now);
  const token = randomToken();
  const expires = new Date(now.getTime() + SESSION_MS).toISOString();
  await env.DB.prepare(
    `insert into sessions (id, token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), await sha256(token), userId, expires, now.toISOString())
    .run();
  return { token, userId, expiresAt: expires };
}

export async function userIdForToken(db: D1Database, header: string | undefined, now = new Date()) {
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const row = await db
    .prepare(`select user_id, expires_at from sessions where token_hash = ?`)
    .bind(await sha256(token))
    .first<{ user_id: string; expires_at: string }>();
  if (!row) return null;
  if (row.expires_at <= now.toISOString()) {
    await db.prepare(`delete from sessions where token_hash = ?`).bind(await sha256(token)).run();
    return null;
  }
  return row.user_id;
}

export async function logout(db: D1Database, header: string | undefined) {
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token) fail("auth required", 401);
  await db.prepare(`delete from sessions where token_hash = ?`).bind(await sha256(token)).run();
}

async function ensureUser(db: D1Database, phoneHash: string, now: Date) {
  const existing = await db
    .prepare(`select id from users where phone_hash = ?`)
    .bind(phoneHash)
    .first<{ id: string }>();
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const at = now.toISOString();
  await db.batch([
    db.prepare(`insert into users (id, phone_hash, created_at) values (?, ?, ?)`).bind(id, phoneHash, at),
    db.prepare(
      `insert into profiles (id, phone_hash, verified, hide_from_contacts, created_at) values (?, ?, 0, 1, ?)`,
    ).bind(id, phoneHash, at),
  ]);
  return id;
}
