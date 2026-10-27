import { canSee } from "./policy";
import { addDays, ageYears, istDate } from "./time";

type Person = { id: string; dob: string | null; area: string | null };

async function away(db: D1Database, userId: string, today: string) {
  const row = await db
    .prepare(`select 1 as n from away_status where user_id = ? and (until is null or until >= ?)`)
    .bind(userId, today)
    .first();
  return Boolean(row);
}

async function seenRecently(db: D1Database, userId: string, personId: string, since: string, before: string) {
  const row = await db
    .prepare(
      `select 1 as n from drop_picks dp
       join drops d on d.id = dp.drop_id
       where d.user_id = ? and dp.person_id = ? and d.drop_date > ? and d.drop_date < ?`,
    )
    .bind(userId, personId, since, before)
    .first();
  return Boolean(row);
}

function areasOf(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function buildTomorrowDrop(db: D1Database, now = new Date()) {
  const today = istDate(now);
  const tomorrow = addDays(today, 1);
  const since = addDays(tomorrow, -14);
  const viewers = await db
    .prepare(
      `select id from profiles p
       where p.verified = 1 and p.paused = 0 and p.deleted_at is null
         and not exists (select 1 from bans b where b.user_id = p.id)
       order by p.id`,
    )
    .all<{ id: string }>();
  const people = await db
    .prepare(`select id, dob, area from profiles order by id`)
    .all<Person>();

  for (const viewer of viewers.results) {
    if (await away(db, viewer.id, today)) continue;
    const prefs = await db
      .prepare(`select areas, age_min, age_max from preferences where user_id = ?`)
      .bind(viewer.id)
      .first<{ areas: string; age_min: number; age_max: number }>();
    const areas = areasOf(prefs?.areas ?? null);
    const picks: string[] = [];
    for (const person of people.results) {
      if (person.id === viewer.id) continue;
      if (!(await canSee(db, viewer.id, person.id))) continue;
      if (await away(db, person.id, today)) continue;
      if (areas.length && !areas.includes(person.area ?? "")) continue;
      if (prefs && person.dob) {
        const age = ageYears(person.dob, tomorrow);
        if (age < prefs.age_min || age > prefs.age_max) continue;
      }
      if (await seenRecently(db, viewer.id, person.id, since, tomorrow)) continue;
      picks.push(person.id);
      if (picks.length === 3) break;
    }
    await db.prepare(`delete from drops where user_id = ? and drop_date = ?`).bind(viewer.id, tomorrow).run();
    if (!picks.length) continue;
    const dropId = crypto.randomUUID();
    await db.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, ?)`).bind(dropId, viewer.id, tomorrow).run();
    for (let i = 0; i < picks.length; i += 1) {
      await db
        .prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, ?)`)
        .bind(dropId, picks[i], i + 1)
        .run();
    }
  }
  return tomorrow;
}
