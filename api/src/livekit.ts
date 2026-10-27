import { fail } from "./env";

const SPEAKER_CAP = 8;
const CHAI_CAP = 2;

function base64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function guestLabel() {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const n = 1000 + (((bytes[0] << 8) | bytes[1]) % 9000);
  return `Guest ${n}`;
}

export async function signLivekitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  room: string,
  now = new Date(),
  name?: string,
) {
  const issued = Math.floor(now.getTime() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const claims: Record<string, unknown> = {
    iss: apiKey,
    sub: identity,
    iat: issued,
    nbf: issued,
    exp: issued + 60 * 60,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true },
  };
  if (name) claims.name = name;
  const payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
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

type RoomRow = { id: string; host_id: string; kind: string };

async function assertVoiceMember(db: D1Database, userId: string) {
  const banned = await db.prepare(`select 1 as n from bans where user_id = ?`).bind(userId).first();
  if (banned) fail("banned");
  const profile = await db.prepare(`select verified, display_name from profiles where id = ?`).bind(userId).first<{
    verified: number;
    display_name: string;
  }>();
  if (!profile?.verified) fail("verified only");
  return profile;
}

async function ensureRoom(db: D1Database, roomId: string, userId: string) {
  const existing = await db.prepare(`select id, host_id, kind from rooms where id = ?`).bind(roomId).first<RoomRow>();
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    await db
      .prepare(`insert into rooms (id, host_id, title, topic, kind, created_at) values (?, ?, '', '', 'room', ?)`)
      .bind(roomId, userId, now)
      .run();
  } catch {
    const again = await db.prepare(`select id, host_id, kind from rooms where id = ?`).bind(roomId).first<RoomRow>();
    if (again) return again;
    throw new Error("room");
  }
  return { id: roomId, host_id: userId, kind: "room" };
}

async function seatSpeaker(db: D1Database, room: RoomRow, userId: string) {
  const member = await db
    .prepare(`select guest_name from room_members where room_id = ? and user_id = ?`)
    .bind(room.id, userId)
    .first<{ guest_name: string }>();
  if (member) return member.guest_name;
  const cap = room.kind === "chai" ? CHAI_CAP : SPEAKER_CAP;
  const seated = await db
    .prepare(`select count(*) as n from room_members where room_id = ? and role = 'speaker'`)
    .bind(room.id)
    .first<{ n: number }>();
  if (Number(seated?.n ?? 0) >= cap) fail("room full");
  const guest = guestLabel();
  const now = new Date().toISOString();
  await db
    .prepare(
      `insert into room_members (room_id, user_id, role, guest_name, revealed, joined_at) values (?, ?, 'speaker', ?, 0, ?)`,
    )
    .bind(room.id, userId, guest, now)
    .run();
  return guest;
}

export async function issueRoomToken(
  db: D1Database,
  apiKey: string | undefined,
  apiSecret: string | undefined,
  userId: string,
  roomId: string,
) {
  const key = apiKey?.trim() ?? "";
  const secret = apiSecret?.trim() ?? "";
  if (!key || !secret) fail("not configured", 500);
  if (!roomId.trim()) fail("bad room", 400);
  await assertVoiceMember(db, userId);
  const room = await ensureRoom(db, roomId.trim(), userId);
  if (room.host_id !== userId) {
    const blocked = await db
      .prepare(`select 1 as n from blocks where blocker = ? and blocked = ?`)
      .bind(room.host_id, userId)
      .first();
    if (blocked) fail("blocked");
  }
  const guest = await seatSpeaker(db, room, userId);
  // Chai Break tokens carry the anonymous name only. A normal room keeps the account id, which existing clients expect.
  if (room.kind === "chai") return signLivekitToken(key, secret, guest, room.id, new Date(), guest);
  return signLivekitToken(key, secret, userId, room.id);
}

export async function createVoiceRoom(db: D1Database, userId: string, title: string, topic: string) {
  await assertVoiceMember(db, userId);
  const name = title.trim();
  if (name.length < 3) fail("bad room", 400);
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into rooms (id, host_id, title, topic, kind, created_at) values (?, ?, ?, ?, 'room', ?)`)
    .bind(id, userId, name, topic.trim(), new Date().toISOString())
    .run();
  return { id };
}

export async function joinChai(db: D1Database, userId: string) {
  await assertVoiceMember(db, userId);
  const open = await db
    .prepare(
      `select r.id from rooms r
       where r.kind = 'chai'
         and (select count(*) from room_members m where m.room_id = r.id) = 1
         and not exists (select 1 from blocks b where b.blocker = r.host_id and b.blocked = ?1)
         and not exists (select 1 from room_members m where m.room_id = r.id and m.user_id = ?1)
       order by r.created_at
       limit 1`,
    )
    .bind(userId)
    .first<{ id: string }>();
  if (open) {
    const room = await db.prepare(`select id, host_id, kind from rooms where id = ?`).bind(open.id).first<RoomRow>();
    if (!room) fail("not a chai room", 404);
    const guest = await seatSpeaker(db, room, userId);
    return { id: room.id, guestName: guest };
  }
  const id = crypto.randomUUID();
  const guest = guestLabel();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`insert into rooms (id, host_id, title, topic, kind, created_at) values (?, ?, 'Chai Break', '', 'chai', ?)`).bind(id, userId, now),
    db
      .prepare(
        `insert into room_members (room_id, user_id, role, guest_name, revealed, joined_at) values (?, ?, 'speaker', ?, 0, ?)`,
      )
      .bind(id, userId, guest, now),
  ]);
  return { id, guestName: guest };
}

export async function revealChai(db: D1Database, userId: string, roomId: string) {
  await assertVoiceMember(db, userId);
  const room = await db.prepare(`select kind from rooms where id = ?`).bind(roomId).first<{ kind: string }>();
  if (!room || room.kind !== "chai") fail("not a chai room", 404);
  const member = await db
    .prepare(`select 1 as n from room_members where room_id = ? and user_id = ?`)
    .bind(roomId, userId)
    .first();
  if (!member) fail("not in room", 403);
  await db.prepare(`update room_members set revealed = 1 where room_id = ? and user_id = ?`).bind(roomId, userId).run();
  const members = await db
    .prepare(
      `select m.user_id, m.revealed, p.display_name from room_members m
       join profiles p on p.id = m.user_id where m.room_id = ?`,
    )
    .bind(roomId)
    .all<{ user_id: string; revealed: number; display_name: string }>();
  const both = members.results.length >= 2 && members.results.every((row) => row.revealed);
  if (!both) return { revealed: false as const };
  return {
    revealed: true as const,
    people: members.results.map((row) => ({ id: row.user_id, name: row.display_name })),
  };
}
