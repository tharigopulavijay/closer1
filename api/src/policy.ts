import { fail } from "./env";
import { addDays, daysBetween, isAdultDob, istDate, istMonth } from "./time";

const MILESTONES = [7, 30, 90, 180, 365];
const BUCKETS = ["photos", "voice", "selfies"];

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

export async function listVisibleIds(db: D1Database, viewerId: string) {
  const rows = await db.prepare(`select id from profiles`).all<{ id: string }>();
  const ids: string[] = [];
  for (const row of rows.results) {
    if (await canSee(db, viewerId, row.id)) ids.push(row.id);
  }
  return ids;
}

export async function readProfile(db: D1Database, viewerId: string, targetId: string) {
  if (!(await canSee(db, viewerId, targetId))) fail("not visible", 404);
  const row = await profile(db, targetId);
  if (!row) fail("not visible", 404);
  return publicProfile(row);
}

export async function readPhotos(db: D1Database, viewerId: string, targetId: string) {
  if (!(await canSee(db, viewerId, targetId))) return [];
  const rows = await db
    .prepare(`select id, storage_path, is_main from profile_photos where user_id = ?`)
    .bind(targetId)
    .all<{ id: string; storage_path: string; is_main: number }>();
  return rows.results;
}

function publicProfile(row: Profile) {
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
    .prepare(`insert into likes (from_id, to_id, note, created_at) values (?, ?, ?, ?)`)
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
    db.prepare(`insert into deposits (plan_id) values (?)`).bind(id),
  ]);
  return id;
}

export async function markDepositPaid(db: D1Database, planId: string, paymentId: string) {
  const payment = paymentId.trim();
  if (!payment) fail("payment required", 400);
  const row = await db
    .prepare(`select status, payment_id from deposits where plan_id = ?`)
    .bind(planId)
    .first<{ status: string; payment_id: string | null }>();
  if (!row) fail("missing deposit", 404);
  if (row.status === "paid" && row.payment_id === payment) return;
  if (row.status === "paid") fail("already paid");
  const used = await db
    .prepare(`select 1 as n from deposits where payment_id = ? and plan_id <> ?`)
    .bind(payment, planId)
    .first();
  if (used) fail("payment already used");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`update deposits set status = 'paid', payment_id = ?, booked_at = ? where plan_id = ?`).bind(payment, now, planId),
    db.prepare(`update plans set booked_at = coalesce(booked_at, ?) where id = ?`).bind(now, planId),
  ]);
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
  if (!(await chatOpen(db, plan))) fail("chat closed");
  const id = crypto.randomUUID();
  await db
    .prepare(`insert into messages (id, plan_id, sender_id, body, created_at) values (?, ?, ?, ?, ?)`)
    .bind(id, planId, senderId, body, new Date().toISOString())
    .run();
  return id;
}

async function chatOpen(db: D1Database, plan: Plan) {
  if (plan.status === "closed") return false;
  const deposit = await db
    .prepare(`select status from deposits where plan_id = ?`)
    .bind(plan.id)
    .first<{ status: string }>();
  if (deposit?.status !== "paid") return false;
  if (plan.kept_by_owner && plan.kept_by_person) return true;
  if (!plan.booked_at) return false;
  return Date.now() < Date.parse(plan.booked_at) + 48 * 60 * 60 * 1000;
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

export async function insertAiReport(db: D1Database, reporterId: string, againstId: string, category: string, detail: string) {
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
  await db.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(userId, personId).run();
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

export async function addTrusted(db: D1Database, userId: string, name: string, phoneHash: string, confirmed = false) {
  await assertActive(db, userId);
  if (confirmed) fail("confirm via link");
  const id = crypto.randomUUID();
  await db
    .prepare(
      `insert into trusted_contacts (id, user_id, name, phone_hash, confirmed, confirm_token) values (?, ?, ?, ?, 0, null)`,
    )
    .bind(id, userId, name, phoneHash)
    .run();
  return { id, confirmed: false };
}

export async function setTrustedToken(db: D1Database, contactId: string, token: string) {
  await db.prepare(`update trusted_contacts set confirm_token = ? where id = ?`).bind(token, contactId).run();
}

export async function confirmTrustedContact(db: D1Database, token: string) {
  const trimmed = token.trim();
  if (!trimmed) fail("bad token", 400);
  const row = await db
    .prepare(`select id from trusted_contacts where confirm_token = ? and confirmed = 0`)
    .bind(trimmed)
    .first<{ id: string }>();
  if (!row) fail("bad token", 400);
  await db.prepare(`update trusted_contacts set confirmed = 1, confirm_token = null where id = ?`).bind(row.id).run();
}

export async function listTrusted(db: D1Database, userId: string) {
  const rows = await db
    .prepare(`select id, name, phone_hash, confirmed from trusted_contacts where user_id = ?`)
    .bind(userId)
    .all<{ id: string; name: string; phone_hash: string; confirmed: number }>();
  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    phoneHash: row.phone_hash,
    confirmed: Boolean(row.confirmed),
  }));
}

export async function insertDebrief(db: D1Database, userId: string, planId: string, feel: string, again: string, note = "") {
  await assertActive(db, userId);
  const plan = await db.prepare(`select owner_id, person_id from plans where id = ?`).bind(planId).first<Plan>();
  if (!plan || (plan.owner_id !== userId && plan.person_id !== userId)) fail("row-level security");
  await db
    .prepare(`insert into debriefs (plan_id, user_id, feel, again, note) values (?, ?, ?, ?, ?)`)
    .bind(planId, userId, feel, again, note)
    .run();
}

export async function deleteAccount(db: D1Database, userId: string) {
  await db.prepare(`delete from users where id = ?`).bind(userId).run();
}

export async function todayDrop(db: D1Database, userId: string, now = new Date()) {
  await assertActive(db, userId);
  const date = istDate(now);
  const drop = await db
    .prepare(`select id from drops where user_id = ? and drop_date = ?`)
    .bind(userId, date)
    .first<{ id: string }>();
  if (!drop) return { date, picks: [] };
  const picks = await db
    .prepare(`select person_id, position from drop_picks where drop_id = ? order by position`)
    .bind(drop.id)
    .all<{ person_id: string; position: number }>();
  return { date, picks: picks.results.map((pick) => ({ personId: pick.person_id, position: pick.position })) };
}

const MEDIA = BUCKETS;

export async function listBuckets(db: D1Database) {
  const rows = await db.prepare(`select id, public from media_buckets order by id`).all<{ id: string; public: number }>();
  return rows.results.map((row) => ({ id: row.id, public: Boolean(row.public) }));
}

export async function putMedia(db: D1Database, userId: string, bucket: string, name: string) {
  await assertActive(db, userId);
  if (!MEDIA.includes(bucket)) fail("bad bucket", 400);
  const folder = name.split("/")[0];
  if (folder !== userId) fail("row-level security");
  await db
    .prepare(`insert into media_objects (id, bucket_id, name, owner_id) values (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), bucket, name, userId)
    .run();
}

export async function listMedia(db: D1Database, userId: string, asService: boolean) {
  if (asService) {
    const rows = await db.prepare(`select name from media_objects`).all<{ name: string }>();
    return rows.results;
  }
  const rows = await db
    .prepare(`select name from media_objects where owner_id = ? or name like ?`)
    .bind(userId, `${userId}/%`)
    .all<{ name: string }>();
  return rows.results;
}
