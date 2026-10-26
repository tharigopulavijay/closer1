import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { asService, asUser, createTestDb } from "./setup";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const S = "44444444-4444-4444-8444-444444444444";
const U = "55555555-5555-4555-8555-555555555555";
const T = "66666666-6666-4666-8666-666666666666";
const V = "77777777-7777-4777-8777-777777777777";
const O1 = "88888888-8888-4888-8888-888888888881";
const O2 = "88888888-8888-4888-8888-888888888882";
const O3 = "88888888-8888-4888-8888-888888888883";

const USERS: [string, string, boolean][] = [
  [A, "hash-a", true],
  [B, "hash-b", true],
  [C, "hash-c", true],
  [S, "hash-s", true],
  [U, "hash-u", false],
  [T, "hash-t", true],
  [V, "hash-v", true],
  [O1, "hash-o1", true],
  [O2, "hash-o2", true],
  [O3, "hash-o3", true],
];

let db: PGlite;

async function visible(viewer: string, target: string) {
  const result = await asUser(db, viewer, (tx) =>
    tx.query<{ id: string }>(`select id from public.profiles where id = $1`, [target]),
  );
  return result.rows.length;
}

async function count(sql: string, params: unknown[] = []) {
  const result = await db.query<{ n: number }>(sql, params);
  return Number(result.rows[0]?.n ?? 0);
}

describe("database rules", () => {
  beforeAll(async () => {
    db = await createTestDb();
  }, 120_000);

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.exec(`
      insert into auth.users (id)
      values
        ('${A}'), ('${B}'), ('${C}'), ('${S}'), ('${U}'),
        ('${T}'), ('${V}'), ('${O1}'), ('${O2}'), ('${O3}')
      on conflict (id) do nothing;

      truncate table
        public.messages,
        public.deposits,
        public.debriefs,
        public.safety_sessions,
        public.sos_events,
        public.plans,
        public.likes,
        public.matches,
        public.drop_picks,
        public.drops,
        public.gift_claims,
        public.strikes,
        public.bans,
        public.reports,
        public.audit_log,
        public.streaks,
        public.blocks,
        public.contact_hashes,
        public.contact_allowlist,
        public.trusted_contacts,
        public.away_status,
        public.social_connections,
        public.profile_photos,
        public.voice_answers,
        public.preferences,
        public.profiles
      restart identity cascade;
    `);

    for (const [id, phone, verified] of USERS) {
      await db.query(
        `insert into public.profiles (id, display_name, dob, phone_hash, verified, hide_from_contacts)
         values ($1, $2, '1995-01-01', $3, $4, false)`,
        [id, id.slice(0, 8), phone, verified],
      );
    }
    await db.query(`insert into public.bans (user_id, reason) values ($1, 'seed')`, [C]);
  });

  it("fix 1 and 11: A reads B only when B is visible, and the profile query does not recurse", async () => {
    expect(await visible(A, B)).toBe(1);
    await expect(asUser(db, A, (tx) => tx.query(`select id from public.profiles`))).resolves.toBeTruthy();

    await asService(db, (tx) => tx.query(`update public.profiles set verified = false where id = $1`, [B]));
    expect(await visible(A, B)).toBe(0);
    await expect(asUser(db, A, (tx) => tx.query(`select id from public.profiles`))).resolves.toBeTruthy();
    await asService(db, (tx) => tx.query(`update public.profiles set verified = true where id = $1`, [B]));

    await db.query(`insert into public.blocks (blocker, blocked) values ($1, $2)`, [A, B]);
    expect(await visible(A, B)).toBe(0);
    await db.query(`delete from public.blocks`);
    await db.query(`insert into public.blocks (blocker, blocked) values ($1, $2)`, [B, A]);
    expect(await visible(A, B)).toBe(0);
    await db.query(`delete from public.blocks`);

    await db.query(`update public.profiles set hide_from_contacts = true where id = $1`, [B]);
    await db.query(`insert into public.contact_hashes (owner_id, hash) values ($1, 'hash-a')`, [B]);
    expect(await visible(A, B)).toBe(0);
    await db.query(`insert into public.contact_allowlist (owner_id, hash) values ($1, 'hash-a')`, [B]);
    expect(await visible(A, B)).toBe(1);

    expect(await visible(U, B)).toBe(0);
    expect(await visible(U, U)).toBe(1);
    expect(await visible(C, B)).toBe(0);
    expect(await visible(C, C)).toBe(1);

    await db.query(
      `insert into public.profile_photos (user_id, storage_path) values ($1, 'b.jpg'), ($2, 'u.jpg')`,
      [B, U],
    );
    const stranger = await asUser(db, U, (tx) =>
      tx.query(`select user_id from public.profile_photos where user_id = $1`, [B]),
    );
    const own = await asUser(db, U, (tx) =>
      tx.query(`select user_id from public.profile_photos where user_id = $1`, [U]),
    );
    const allowed = await asUser(db, A, (tx) =>
      tx.query(`select user_id from public.profile_photos where user_id = $1`, [B]),
    );
    expect(stranger.rows).toHaveLength(0);
    expect(own.rows).toHaveLength(1);
    expect(allowed.rows).toHaveLength(1);
  });

  it("fix 3 and 4: likes, plans, reports and messages reject a banned user and a person outside the drop", async () => {
    await expect(asUser(db, C, (tx) => tx.query(`select public.send_like($1::uuid)`, [B]))).rejects.toThrow(/banned/);
    await expect(
      asUser(db, C, (tx) => tx.query(`select public.create_plan($1::uuid, 'heartcup', 'Sat', 'coffee')`, [B])),
    ).rejects.toThrow(/banned/);
    await expect(
      asUser(db, C, (tx) =>
        tx.query(
          `insert into public.reports (reporter_id, against_id, category, detail) values ($1, $2, 'Spam', 'no')`,
          [C, B],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(db, C, (tx) => tx.query(`select public.send_message($1::uuid, 'hello')`, [A])),
    ).rejects.toThrow(/banned/);

    await expect(asUser(db, A, (tx) => tx.query(`select public.send_like($1::uuid)`, [B]))).rejects.toThrow(
      /not in drop/,
    );
    await expect(
      asUser(db, A, (tx) => tx.query(`insert into public.likes (from_id, to_id) values ($1, $2)`, [A, B])),
    ).rejects.toThrow(/permission denied/);

    const drop = await db.query<{ id: string }>(
      `insert into public.drops (user_id, drop_date) values ($1, current_date) returning id`,
      [A],
    );
    await db.query(`insert into public.drop_picks (drop_id, person_id, position) values ($1, $2, 1)`, [
      drop.rows[0]?.id,
      B,
    ]);
    await asUser(db, A, (tx) => tx.query(`select public.send_like($1::uuid)`, [B]));
    expect(await count(`select count(*)::int as n from public.likes where from_id = $1 and to_id = $2`, [A, B])).toBe(
      1,
    );

    await db.query(`delete from public.likes`);
    await db.query(`delete from public.drop_picks`);
    await db.query(`insert into public.social_connections (user_id, person_id, source) values ($1, $2, 'play')`, [
      A,
      B,
    ]);
    await asUser(db, A, (tx) => tx.query(`select public.send_like($1::uuid)`, [B]));
    expect(await count(`select count(*)::int as n from public.likes where from_id = $1`, [A])).toBe(1);
  });

  it("fix 6 and 7: chat follows the paid booking clock, and the client cannot mark a deposit paid", async () => {
    await db.query(
      `insert into public.matches (user_a, user_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`,
      [A, B],
    );
    const created = await asUser(db, A, (tx) =>
      tx.query<{ create_plan: string }>(
        `select public.create_plan($1::uuid, 'heartcup', 'Sat · 8:00 pm', 'coffee') as create_plan`,
        [B],
      ),
    );
    const plan = created.rows[0]?.create_plan;
    expect(plan).toBeTruthy();

    await expect(asUser(db, A, (tx) => tx.query(`select public.send_message($1::uuid, 'chai?')`, [plan]))).rejects.toThrow(
      /chat closed/,
    );
    await expect(asUser(db, A, (tx) => tx.query(`update public.deposits set status = 'paid'`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asUser(db, A, (tx) => tx.query(`select public.mark_deposit_paid($1::uuid, 'pay_1')`, [plan]))).rejects.toThrow(
      /permission denied/,
    );

    await asService(db, (tx) => tx.query(`select public.mark_deposit_paid($1::uuid, 'pay_1')`, [plan]));
    await asService(db, (tx) => tx.query(`select public.mark_deposit_paid($1::uuid, 'pay_1')`, [plan]));
    expect(await count(`select count(*)::int as n from public.deposits where plan_id = $1 and status = 'paid'`, [plan])).toBe(
      1,
    );
    expect(await count(`select count(*)::int as n from public.plans where id = $1 and booked_at is not null`, [plan])).toBe(
      1,
    );

    await asUser(db, A, (tx) => tx.query(`select public.send_message($1::uuid, 'chai?')`, [plan]));
    expect(await count(`select count(*)::int as n from public.messages where plan_id = $1`, [plan])).toBe(1);

    await db.query(`update public.plans set booked_at = now() - interval '49 hours' where id = $1`, [plan]);
    await expect(asUser(db, A, (tx) => tx.query(`select public.send_message($1::uuid, 'still there?')`, [plan]))).rejects.toThrow(
      /chat closed/,
    );

    await asUser(db, A, (tx) => tx.query(`select public.keep_chat($1::uuid)`, [plan]));
    await asUser(db, B, (tx) => tx.query(`select public.keep_chat($1::uuid)`, [plan]));
    await asUser(db, A, (tx) => tx.query(`select public.send_message($1::uuid, 'kept')`, [plan]));
    expect(await count(`select count(*)::int as n from public.messages where plan_id = $1`, [plan])).toBe(2);
  });

  it("fix 8: a gift above the streak or the same milestone twice is refused", async () => {
    await db.query(
      `insert into public.streaks (user_id, count, last_date, freezes_left, freeze_month)
       values ($1, 100, current_date, 2, '2026-10')`,
      [A],
    );
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.claim_gift(7, 'mug', 'Hyderabad')`)),
    ).rejects.toThrow(/closer plus only/);

    await db.query(`update public.profiles set closer_plus = true where id = $1`, [A]);
    await db.query(`update public.streaks set count = 7 where user_id = $1`, [A]);
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.claim_gift(30, 'mug', 'Hyderabad')`)),
    ).rejects.toThrow(/streak too low/);
    await asUser(db, A, (tx) => tx.query(`select public.claim_gift(7, 'mug', 'Hyderabad')`));
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.claim_gift(7, 'mug', 'Hyderabad')`)),
    ).rejects.toThrow(/already claimed/);
    expect(await count(`select count(*)::int as n from public.gift_claims where user_id = $1`, [A])).toBe(1);
  });

  it("fix 9: only safety can confirm, the third minor strike bans, and one severe strike bans", async () => {
    const report = async (against: string, severe: boolean) => {
      const result = await db.query<{ id: string }>(
        `insert into public.reports (reporter_id, against_id, category, severe, detail)
         values ($1, $2, $3, $4, 'detail') returning id`,
        [B, against, severe ? "Threats" : "Rude", severe],
      );
      return result.rows[0]?.id as string;
    };

    const first = await report(T, false);
    await expect(asUser(db, A, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [first]))).rejects.toThrow(
      /safety only/,
    );
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [first]), ["ops"]),
    ).rejects.toThrow(/safety only/);

    await asUser(db, S, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [first]), ["safety"]);
    const second = await report(T, false);
    await asUser(db, S, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [second]), ["safety"]);
    expect(await count(`select count(*)::int as n from public.bans where user_id = $1`, [T])).toBe(0);
    expect(await count(`select count(*)::int as n from public.strikes where user_id = $1`, [T])).toBe(2);

    const third = await report(T, false);
    await asUser(db, S, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [third]), ["safety"]);
    expect(await count(`select count(*)::int as n from public.bans where user_id = $1 and reason = 'third strike'`, [T])).toBe(
      1,
    );
    expect(await count(`select count(*)::int as n from public.audit_log where action = 'confirm report'`)).toBe(3);

    const severe = await report(V, true);
    await asUser(db, S, (tx) => tx.query(`select public.confirm_report($1::uuid, 'confirm')`, [severe]), ["safety"]);
    expect(await count(`select count(*)::int as n from public.bans where user_id = $1 and reason = 'severe'`, [V])).toBe(1);
    expect(await count(`select count(*)::int as n from public.strikes where user_id = $1`, [V])).toBe(1);

    await asService(db, (tx) =>
      tx.query(
        `insert into public.reports (reporter_id, against_id, category, severe, detail, source)
         values ($1, $2, 'Rude', false, 'model', 'ai')`,
        [B, O1],
      ),
    );
    expect(await count(`select count(*)::int as n from public.strikes where user_id = $1`, [O1])).toBe(0);
  });

  it("fix 12: under-18 dates are rejected and a verified date of birth stays put", async () => {
    await expect(db.query(`update public.profiles set dob = '2015-01-01' where id = $1`, [U])).rejects.toThrow(/under 18/);
    await asUser(db, U, (tx) => tx.query(`update public.profiles set dob = '1992-05-05' where id = $1`, [U]));
    const updated = await db.query<{ dob: string }>(`select dob::text as dob from public.profiles where id = $1`, [U]);
    expect(updated.rows[0]?.dob).toBe("1992-05-05");
    await expect(
      asUser(db, A, (tx) => tx.query(`update public.profiles set dob = '1990-01-01' where id = $1`, [A])),
    ).rejects.toThrow(/protected field/);
  });

  it("fix 13: activity, away, and the two monthly freezes follow the streak rules", async () => {
    await db.query(
      `insert into public.streaks (user_id, count, last_date, freezes_left, freeze_month, frozen_by_away)
       values ($1, 23, (timezone('Asia/Kolkata', now()))::date - 2, 2, to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'), false)`,
      [A],
    );
    const reset = await asUser(db, A, (tx) => tx.query<{ record_activity: number }>(`select public.record_activity('drop') as record_activity`));
    expect(Number(reset.rows[0]?.record_activity)).toBe(1);

    await db.query(
      `update public.streaks
       set count = 23,
           last_date = (timezone('Asia/Kolkata', now()))::date - 2,
           freezes_left = 2,
           frozen_by_away = false
       where user_id = $1`,
      [A],
    );
    await db.query(`insert into public.away_status (user_id, kind) values ($1, 'trip')`, [A]);
    const frozen = await asUser(db, A, (tx) =>
      tx.query<{ record_activity: number }>(`select public.record_activity('room') as record_activity`),
    );
    expect(Number(frozen.rows[0]?.record_activity)).toBe(23);
    expect(await count(`select count(*)::int as n from public.streaks where user_id = $1 and frozen_by_away`, [A])).toBe(1);

    await db.query(`delete from public.away_status`);
    await db.query(
      `update public.streaks
       set count = 23,
           last_date = (timezone('Asia/Kolkata', now()))::date - 2,
           freezes_left = 0,
           freeze_month = '1999-01',
           frozen_by_away = false
       where user_id = $1`,
      [A],
    );
    await asUser(db, A, (tx) => tx.query(`select public.record_activity('play')`));
    const freezes = await db.query<{ freezes_left: number }>(
      `select freezes_left from public.streaks where user_id = $1`,
      [A],
    );
    expect(Number(freezes.rows[0]?.freezes_left)).toBe(2);

    await db.query(
      `update public.streaks
       set count = 23,
           last_date = (timezone('Asia/Kolkata', now()))::date - 2,
           freezes_left = 2,
           freeze_month = to_char(timezone('Asia/Kolkata', now()), 'YYYY-MM'),
           frozen_by_away = false
       where user_id = $1`,
      [A],
    );
    await asUser(db, A, (tx) => tx.query(`select public.record_activity('freeze')`));
    const covered = await db.query<{ freezes_left: number; gap: number }>(
      `select freezes_left, ((timezone('Asia/Kolkata', now()))::date - last_date) as gap
       from public.streaks where user_id = $1`,
      [A],
    );
    expect(Number(covered.rows[0]?.freezes_left)).toBe(1);
    expect(Number(covered.rows[0]?.gap)).toBe(1);
  });

  it("fix 14: the open-plan cap counts either seat and blocks a second plan with the same person", async () => {
    await db.query(
      `insert into public.matches (user_a, user_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`,
      [A, B],
    );
    for (const owner of [O1, O2, O3]) {
      await db.query(
        `insert into public.plans (owner_id, person_id, venue_id, slot, kind, status)
         values ($1, $2, 'heartcup', 'Sat · 8:00 pm', 'coffee', 'upcoming')`,
        [owner, A],
      );
    }
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.create_plan($1::uuid, 'heartcup', 'Sat · 8:00 pm', 'coffee')`, [B])),
    ).rejects.toThrow(/open plan limit/);

    await db.query(`delete from public.plans`);
    await asUser(db, A, (tx) => tx.query(`select public.create_plan($1::uuid, 'heartcup', 'Sat · 8:00 pm', 'coffee')`, [B]));
    await expect(
      asUser(db, A, (tx) => tx.query(`select public.create_plan($1::uuid, 'heartcup', 'Sun · 5:00 pm', 'walk')`, [B])),
    ).rejects.toThrow(/duplicate open plan/);
  });

  it("fix 15: deleting A's account succeeds and keeps reports and strikes against A", async () => {
    const report = await db.query<{ id: string }>(
      `insert into public.reports (reporter_id, against_id, category, severe, detail)
       values ($1, $2, 'Rude', false, 'kept') returning id`,
      [B, A],
    );
    await db.query(`insert into public.strikes (report_id, user_id, category) values ($1, $2, 'Rude')`, [
      report.rows[0]?.id,
      A,
    ]);
    await db.query(`insert into public.sos_events (user_id) values ($1)`, [A]);

    await asUser(db, A, (tx) => tx.query(`select public.delete_account()`));

    expect(await count(`select count(*)::int as n from public.profiles where id = $1`, [A])).toBe(0);
    expect(await count(`select count(*)::int as n from public.reports where against_id = $1`, [A])).toBe(1);
    expect(await count(`select count(*)::int as n from public.strikes where user_id = $1`, [A])).toBe(1);
    expect(await count(`select count(*)::int as n from public.sos_events where user_id = $1`, [A])).toBe(1);
  });

  it("fix 16: confirmed contacts, debriefs and report status cannot be self-set", async () => {
    await expect(
      asUser(db, A, (tx) =>
        tx.query(
          `insert into public.trusted_contacts (user_id, name, phone_hash, confirmed) values ($1, 'Amma', 'h', true)`,
          [A],
        ),
      ),
    ).rejects.toThrow(/confirm via link|row-level security/);

    const contact = await asUser(db, A, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.trusted_contacts (user_id, name, phone_hash, confirmed)
         values ($1, 'Amma', 'h', false) returning id`,
        [A],
      ),
    );
    const contactId = contact.rows[0]?.id;
    await expect(
      asUser(db, A, (tx) => tx.query(`update public.trusted_contacts set confirmed = true where id = $1`, [contactId])),
    ).rejects.toThrow(/confirm via link/);
    await db.query(`update public.trusted_contacts set confirm_token = 'sms-token' where id = $1`, [contactId]);
    await asUser(db, A, (tx) => tx.query(`select public.confirm_trusted_contact('sms-token')`));
    expect(await count(`select count(*)::int as n from public.trusted_contacts where id = $1 and confirmed`, [contactId])).toBe(
      1,
    );

    const foreign = await db.query<{ id: string }>(
      `insert into public.plans (owner_id, person_id, venue_id, slot, kind)
       values ($1, $2, 'heartcup', 'Sat · 8:00 pm', 'coffee') returning id`,
      [O1, B],
    );
    await expect(
      asUser(db, A, (tx) =>
        tx.query(`insert into public.debriefs (plan_id, user_id, feel, again) values ($1, $2, 'good', 'yes')`, [
          foreign.rows[0]?.id,
          A,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      asUser(db, A, (tx) =>
        tx.query(
          `insert into public.reports (reporter_id, against_id, category, detail, status)
           values ($1, $2, 'Spam', 'x', 'confirmed')`,
          [A, B],
        ),
      ),
    ).rejects.toThrow(/status is server owned/);
  });

  it("fix 18: photo, voice and selfie buckets are private and only the owner can write", async () => {
    const buckets = await db.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets order by id`,
    );
    expect(buckets.rows.map((row) => row.id)).toEqual(["photos", "selfies", "voice"]);
    expect(buckets.rows.every((row) => row.public === false)).toBe(true);

    await asUser(db, A, (tx: Transaction) =>
      tx.query(`insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${A}/pic.jpg`]),
    );
    const own = await asUser(db, A, (tx) => tx.query(`select name from storage.objects`));
    const other = await asUser(db, B, (tx) => tx.query(`select name from storage.objects`));
    const signed = await asService(db, (tx) => tx.query(`select name from storage.objects`));
    expect(own.rows).toHaveLength(1);
    expect(other.rows).toHaveLength(0);
    expect(signed.rows).toHaveLength(1);
    await expect(
      asUser(db, A, (tx) => tx.query(`insert into storage.objects (bucket_id, name) values ('voice', $1)`, [`${B}/clip.webm`])),
    ).rejects.toThrow(/row-level security/);
  });
});
