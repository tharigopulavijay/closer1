import { env, SELF } from "cloudflare:test";
import schema from "../migrations/0001_schema.sql?raw";
import { sha256 } from "../src/crypto";

export const A = "11111111-1111-4111-8111-111111111111";
export const B = "22222222-2222-4222-8222-222222222222";
export const C = "33333333-3333-4333-8333-333333333333";
export const S = "44444444-4444-4444-8444-444444444444";
export const U = "55555555-5555-4555-8555-555555555555";
export const T = "66666666-6666-4666-8666-666666666666";
export const V = "77777777-7777-4777-8777-777777777777";
export const O1 = "88888888-8888-4888-8888-888888888881";
export const O2 = "88888888-8888-4888-8888-888888888882";
export const O3 = "88888888-8888-4888-8888-888888888883";

const USERS: [string, string, number][] = [
  [A, "hash-a", 1],
  [B, "hash-b", 1],
  [C, "hash-c", 1],
  [S, "hash-s", 1],
  [U, "hash-u", 0],
  [T, "hash-t", 1],
  [V, "hash-v", 1],
  [O1, "hash-o1", 1],
  [O2, "hash-o2", 1],
  [O3, "hash-o3", 1],
];

function statements(sql: string) {
  const text = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const token of text.split(/(\bBEGIN\b|\bEND\b|;)/i)) {
    if (/^begin$/i.test(token)) {
      depth += 1;
      current += token;
    } else if (/^end$/i.test(token)) {
      depth = Math.max(0, depth - 1);
      current += token;
    } else if (token === ";" && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += token;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function exec(sql: string) {
  for (const statement of statements(sql)) await env.DB.exec(statement.replace(/\s+/g, " "));
}

export async function reset() {
  await exec(schema);
  await exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM media_objects;
    DELETE FROM messages;
    DELETE FROM deposits;
    DELETE FROM debriefs;
    DELETE FROM safety_sessions;
    DELETE FROM sos_events;
    DELETE FROM plans;
    DELETE FROM likes;
    DELETE FROM matches;
    DELETE FROM drop_picks;
    DELETE FROM drops;
    DELETE FROM gift_claims;
    DELETE FROM strikes;
    DELETE FROM bans;
    DELETE FROM reports;
    DELETE FROM audit_log;
    DELETE FROM streaks;
    DELETE FROM blocks;
    DELETE FROM contact_hashes;
    DELETE FROM contact_allowlist;
    DELETE FROM trusted_contacts;
    DELETE FROM away_status;
    DELETE FROM social_connections;
    DELETE FROM profile_photos;
    DELETE FROM voice_answers;
    DELETE FROM preferences;
    DELETE FROM sessions;
    DELETE FROM otp_codes;
    DELETE FROM staff_roles;
    DELETE FROM profiles;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);
  const now = new Date().toISOString();
  for (const [id, phone, verified] of USERS) {
    await env.DB.batch([
      env.DB.prepare(`insert into users (id, phone_hash, created_at) values (?, ?, ?)`).bind(id, phone, now),
      env.DB.prepare(
        `insert into profiles (id, display_name, dob, phone_hash, verified, hide_from_contacts, created_at)
         values (?, ?, '1995-01-01', ?, ?, 0, ?)`,
      ).bind(id, id.slice(0, 8), phone, verified, now),
    ]);
  }
  await env.DB.prepare(`insert into bans (user_id, reason, created_at) values (?, 'seed', ?)`).bind(C, now).run();
  await env.DB.prepare(`insert into staff_roles (user_id, role) values (?, 'safety')`).bind(S).run();
}

export async function login(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.DB.prepare(
    `insert into sessions (id, token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), await sha256(token), userId, "2099-01-01T00:00:00.000Z", new Date().toISOString())
    .run();
  return token;
}

export async function api(
  path: string,
  init: { method?: string; token?: string; body?: unknown; service?: boolean } = {},
) {
  const headers = new Headers();
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.service) headers.set("x-closer-service", "service-test");
  const res = await SELF.fetch(`http://closer.test${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: res.status, text, json };
}

export async function count(sql: string, ...params: unknown[]) {
  const row = await env.DB.prepare(sql).bind(...params).first<{ n: number }>();
  return Number(row?.n ?? 0);
}
