import { phoneDigits, randomToken, sha256 } from "./crypto";
import { fail } from "./env";
import { addDays, ageYears, daysBetween, isAdultDob, istDate, istMonth, slotInstant } from "./time";

const TRUSTED_LIMIT = 5;

const MILESTONES = [7, 30, 90, 180, 365];

type Profile = {
  id: string;
  display_name: string;
  dob: string | null;
  gender: string | null;
  show_me: string | null;
  intent: string | null;
  area: string | null;
  phone_hash: string | null;
  verified: number;
  hide_from_contacts: number;
  paused: number;
  deleted_at: string | null;
  closer_plus: number;
};

type Plan = {
  id: string;
  owner_id: string;
  person_id: string | null;
  status: string;
  booked_at: string | null;
  kept_by_owner: number;
  kept_by_person: number;
};

async function profile(db: D1Database, id: string) {
  return db.prepare(`select * from profiles where id = ?`).bind(id).first<Profile>();
}

async function banned(db: D1Database, id: string) {
  const row = await db.prepare(`select 1 as n from bans where user_id = ?`).bind(id).first();
  return Boolean(row);
}

async function assertActive(db: D1Database, id: string) {
  if (await banned(db, id)) fail("banned");
}

async function phoneOf(db: D1Database, id: string) {
  const row = await profile(db, id);
  return row?.phone_hash ?? null;
}

async function hiddenByContacts(db: D1Database, profileId: string, viewerPhone: string | null) {
  if (!viewerPhone) return false;
  const row = await db
    .prepare(
      `select 1 as n from profiles p
       where p.id = ? and p.hide_from_contacts = 1
         and exists (select 1 from contact_hashes h where h.owner_id = p.id and h.hash = ?)
         and not exists (select 1 from contact_allowlist a where a.owner_id = p.id and a.hash = ?)`,
    )
    .bind(profileId, viewerPhone, viewerPhone)
    .first();
  return Boolean(row);
}

async function blockedEither(db: D1Database, a: string, b: string) {
  const row = await db
    .prepare(
      `select 1 as n from blocks where (blocker = ? and blocked = ?) or (blocker = ? and blocked = ?)`,
    )
    .bind(a, b, b, a)
    .first();
  return Boolean(row);
}

export async function canSee(db: D1Database, viewerId: string, targetId: string) {
  if (viewerId === targetId) {
    const self = await profile(db, viewerId);
    return Boolean(self);
  }
  const viewer = await profile(db, viewerId);
  if (!viewer || !viewer.verified || viewer.deleted_at || (await banned(db, viewerId))) return false;
  const target = await profile(db, targetId);
  if (!target || !target.verified || target.deleted_at || target.paused) return false;
  if (await banned(db, targetId)) return false;
  if (await blockedEither(db, viewerId, targetId)) return false;
  if (await hiddenByContacts(db, targetId, viewer.phone_hash)) return false;
  return true;
}

// Everyone the viewer has a reason to see: a Drop either way, a like either way,
// a match, a plan, or a room/game connection. Without this, any member could
// page through every profile, which breaks both privacy and the 3-a-day Drop.
// D1 caps a compound SELECT at 5 terms, so these run as a batch and merge in code.
const RELATED_IDS = [
  `select dp.person_id as id from drop_picks dp join drops d on d.id = dp.drop_id where d.user_id = ?1`,
  `select d.user_id as id from drop_picks dp join drops d on d.id = dp.drop_id where dp.person_id = ?1`,
  `select to_id as id from likes where from_id = ?1 union select from_id from likes where to_id = ?1`,
  `select user_b as id from matches where user_a = ?1 union select user_a from matches where user_b = ?1`,
  `select person_id as id from plans where owner_id = ?1 and person_id is not null
   union select owner_id from plans where person_id = ?1`,
  `select person_id as id from social_connections where user_id = ?1
   union select user_id from social_connections where person_id = ?1`,
];

async function relatedIds(db: D1Database, viewerId: string) {
  const results = await db.batch<{ id: string }>(RELATED_IDS.map((sql) => db.prepare(sql).bind(viewerId)));
  return new Set(results.flatMap((result) => result.results.map((row) => row.id)));
}

async function related(db: D1Database, viewerId: string, targetId: string) {
  return (await relatedIds(db, viewerId)).has(targetId);
}

/** canSee plus a reason to see: what every profile, photo and media read uses. */
export async function canView(db: D1Database, viewerId: string, targetId: string) {
  if (viewerId === targetId) return canSee(db, viewerId, targetId);
  return (await related(db, viewerId, targetId)) && (await canSee(db, viewerId, targetId));
}

export async function listVisibleIds(db: D1Database, viewerId: string) {
  const ids: string[] = [];
  for (const id of await relatedIds(db, viewerId)) {
    if (id !== viewerId && (await canSee(db, viewerId, id))) ids.push(id);
  }
  return ids;
}

export async function readProfile(db: D1Database, viewerId: string, targetId: string) {
  if (!(await canView(db, viewerId, targetId))) fail("not visible", 404);
  const row = await profile(db, targetId);
  if (!row) fail("not visible", 404);
  return viewerId === targetId ? ownProfile(row) : publicProfile(row);
}

export async function readPhotos(db: D1Database, viewerId: string, targetId: string) {
  if (!(await canView(db, viewerId, targetId))) return [];
  const rows = await db
    .prepare(`select id, storage_path, is_main from profile_photos where user_id = ?`)
    .bind(targetId)
    .all<{ id: string; storage_path: string; is_main: number }>();
  return rows.results;
}

/** What other members see: age, never the date of birth or privacy settings. */
export function publicProfile(row: Profile) {
  return {
    id: row.id,
    displayName: row.display_name,
    age: row.dob ? ageYears(row.dob, istDate()) : null,
    gender: row.gender,
    intent: row.intent,
    area: row.area,
    verified: Boolean(row.verified),
    closerPlus: Boolean(row.closer_plus),
  };
}

function ownProfile(row: Profile) {
  return {
    id: row.id,
    displayName: row.display_name,
    dob: row.dob,
    gender: row.gender,
    showMe: row.show_me,
    intent: row.intent,
    area: row.area,
    verified: Boolean(row.verified),
    hideFromContacts: Boolean(row.hide_from_contacts),
    paused: Boolean(row.paused),
    closerPlus: Boolean(row.closer_plus),
  };
}

const PROTECTED = new Set(["verified", "phoneHash", "phone_hash", "closerPlus", "closer_plus"]);

export async function updateProfile(db: D1Database, userId: string, patch: Record<string, unknown>) {
  await assertActive(db, userId);
  for (const key of Object.keys(patch)) {
    if (PROTECTED.has(key)) fail("protected field");
  }
  const current = await profile(db, userId);
  if (!current) fail("auth required", 401);
  const dob = patch.dob === undefined ? current.dob : (patch.dob as string | null);
  if (typeof dob === "string" && !isAdultDob(dob)) fail("under 18");
  if (current.verified && patch.dob !== undefined && patch.dob !== current.dob) fail("protected field");
  await db
    .prepare(
      `update profiles set display_name = ?, dob = ?, gender = ?, show_me = ?, intent = ?, area = ?,
        hide_from_contacts = ?, paused = ? where id = ?`,
    )
    .bind(
      patch.displayName === undefined ? current.display_name : String(patch.displayName),
      dob,
      patch.gender === undefined ? current.gender : patch.gender,
      patch.showMe === undefined ? current.show_me : patch.showMe,
      patch.intent === undefined ? current.intent : patch.intent,
      patch.area === undefined ? current.area : patch.area,
      patch.hideFromContacts === undefined ? current.hide_from_contacts : patch.hideFromContacts ? 1 : 0,
      patch.paused === undefined ? current.paused : patch.paused ? 1 : 0,
      userId,
    )
    .run();
  return readProfile(db, userId, userId);
}

async function likeable(db: D1Database, fromId: string, personId: string) {
  await assertActive(db, fromId);
  if (!personId || personId === fromId) fail("unavailable");
  if (await banned(db, personId)) fail("unavailable");
  const person = await profile(db, personId);
  if (!person || !person.verified || person.deleted_at || person.paused) fail("unavailable");
  if (await blockedEither(db, fromId, personId)) fail("blocked");
  const phone = await phoneOf(db, fromId);
  if (await hiddenByContacts(db, personId, phone)) fail("hidden");
  const inDrop = await db
    .prepare(
      `select 1 as n from drop_picks dp join drops d on d.id = dp.drop_id
       where d.user_id = ? and dp.person_id = ?`,
    )
    .bind(fromId, personId)
    .first();
  const social = await db
    .prepare(`select 1 as n from social_connections where user_id = ? and person_id = ?`)
    .bind(fromId, personId)
    .first();
  if (!inDrop && !social) fail("not in drop");
}

export async function sendLike(db: D1Database, fromId: string, personId: string, note = "") {
  await likeable(db, fromId, personId);
  const now = new Date().toISOString();
  await db
    .prepare(`insert or ignore into likes (from_id, to_id, note, created_at) values (?, ?, ?, ?)`)
    .bind(fromId, personId, note, now)
    .run();
  const back = await db
    .prepare(`select 1 as n from likes where from_id = ? and to_id = ?`)
    .bind(personId, fromId)
    .first();
  if (back) {
    const [userA, userB] = fromId < personId ? [fromId, personId] : [personId, fromId];
    await db
      .prepare(`insert or ignore into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userA, userB, now)
      .run();
  }
}

export async function createPlan(db: D1Database, ownerId: string, personId: string, venue: string, slot: string, kind: string) {
  await assertActive(db, ownerId);
  if (!personId || personId === ownerId) fail("unavailable");
  if (await banned(db, personId)) fail("unavailable");
  const person = await profile(db, personId);
  if (!person || !person.verified || person.deleted_at) fail("unavailable");
  if (await blockedEither(db, ownerId, personId)) fail("blocked");
  const [userA, userB] = ownerId < personId ? [ownerId, personId] : [personId, ownerId];
  const match = await db
    .prepare(`select 1 as n from matches where user_a = ? and user_b = ?`)
    .bind(userA, userB)
    .first();
  if (!match) fail("mutual like required");
  const duplicate = await db
    .prepare(
      `select 1 as n from plans where status = 'upcoming' and (
        (owner_id = ? and person_id = ?) or (owner_id = ? and person_id = ?)
      )`,
    )
    .bind(ownerId, personId, personId, ownerId)
    .first();
  if (duplicate) fail("duplicate open plan");
  const me = await profile(db, ownerId);
  const cap = me?.closer_plus ? 4 : 3;
  const open = await db
    .prepare(`select count(*) as n from plans where status = 'upcoming' and (owner_id = ? or person_id = ?)`)
    .bind(ownerId, ownerId)
    .first<{ n: number }>();
  if (Number(open?.n ?? 0) >= cap) fail("open plan limit");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(
      `insert into plans (id, owner_id, person_id, venue_id, slot, kind, status, created_at) values (?, ?, ?, ?, ?, ?, 'upcoming', ?)`,
    ).bind(id, ownerId, personId, venue, slot, kind, now),
    db.prepare(`insert into deposits (plan_id, user_id) values (?, ?)`).bind(id, ownerId),
    db.prepare(`insert into deposits (plan_id, user_id) values (?, ?)`).bind(id, personId),
  ]);
  return id;
}

export async function markDepositPaid(db: D1Database, planId: string, userId: string, paymentId: string) {
  const payment = paymentId.trim();
  if (!payment || !userId) fail("payment required", 400);
  const row = await db
    .prepare(`select status, payment_id from deposits where plan_id = ? and user_id = ?`)
    .bind(planId, userId)
    .first<{ status: string; payment_id: string | null }>();
  if (!row) fail("missing deposit", 404);
  if (row.status === "paid" && row.payment_id === payment) return;
  if (row.status === "paid") fail("already paid");
  const used = await db
    .prepare(`select 1 as n from deposits where payment_id = ? and not (plan_id = ? and user_id = ?)`)
    .bind(payment, planId, userId)
    .first();
  if (used) fail("payment already used");
  const now = new Date().toISOString();
  await db
    .prepare(`update deposits set status = 'paid', payment_id = ?, booked_at = ? where plan_id = ? and user_id = ?`)
    .bind(payment, now, planId, userId)
    .run();
  const pending = await db
    .prepare(`select count(*) as n from deposits where plan_id = ? and status <> 'paid'`)
    .bind(planId)
    .first<{ n: number }>();
  const paid = await db
    .prepare(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`)
    .bind(planId)
    .first<{ n: number }>();
  if (Number(pending?.n ?? 1) === 0 && Number(paid?.n ?? 0) >= 2) {
    await db.prepare(`update plans set booked_at = coalesce(booked_at, ?) where id = ?`).bind(now, planId).run();
  }
}

export async function keepChat(db: D1Database, userId: string, planId: string) {
  await assertActive(db, userId);
  const plan = await db.prepare(`select owner_id, person_id from plans where id = ?`).bind(planId).first<Plan>();
  if (!plan) fail("missing plan", 404);
  if (plan.owner_id === userId) {
    await db.prepare(`update plans set kept_by_owner = 1 where id = ?`).bind(planId).run();
    return;
  }
  if (plan.person_id === userId) {
    await db.prepare(`update plans set kept_by_person = 1 where id = ?`).bind(planId).run();
    return;
  }
  fail("not in plan");
}

export async function deliverMessage(db: D1Database, senderId: string, planId: string, body: string) {
  if (!senderId) fail("auth required", 401);
  if (await banned(db, senderId)) fail("banned");
  if (!body.trim()) fail("empty message", 400);
  const plan = await db.prepare(`select * from plans where id = ?`).bind(planId).first<Plan>();
  if (!plan) fail("missing plan", 404);
  if (plan.owner_id !== senderId && plan.person_id !== senderId) fail("not in plan");
  if (!(await chatOpen(db, plan)) || !(await partnerReachable(db, plan, senderId))) fail("chat closed");
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into messages (id, plan_id, sender_id, body, created_at) values (?, ?, ?, ?, ?)`)
    .bind(id, planId, senderId, body, new Date().toISOString())
    .run();
  return id;
}

export async function chatOpen(db: D1Database, plan: Plan) {
  if (plan.status === "closed") return false;
  const deposits = await db
    .prepare(`select status from deposits where plan_id = ?`)
    .bind(plan.id)
    .all<{ status: string }>();
  if (deposits.results.length < 2 || deposits.results.some((row) => row.status !== "paid")) return false;
  if (plan.kept_by_owner && plan.kept_by_person) return true;
  if (!plan.booked_at) return false;
  return Date.now() < Date.parse(plan.booked_at) + 48 * 60 * 60 * 1000;
}

export async function assertChatAccess(db: D1Database, userId: string, planId: string) {
  await assertActive(db, userId);
  const plan = await db.prepare(`select * from plans where id = ?`).bind(planId).first<Plan>();
  if (!plan) fail("missing plan", 404);
  if (plan.owner_id !== userId && plan.person_id !== userId) fail("not in plan");
  if (!(await chatOpen(db, plan)) || !(await partnerReachable(db, plan, userId))) fail("chat closed");
  return plan;
}

const CHAT_TICKET_MS = 60_000;

/** A chat socket credential. The raw ticket is returned once and only its hash is stored. */
export async function issueChatTicket(db: D1Database, userId: string, planId: string) {
  await assertChatAccess(db, userId, planId);
  const ticket = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHAT_TICKET_MS).toISOString();
  // Each reconnect issues a ticket, so this person's spent and stale ones are cleared as we go.
  await db.batch([
    db.prepare(`delete from chat_tickets where user_id = ? and (used_at is not null or expires_at <= ?)`).bind(userId, now.toISOString()),
    db
      .prepare(`insert into chat_tickets (token_hash, plan_id, user_id, expires_at) values (?, ?, ?, ?)`)
      .bind(await sha256(ticket), planId, userId, expiresAt),
  ]);
  return { ticket, expiresAt };
}

/** Marks a ticket used. A ticket for another plan, an expired ticket, or a second use is refused. */
export async function consumeChatTicket(db: D1Database, planId: string, ticket: string) {
  const trimmed = ticket.trim();
  if (!trimmed) fail("auth required", 401);
  const hash = await sha256(trimmed);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `update chat_tickets set used_at = ? where token_hash = ? and plan_id = ? and used_at is null and expires_at > ?`,
    )
    .bind(now, hash, planId, now)
    .run();
  if (Number(result.meta.changes ?? 0) < 1) fail("auth required", 401);
  const row = await db
    .prepare(`select user_id from chat_tickets where token_hash = ?`)
    .bind(hash)
    .first<{ user_id: string }>();
  if (!row) fail("auth required", 401);
  return row.user_id;
}

export async function assertDepositPayer(db: D1Database, userId: string, planId: string) {
  await assertActive(db, userId);
  const plan = await db.prepare(`select owner_id, person_id from plans where id = ?`).bind(planId).first<Plan>();
  if (!plan) fail("missing plan", 404);
  if (plan.owner_id !== userId && plan.person_id !== userId) fail("not in plan");
  const row = await db
    .prepare(`select status from deposits where plan_id = ? and user_id = ?`)
    .bind(planId, userId)
    .first<{ status: string }>();
  if (!row) fail("missing deposit", 404);
  if (row.status === "paid") fail("already paid");
}

export async function saveDepositOrder(db: D1Database, planId: string, userId: string, orderId: string) {
  await db.prepare(`update deposits set order_id = ? where plan_id = ? and user_id = ?`).bind(orderId, planId, userId).run();
}

/** A block either way, or a ban, ends the chat at once, even mid-conversation. */
async function partnerReachable(db: D1Database, plan: Plan, userId: string) {
  const partner = plan.owner_id === userId ? plan.person_id : plan.owner_id;
  if (!partner) return false;
  if (await banned(db, partner)) return false;
  const other = await profile(db, partner);
  if (!other || other.deleted_at) return false;
  return !(await blockedEither(db, userId, partner));
}

export async function fileReport(
  db: D1Database,
  reporterId: string,
  input: { againstId: string; category: string; detail: string; severe?: boolean; status?: string; source?: string },
) {
  await assertActive(db, reporterId);
  if (input.status && input.status !== "open") fail("status is server owned");
  await db
    .prepare(
      `insert into reports (id, reporter_id, against_id, category, severe, detail, status, source, created_at)
       values (?, ?, ?, ?, ?, ?, 'open', 'user', ?)`,
    )
    .bind(
      crypto.randomUUID(),
      reporterId,
      input.againstId,
      input.category,
      input.severe ? 1 : 0,
      input.detail,
      new Date().toISOString(),
    )
    .run();
}

export async function insertAiReport(db: D1Database, reporterId: string | null, againstId: string, category: string, detail: string) {
  await db
    .prepare(
      `insert into reports (id, reporter_id, against_id, category, severe, detail, status, source, created_at)
       values (?, ?, ?, ?, 0, ?, 'open', 'ai', ?)`,
    )
    .bind(crypto.randomUUID(), reporterId, againstId, category, detail, new Date().toISOString())
    .run();
}

async function staffRole(db: D1Database, userId: string, role: string) {
  const row = await db
    .prepare(`select 1 as n from staff_roles where user_id = ? and role = ?`)
    .bind(userId, role)
    .first();
  return Boolean(row);
}

export async function confirmReport(db: D1Database, actorId: string, reportId: string, action: string) {
  if (!(await staffRole(db, actorId, "safety"))) fail("safety only");
  if (await banned(db, actorId)) fail("banned");
  const report = await db
    .prepare(`select * from reports where id = ?`)
    .bind(reportId)
    .first<{ id: string; against_id: string | null; category: string; severe: number; status: string }>();
  if (!report) fail("missing report", 404);
  if (!report.against_id) fail("missing subject");
  const now = new Date().toISOString();
  if (action === "dismiss") {
    await db.batch([
      db.prepare(`update reports set status = 'dismissed' where id = ?`).bind(reportId),
      db.prepare(`insert into audit_log (id, actor, role, action, detail, created_at) values (?, ?, 'safety', 'dismiss report', ?, ?)`).bind(
        crypto.randomUUID(),
        actorId,
        reportId,
        now,
      ),
    ]);
    return;
  }
  if (action !== "confirm") fail("bad action", 400);
  if (report.status === "confirmed") return;
  await db.prepare(`update reports set status = 'confirmed' where id = ?`).bind(reportId).run();
  await db
    .prepare(`insert into strikes (id, report_id, user_id, category, created_at) values (?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), report.id, report.against_id, report.category, now)
    .run();
  const minors = await db
    .prepare(
      `select count(*) as n from strikes s join reports r on r.id = s.report_id
       where s.user_id = ? and r.severe = 0`,
    )
    .bind(report.against_id)
    .first<{ n: number }>();
  if (report.severe || Number(minors?.n ?? 0) >= 3) {
    await db
      .prepare(`insert or ignore into bans (user_id, reason, created_at) values (?, ?, ?)`)
      .bind(report.against_id, report.severe ? "severe" : "third strike", now)
      .run();
  }
  await db
    .prepare(`insert into audit_log (id, actor, role, action, detail, created_at) values (?, ?, 'safety', 'confirm report', ?, ?)`)
    .bind(crypto.randomUUID(), actorId, `${report.against_id} ${report.category}`, now)
    .run();
}

export async function recordActivity(db: D1Database, userId: string, kind: string, now = new Date()) {
  await assertActive(db, userId);
  if (!["drop", "room", "play", "freeze"].includes(kind)) fail("bad activity", 400);
  const today = istDate(now);
  const month = istMonth(now);
  const existing = await db.prepare(`select * from streaks where user_id = ?`).bind(userId).first<{
    count: number;
    last_date: string | null;
    freezes_left: number;
    freeze_month: string;
    frozen_by_away: number;
  }>();
  let count = existing?.count ?? 0;
  let lastDate = existing?.last_date ?? null;
  let freezes = existing?.freezes_left ?? 2;
  let freezeMonth = existing?.freeze_month || month;
  let frozen = Boolean(existing?.frozen_by_away);
  if (!existing) {
    await db
      .prepare(
        `insert into streaks (user_id, count, freezes_left, freeze_month, frozen_by_away) values (?, 0, 2, ?, 0)`,
      )
      .bind(userId, month)
      .run();
    freezes = 2;
    freezeMonth = month;
  }
  if (freezeMonth !== month) {
    freezes = 2;
    freezeMonth = month;
  }
  if (kind === "freeze") {
    if (freezes <= 0 || !lastDate || daysBetween(lastDate, today) !== 2) fail("no freeze");
    await db
      .prepare(`update streaks set freezes_left = ?, freeze_month = ?, last_date = ? where user_id = ?`)
      .bind(freezes - 1, freezeMonth, addDays(today, -1), userId)
      .run();
    return count;
  }
  const me = await profile(db, userId);
  const away = await db.prepare(`select 1 as n from away_status where user_id = ?`).bind(userId).first();
  if (me?.paused || away || frozen) {
    await db
      .prepare(`update streaks set freezes_left = ?, freeze_month = ?, frozen_by_away = 1 where user_id = ?`)
      .bind(freezes, freezeMonth, userId)
      .run();
    return count;
  }
  if (lastDate === today) {
    await db
      .prepare(`update streaks set freezes_left = ?, freeze_month = ?, frozen_by_away = 0 where user_id = ?`)
      .bind(freezes, freezeMonth, userId)
      .run();
    return count;
  }
  if (!lastDate) count = Math.max(1, count);
  else if (daysBetween(lastDate, today) === 1) count += 1;
  else count = 1;
  await db
    .prepare(
      `update streaks set count = ?, last_date = ?, freezes_left = ?, freeze_month = ?, frozen_by_away = 0 where user_id = ?`,
    )
    .bind(count, today, freezes, freezeMonth, userId)
    .run();
  return count;
}

export async function claimGift(db: D1Database, userId: string, milestone: number, gift: string, address: string) {
  await assertActive(db, userId);
  const me = await profile(db, userId);
  if (!me?.closer_plus) fail("closer plus only");
  if (!MILESTONES.includes(milestone)) fail("bad milestone", 400);
  if (!address.trim()) fail("address required", 400);
  const streak = await db.prepare(`select count from streaks where user_id = ?`).bind(userId).first<{ count: number }>();
  if (Number(streak?.count ?? 0) < milestone) fail("streak too low");
  const prior = await db
    .prepare(`select 1 as n from gift_claims where user_id = ? and milestone = ?`)
    .bind(userId, milestone)
    .first();
  if (prior) fail("already claimed");
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into gift_claims (id, user_id, milestone, gift, address, created_at) values (?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, milestone, gift, address.trim(), new Date().toISOString())
    .run();
  return id;
}

export async function blockPerson(db: D1Database, userId: string, personId: string) {
  await assertActive(db, userId);
  if (!personId || personId === userId || !(await profile(db, personId))) fail("unavailable", 400);
  await db.prepare(`insert or ignore into blocks (blocker, blocked) values (?, ?)`).bind(userId, personId).run();
}

export async function setAway(db: D1Database, userId: string, kind: string, until: string | null) {
  await assertActive(db, userId);
  await db
    .prepare(`insert into away_status (user_id, kind, until) values (?, ?, ?) on conflict (user_id) do update set kind = excluded.kind, until = excluded.until`)
    .bind(userId, kind, until)
    .run();
}

export async function clearAway(db: D1Database, userId: string) {
  await assertActive(db, userId);
  await db.prepare(`delete from away_status where user_id = ?`).bind(userId).run();
}

export async function addTrusted(db: D1Database, userId: string, name: string, phone: string, confirmed = false) {
  await assertActive(db, userId);
  if (confirmed) fail("confirm via link");
  const digits = phoneDigits(phone);
  if (digits.length < 10 || digits.length > 15) fail("bad phone", 400);
  if (!name.trim()) fail("name required", 400);
  const existing = await db
    .prepare(`select count(*) as n from trusted_contacts where user_id = ?`)
    .bind(userId)
    .first<{ n: number }>();
  if (Number(existing?.n ?? 0) >= TRUSTED_LIMIT) fail("contact limit", 400);
  const id = crypto.randomUUID();
  await db
    .prepare(
      `insert into trusted_contacts (id, user_id, name, phone, phone_hash, confirmed, confirm_token) values (?, ?, ?, ?, ?, 0, null)`,
    )
    .bind(id, userId, name.trim(), digits, await sha256(digits))
    .run();
  return { id, confirmed: false };
}

export async function setTrustedToken(db: D1Database, contactId: string, token: string) {
  const trimmed = token.trim();
  if (!trimmed) fail("bad token", 400);
  await db.prepare(`update trusted_contacts set confirm_token = ? where id = ?`).bind(await sha256(trimmed), contactId).run();
}

export async function confirmTrustedContact(db: D1Database, token: string) {
  const trimmed = token.trim();
  if (!trimmed) fail("bad token", 400);
  const row = await db
    .prepare(`select id from trusted_contacts where confirm_token = ? and confirmed = 0`)
    .bind(await sha256(trimmed))
    .first<{ id: string }>();
  if (!row) fail("bad token", 400);
  await db.prepare(`update trusted_contacts set confirmed = 1, confirm_token = null where id = ?`).bind(row.id).run();
}

export async function listTrusted(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`select id, name, phone, confirmed from trusted_contacts where user_id = ?`)
    .bind(userId)
    .all<{ id: string; name: string; phone: string; confirmed: number }>();
  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    phoneEnding: row.phone.slice(-4),
    confirmed: Boolean(row.confirmed),
  }));
}

export async function insertDebrief(db: D1Database, userId: string, planId: string, feel: string, again: string, note = "") {
  await assertActive(db, userId);
  const plan = await db
    .prepare(`select owner_id, person_id, slot, created_at from plans where id = ?`)
    .bind(planId)
    .first<Plan & { slot: string; created_at: string }>();
  if (!plan || (plan.owner_id !== userId && plan.person_id !== userId)) fail("row-level security");
  const at = slotInstant(plan.slot, plan.created_at);
  if (at === null || Date.now() <= at) fail("slot not started");
  const existing = await db
    .prepare(`select 1 as n from debriefs where plan_id = ? and user_id = ?`)
    .bind(planId, userId)
    .first();
  if (existing) fail("already debriefed");
  await db
    .prepare(`insert into debriefs (plan_id, user_id, feel, again, note) values (?, ?, ?, ?, ?)`)
    .bind(planId, userId, feel, again, note)
    .run();
}

/**
 * Removes everything personal and keeps what safety and accounts need: plans,
 * deposits, messages, reports, strikes, bans and SOS rows. The users row and its
 * phone hash stay, so a banned person who deletes and signs up again is still banned.
 */
export async function deleteAccount(db: D1Database, userId: string) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`delete from sessions where user_id = ?`).bind(userId),
    db.prepare(`delete from profile_photos where user_id = ?`).bind(userId),
    db.prepare(`delete from voice_answers where user_id = ?`).bind(userId),
    db.prepare(`delete from media_objects where owner_id = ?`).bind(userId),
    db.prepare(`delete from preferences where user_id = ?`).bind(userId),
    db.prepare(`delete from contact_hashes where owner_id = ?`).bind(userId),
    db.prepare(`delete from contact_allowlist where owner_id = ?`).bind(userId),
    db.prepare(`delete from trusted_contacts where user_id = ?`).bind(userId),
    db.prepare(`delete from chat_tickets where user_id = ?`).bind(userId),
    db.prepare(`delete from away_status where user_id = ?`).bind(userId),
    db.prepare(`delete from streaks where user_id = ?`).bind(userId),
    db.prepare(`delete from likes where from_id = ? or to_id = ?`).bind(userId, userId),
    db.prepare(`delete from drop_picks where person_id = ?`).bind(userId),
    db.prepare(`delete from drops where user_id = ?`).bind(userId),
    db.prepare(`delete from social_connections where user_id = ? or person_id = ?`).bind(userId, userId),
    db.prepare(`update gift_claims set address = '' where user_id = ?`).bind(userId),
    db.prepare(`update plans set status = 'closed' where status = 'upcoming' and (owner_id = ? or person_id = ?)`).bind(userId, userId),
    db.prepare(
      `update profiles set display_name = '', dob = null, gender = null, show_me = null, intent = null, area = null,
         phone_hash = null, verified = 0, paused = 1, deleted_at = ? where id = ?`,
    ).bind(now, userId),
  ]);
}

export async function todayDrop(db: D1Database, userId: string, now = new Date()) {
  await assertActive(db, userId);
  const date = istDate(now);
  const drop = await db
    .prepare(`select id from drops where user_id = ? and drop_date = ?`)
    .bind(userId, date)
    .first<{ id: string }>();
  if (!drop) return { date, picks: [] as DropPick[] };
  const picks = await db
    .prepare(`select person_id, position from drop_picks where drop_id = ? order by position`)
    .bind(drop.id)
    .all<{ person_id: string; position: number }>();
  const enriched: DropPick[] = [];
  for (const pick of picks.results) {
    const visible = await canView(db, userId, pick.person_id);
    const row = visible ? await profile(db, pick.person_id) : null;
    const photos = visible ? await readPhotos(db, userId, pick.person_id) : [];
    enriched.push({
      personId: pick.person_id,
      position: pick.position,
      profile: row ? publicProfile(row) : null,
      photos: photos.map((photo) => photo.storage_path),
    });
  }
  return { date, picks: enriched };
}

type DropPick = {
  personId: string;
  position: number;
  profile: ReturnType<typeof publicProfile> | null;
  photos: string[];
};

const SHA256_HEX = /^[0-9a-f]{64}$/i;

function hashList(value: unknown) {
  if (!Array.isArray(value)) fail("bad hashes", 400);
  if (value.length > 5000) fail("too many", 400);
  const hashes: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !SHA256_HEX.test(item)) fail("bad hash", 400);
    hashes.push(item.toLowerCase());
  }
  return [...new Set(hashes)];
}

function stringList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`bad ${label}`, 400);
  return value;
}

function ageBound(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`bad ${label}`, 400);
  return value;
}

export async function savePreferences(
  db: D1Database,
  userId: string,
  input: { areas?: unknown; languages?: unknown; ageMin?: unknown; ageMax?: unknown; foods?: unknown },
) {
  await assertActive(db, userId);
  const areas = stringList(input.areas, "areas");
  const languages = stringList(input.languages, "languages");
  const foods = stringList(input.foods, "foods");
  const ageMin = ageBound(input.ageMin, "ageMin");
  const ageMax = ageBound(input.ageMax, "ageMax");
  if (ageMin < 18 || ageMin > 70 || ageMax > 70 || ageMin > ageMax) fail("bad age", 400);
  await db
    .prepare(
      `insert into preferences (user_id, areas, languages, age_min, age_max, foods)
       values (?, ?, ?, ?, ?, ?)
       on conflict(user_id) do update set areas = excluded.areas, languages = excluded.languages,
         age_min = excluded.age_min, age_max = excluded.age_max, foods = excluded.foods`,
    )
    .bind(userId, JSON.stringify(areas), JSON.stringify(languages), ageMin, ageMax, JSON.stringify(foods))
    .run();
  return readPreferences(db, userId);
}

export async function readPreferences(db: D1Database, userId: string) {
  await assertActive(db, userId);
  const row = await db
    .prepare(`select areas, languages, age_min, age_max, foods from preferences where user_id = ?`)
    .bind(userId)
    .first<{ areas: string; languages: string; age_min: number; age_max: number; foods: string }>();
  if (!row) return { areas: [], languages: [], ageMin: 18, ageMax: 70, foods: [] };
  return {
    areas: JSON.parse(row.areas) as string[],
    languages: JSON.parse(row.languages) as string[],
    ageMin: row.age_min,
    ageMax: row.age_max,
    foods: JSON.parse(row.foods) as string[],
  };
}

async function writeHashes(db: D1Database, table: "contact_hashes" | "contact_allowlist", userId: string, hashes: string[]) {
  // One atomic batch of two statements: a failed upload never leaves the list half-replaced,
  // and 5000 contacts stay far below D1's per-request query limit.
  await db.batch([
    db.prepare(`delete from ${table} where owner_id = ?`).bind(userId),
    db.prepare(`insert into ${table} (owner_id, hash) select ?, value from json_each(?)`).bind(userId, JSON.stringify(hashes)),
  ]);
}

export async function replaceContactHashes(db: D1Database, userId: string, hashes: unknown) {
  await assertActive(db, userId);
  await writeHashes(db, "contact_hashes", userId, hashList(hashes));
  return { ok: true };
}

export async function replaceAllowlist(db: D1Database, userId: string, hashes: unknown) {
  await assertActive(db, userId);
  await writeHashes(db, "contact_allowlist", userId, hashList(hashes));
  return { ok: true };
}

async function ownedMedia(db: D1Database, userId: string, key: string, kind: string) {
  const row = await db
    .prepare(`select owner_id, kind from media_objects where id = ?`)
    .bind(key)
    .first<{ owner_id: string; kind: string }>();
  if (!row || row.owner_id !== userId || row.kind !== kind) fail("not your media", 400);
}

export async function registerProfilePhoto(db: D1Database, userId: string, key: string, main = false) {
  await assertActive(db, userId);
  if (!key) fail("not your media", 400);
  await ownedMedia(db, userId, key, "photo");
  const existing = await db
    .prepare(`select id, is_main from profile_photos where user_id = ?`)
    .bind(userId)
    .all<{ id: string; is_main: number }>();
  if (existing.results.length >= 6) fail("photo limit", 400);
  const makeMain = main || existing.results.every((row) => !row.is_main);
  const id = crypto.randomUUID();
  const statements = [];
  if (makeMain) statements.push(db.prepare(`update profile_photos set is_main = 0 where user_id = ?`).bind(userId));
  statements.push(
    db.prepare(`insert into profile_photos (id, user_id, storage_path, is_main) values (?, ?, ?, ?)`).bind(id, userId, key, makeMain ? 1 : 0),
  );
  await db.batch(statements);
  return { id, main: makeMain };
}

export async function deleteProfilePhoto(db: D1Database, userId: string, photoId: string) {
  await assertActive(db, userId);
  const row = await db
    .prepare(`select id, is_main from profile_photos where id = ? and user_id = ?`)
    .bind(photoId, userId)
    .first<{ id: string; is_main: number }>();
  if (!row) fail("not your photo", 404);
  const statements = [db.prepare(`delete from profile_photos where id = ?`).bind(photoId)];
  // Removing the main photo promotes the oldest remaining one, so a profile is never left without a face.
  if (row.is_main) {
    statements.push(
      db
        .prepare(`update profile_photos set is_main = 1 where id = (select id from profile_photos where user_id = ? order by rowid limit 1)`)
        .bind(userId),
    );
  }
  await db.batch(statements);
  return { ok: true };
}

export async function registerVoice(db: D1Database, userId: string, key: string, prompt: string, seconds: number) {
  await assertActive(db, userId);
  if (!prompt.trim()) fail("bad prompt", 400);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 30) fail("bad seconds", 400);
  await ownedMedia(db, userId, key, "voice");
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into voice_answers (id, user_id, prompt, storage_path, seconds) values (?, ?, ?, ?, ?)`)
    .bind(id, userId, prompt.trim(), key, seconds)
    .run();
  return { id };
}

type PlanRow = Plan & { venue_id: string; slot: string; kind: string };

export async function listMyPlans(db: D1Database, userId: string) {
  await assertActive(db, userId);
  const plans = await db
    .prepare(`select * from plans where owner_id = ? or person_id = ? order by created_at desc`)
    .bind(userId, userId)
    .all<PlanRow>();
  const out = [];
  for (const plan of plans.results) {
    const partnerId = plan.owner_id === userId ? plan.person_id : plan.owner_id;
    let partner: ReturnType<typeof publicProfile> | { id: string; visible: false } | null = null;
    if (partnerId) {
      if (await canView(db, userId, partnerId)) {
        const row = await profile(db, partnerId);
        partner = row ? publicProfile(row) : { id: partnerId, visible: false };
      } else {
        partner = { id: partnerId, visible: false };
      }
    }
    const deposits = await db
      .prepare(`select user_id, status from deposits where plan_id = ?`)
      .bind(plan.id)
      .all<{ user_id: string; status: string }>();
    out.push({
      id: plan.id,
      status: plan.status,
      venueId: plan.venue_id,
      slot: plan.slot,
      kind: plan.kind,
      bookedAt: plan.booked_at,
      partner,
      deposits: deposits.results.map((row) => ({ userId: row.user_id, status: row.status })),
      chatOpen: await chatOpen(db, plan),
      keptByMe: plan.owner_id === userId ? Boolean(plan.kept_by_owner) : Boolean(plan.kept_by_person),
      keptByThem: plan.owner_id === userId ? Boolean(plan.kept_by_person) : Boolean(plan.kept_by_owner),
    });
  }
  return out;
}

export async function listPlanMessages(db: D1Database, userId: string, planId: string, before?: string) {
  await assertChatAccess(db, userId, planId);
  const rows = before
    ? await db
        .prepare(
          `select id, sender_id, body, created_at from messages where plan_id = ? and created_at < ? order by created_at desc limit 50`,
        )
        .bind(planId, before)
        .all<{ id: string; sender_id: string | null; body: string; created_at: string }>()
    : await db
        .prepare(`select id, sender_id, body, created_at from messages where plan_id = ? order by created_at desc limit 50`)
        .bind(planId)
        .all<{ id: string; sender_id: string | null; body: string; created_at: string }>();
  return rows.results.reverse().map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  }));
}

async function visiblePeople(db: D1Database, viewerId: string, ids: string[]) {
  const people = [];
  for (const id of ids) {
    if (!(await canView(db, viewerId, id))) continue;
    const row = await profile(db, id);
    if (!row) continue;
    people.push({ id, profile: publicProfile(row) });
  }
  return people;
}

export async function listMatches(db: D1Database, userId: string) {
  await assertActive(db, userId);
  const rows = await db
    .prepare(`select user_a, user_b from matches where user_a = ? or user_b = ?`)
    .bind(userId, userId)
    .all<{ user_a: string; user_b: string }>();
  const ids = rows.results.map((row) => (row.user_a === userId ? row.user_b : row.user_a));
  return visiblePeople(db, userId, ids);
}

export async function listReceivedLikes(db: D1Database, userId: string) {
  await assertActive(db, userId);
  const rows = await db
    .prepare(`select from_id from likes where to_id = ?`)
    .bind(userId)
    .all<{ from_id: string }>();
  return visiblePeople(db, userId, rows.results.map((row) => row.from_id));
}

export async function verifyMember(db: D1Database, actorId: string, targetId: string) {
  if (!(await staffRole(db, actorId, "ops"))) fail("ops only");
  if (await banned(db, actorId)) fail("banned");
  const target = await profile(db, targetId);
  if (!target || target.deleted_at) fail("missing user", 404);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`update profiles set verified = 1 where id = ?`).bind(targetId),
    db.prepare(`insert into audit_log (id, actor, role, action, detail, created_at) values (?, ?, 'ops', 'verify', ?, ?)`).bind(
      crypto.randomUUID(),
      actorId,
      targetId,
      now,
    ),
  ]);
  return { ok: true };
}

export async function verifyQueue(db: D1Database, actorId: string) {
  if (!(await staffRole(db, actorId, "ops"))) fail("ops only");
  if (await banned(db, actorId)) fail("banned");
  const rows = await db
    .prepare(
      `select p.id, p.display_name,
         (select json_group_array(m.id) from media_objects m where m.owner_id = p.id and m.kind = 'selfie') as selfies,
         (select json_group_array(f.storage_path) from profile_photos f where f.user_id = p.id) as photos
       from profiles p
       where p.verified = 0 and p.deleted_at is null
         and exists (select 1 from media_objects m where m.owner_id = p.id and m.kind = 'selfie')
       order by p.created_at`,
    )
    .all<{ id: string; display_name: string; selfies: string; photos: string }>();
  // Ops needs the selfie and the profile photos side by side to decide.
  return rows.results.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    selfies: JSON.parse(row.selfies) as string[],
    photos: JSON.parse(row.photos) as string[],
  }));
}

export async function listBuckets(db: D1Database) {
  const rows = await db.prepare(`select id, public from media_buckets order by id`).all<{ id: string; public: number }>();
  return rows.results.map((row) => ({ id: row.id, public: Boolean(row.public) }));
}

