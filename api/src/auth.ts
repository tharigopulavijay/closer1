import { phoneDigits, randomCode, randomToken, sha256 } from "./crypto";
import { fail, type Env } from "./env";
import { smsSender } from "./sms";

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_LIMIT = 3;
const OTP_ATTEMPTS = 5;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** A fixed login code would open every account, so it only works outside production. */
function devCode(env: Pick<Env, "DEV_OTP" | "ENVIRONMENT">) {
  if (env.ENVIRONMENT !== "development" && env.ENVIRONMENT !== "test") return "";
  return env.DEV_OTP?.trim() ?? "";
}

type OtpEnv = Pick<Env, "DB" | "DEV_OTP" | "ENVIRONMENT" | "MSG91_KEY" | "MSG91_TEMPLATE_ID">;

function msg91Configured(env: OtpEnv) {
  return Boolean(env.MSG91_KEY?.trim() || env.MSG91_TEMPLATE_ID?.trim());
}

/** MSG91 wants a country code. A 10-digit Indian mobile is prefixed; longer numbers are already international. */
function msg91Mobile(digits: string) {
  return digits.length === 10 ? `91${digits}` : digits;
}

async function sendMsg91(env: OtpEnv, digits: string, code: string) {
  const key = env.MSG91_KEY?.trim() ?? "";
  const template = env.MSG91_TEMPLATE_ID?.trim() ?? "";
  if (!key || !template) fail("could not send code", 502);
  let response: Response;
  try {
    response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: { authkey: key, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ template_id: template, mobile: msg91Mobile(digits), otp: code }),
    });
  } catch {
    fail("could not send code", 502);
  }
  // The provider may echo the code. Read it only to drain the body, and never log or return it.
  await response.text();
  if (!response.ok) fail("could not send code", 502);
}

export async function requestOtp(env: OtpEnv, phone: string, now = new Date()) {
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

  const dev = devCode(env);
  const code = dev || randomCode();
  // In production a code that cannot be texted is useless, so refuse rather than pretend it was sent.
  if (env.ENVIRONMENT === "production" && !msg91Configured(env)) fail("could not send code", 502);
  const productionSms = env.ENVIRONMENT === "production" && !dev && msg91Configured(env);
  // Send before the row exists, so a failed text does not leave a code that can be guessed.
  if (productionSms) await sendMsg91(env, digits, code);
  const expires = new Date(now.getTime() + OTP_WINDOW_MS).toISOString();
  await env.DB.prepare(
    `insert into otp_codes (id, phone_hash, code_hash, expires_at, attempts, created_at)
     values (?, ?, ?, ?, 0, ?)`,
  )
    .bind(crypto.randomUUID(), phoneHash, await sha256(code), expires, now.toISOString())
    .run();
  if (!dev && !productionSms) await smsSender().send(digits, code);
  return { sent: !dev };
}

export async function verifyOtp(env: Pick<Env, "DB" | "DEV_OTP" | "ENVIRONMENT">, phone: string, code: string, now = new Date()) {
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
  if (existing) {
    // A deleted account that signs in again starts a fresh profile; a banned one stays banned.
    await db
      .prepare(`update profiles set deleted_at = null, verified = 0, phone_hash = ? where id = ? and deleted_at is not null`)
      .bind(phoneHash, existing.id)
      .run();
    return existing.id;
  }
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
