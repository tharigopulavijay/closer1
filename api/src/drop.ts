import { addDays, ageYears, istDate } from "./time";

// Reads everything once and decides in memory. One query per pair of users would
// pass the per-run D1 query limit with only a handful of members.

const PICKS = 3;
// Nobody appears in more than this many Drops a night, so popular profiles don't
// crowd out everyone else and aren't flooded with likes.
const MAX_APPEARANCES = 12;
const WRITE_CHUNK = 90;

type Person = {
  id: string;
  dob: string | null;
  area: string | null;
  gender: string | null;
  show_me: string | null;
  intent: string | null;
  verified: number;
  paused: number;
  deleted_at: string | null;
  phone_hash: string | null;
  hide_from_contacts: number;
};

type Prefs = { areas: string[]; age_min: number; age_max: number };

function areasOf(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function wants(viewer: Person, person: Person) {
  const show = viewer.show_me;
  if (!show || show === "everyone") return true;
  if (show === "women") return person.gender === "woman";
  if (show === "men") return person.gender === "man";
  return false;
}

function intentsFit(a: Person, b: Person) {
  if (!a.intent || !b.intent || a.intent === "both" || b.intent === "both") return true;
  return a.intent === b.intent;
}

/** FNV-1a: a stable per-viewer, per-night order, so the first ids aren't everyone's Drop. */
function rank(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pairKey(a: string, b: string) {
  return `${a} ${b}`;
}

export async function buildTomorrowDrop(db: D1Database, now = new Date()) {
  const today = istDate(now);
  const tomorrow = addDays(today, 1);
  const since = addDays(tomorrow, -14);

  const [profiles, bans, blocks, away, prefs, contacts, allowed, recent] = await db.batch([
    db.prepare(
      `select id, dob, area, gender, show_me, intent, verified, paused, deleted_at, phone_hash, hide_from_contacts
       from profiles order by id`,
    ),
    db.prepare(`select user_id from bans`),
    db.prepare(`select blocker, blocked from blocks`),
    db.prepare(`select user_id from away_status where until is null or until >= ?`).bind(today),
    db.prepare(`select user_id, areas, age_min, age_max from preferences`),
    db.prepare(`select owner_id, hash from contact_hashes`),
    db.prepare(`select owner_id, hash from contact_allowlist`),
    db.prepare(
      `select d.user_id, dp.person_id from drop_picks dp join drops d on d.id = dp.drop_id
       where d.drop_date > ? and d.drop_date < ?`,
    ).bind(since, tomorrow),
  ]);

  const banned = new Set((bans.results as { user_id: string }[]).map((row) => row.user_id));
  const awayIds = new Set((away.results as { user_id: string }[]).map((row) => row.user_id));
  const blocked = new Set<string>();
  for (const row of blocks.results as { blocker: string; blocked: string }[]) {
    blocked.add(pairKey(row.blocker, row.blocked));
    blocked.add(pairKey(row.blocked, row.blocker));
  }
  const prefsOf = new Map<string, Prefs>();
  for (const row of prefs.results as { user_id: string; areas: string; age_min: number; age_max: number }[]) {
    prefsOf.set(row.user_id, { areas: areasOf(row.areas), age_min: row.age_min, age_max: row.age_max });
  }
  const contactSet = new Set((contacts.results as { owner_id: string; hash: string }[]).map((row) => pairKey(row.owner_id, row.hash)));
  const allowSet = new Set((allowed.results as { owner_id: string; hash: string }[]).map((row) => pairKey(row.owner_id, row.hash)));
  const seen = new Set((recent.results as { user_id: string; person_id: string }[]).map((row) => pairKey(row.user_id, row.person_id)));

  const people = profiles.results as Person[];
  const active = people.filter(
    (p) => p.verified && !p.paused && !p.deleted_at && !banned.has(p.id) && !awayIds.has(p.id),
  );

  // Hidden-from-contacts works both ways in the Drop: a match needs both to see each other.
  function hides(owner: Person, viewer: Person) {
    if (!owner.hide_from_contacts || !viewer.phone_hash) return false;
    return contactSet.has(pairKey(owner.id, viewer.phone_hash)) && !allowSet.has(pairKey(owner.id, viewer.phone_hash));
  }

  function suits(viewer: Person, person: Person) {
    if (person.id === viewer.id) return false;
    if (blocked.has(pairKey(viewer.id, person.id))) return false;
    if (hides(person, viewer) || hides(viewer, person)) return false;
    if (!wants(viewer, person) || !wants(person, viewer) || !intentsFit(viewer, person)) return false;
    const pref = prefsOf.get(viewer.id);
    if (pref?.areas.length && !pref.areas.includes(person.area ?? "")) return false;
    if (pref && person.dob) {
      const age = ageYears(person.dob, tomorrow);
      if (age < pref.age_min || age > pref.age_max) return false;
    }
    return !seen.has(pairKey(viewer.id, person.id));
  }

  const appearances = new Map<string, number>();
  const writes: D1PreparedStatement[] = [];
  for (const viewer of people) {
    writes.push(db.prepare(`delete from drops where user_id = ? and drop_date = ?`).bind(viewer.id, tomorrow));
  }
  for (const viewer of active) {
    const picks = active
      .filter((person) => suits(viewer, person) && (appearances.get(person.id) ?? 0) < MAX_APPEARANCES)
      .sort((a, b) => rank(`${tomorrow}:${viewer.id}:${a.id}`) - rank(`${tomorrow}:${viewer.id}:${b.id}`))
      .slice(0, PICKS);
    if (!picks.length) continue;
    const dropId = crypto.randomUUID();
    writes.push(db.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, ?)`).bind(dropId, viewer.id, tomorrow));
    picks.forEach((person, i) => {
      appearances.set(person.id, (appearances.get(person.id) ?? 0) + 1);
      writes.push(
        db.prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, ?)`).bind(dropId, person.id, i + 1),
      );
    });
  }
  for (let i = 0; i < writes.length; i += WRITE_CHUNK) {
    await db.batch(writes.slice(i, i + WRITE_CHUNK));
  }
  return tomorrow;
}
