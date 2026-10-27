import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { deliverMessage, insertAiReport } from "../src/policy";
import { A, B, C, O1, O2, O3, S, T, U, V, api, count, login, reset, sendForm, tinyPng } from "./harness";

let token: Record<string, string>;

beforeEach(async () => {
  await reset();
  token = {
    [A]: await login(A),
    [B]: await login(B),
    [C]: await login(C),
    [S]: await login(S),
    [U]: await login(U),
    [T]: await login(T),
    [V]: await login(V),
  };
});

async function match(left: string, right: string) {
  const [userA, userB] = left < right ? [left, right] : [right, left];
  await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), userA, userB, new Date().toISOString())
    .run();
}

describe("database rules over HTTP", () => {
  it("fix 1 and 11: A reads B only when B is visible", async () => {
    // A stranger with no Drop, like or match cannot read or list B.
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(404);
    expect((await api("/profiles", { token: token[A] })).json).toEqual({ ids: [] });
    const dropId = crypto.randomUUID();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, '2026-10-27')`).bind(dropId, A).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, 1)`).bind(dropId, B).run();
    expect((await api(`/profiles/${B}`, { token: token[T] })).status).toBe(404);

    const seen = await api(`/profiles/${B}`, { token: token[A] });
    expect(seen.status).toBe(200);
    expect(seen.json).not.toHaveProperty("dob");
    expect((seen.json as { age: number }).age).toBeGreaterThanOrEqual(18);
    expect((await api("/profiles", { token: token[A] })).json).toEqual({ ids: [B] });
    expect((await api("/profiles", { token: token[A] })).status).toBe(200);

    await env.DB.prepare(`update profiles set verified = 0 where id = ?`).bind(B).run();
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(404);
    expect((await api("/profiles", { token: token[A] })).status).toBe(200);
    await env.DB.prepare(`update profiles set verified = 1 where id = ?`).bind(B).run();

    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(A, B).run();
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(404);
    await env.DB.prepare(`delete from blocks`).run();
    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(B, A).run();
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(404);
    await env.DB.prepare(`delete from blocks`).run();

    await env.DB.prepare(`update profiles set hide_from_contacts = 1 where id = ?`).bind(B).run();
    await env.DB.prepare(`insert into contact_hashes (owner_id, hash) values (?, 'hash-a')`).bind(B).run();
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(404);
    await env.DB.prepare(`insert into contact_allowlist (owner_id, hash) values (?, 'hash-a')`).bind(B).run();
    expect((await api(`/profiles/${B}`, { token: token[A] })).status).toBe(200);

    expect((await api(`/profiles/${B}`, { token: token[U] })).status).toBe(404);
    expect((await api(`/profiles/${U}`, { token: token[U] })).status).toBe(200);
    expect((await api(`/profiles/${B}`, { token: token[C] })).status).toBe(404);
    expect((await api(`/profiles/${C}`, { token: token[C] })).status).toBe(200);

    await env.DB.prepare(`insert into profile_photos (id, user_id, storage_path) values (?, ?, 'b.jpg'), (?, ?, 'u.jpg')`)
      .bind(crypto.randomUUID(), B, crypto.randomUUID(), U)
      .run();
    const stranger = await api(`/profiles/${B}/photos`, { token: token[U] });
    const own = await api(`/profiles/${U}/photos`, { token: token[U] });
    const allowed = await api(`/profiles/${B}/photos`, { token: token[A] });
    expect((stranger.json as { photos: unknown[] }).photos).toHaveLength(0);
    expect((own.json as { photos: unknown[] }).photos).toHaveLength(1);
    expect((allowed.json as { photos: unknown[] }).photos).toHaveLength(1);
  });

  it("fix 3 and 4: likes, plans and reports reject a banned user and a person outside the drop", async () => {
    expect((await api("/likes", { token: token[C], body: { personId: B } })).text).toMatch(/banned/);
    expect((await api("/plans", { token: token[C], body: { personId: B, venueId: "heartcup", slot: "Sat", kind: "coffee" } })).text).toMatch(/banned/);
    expect((await api("/reports", { token: token[C], body: { againstId: B, category: "Spam", detail: "no" } })).status).toBeGreaterThanOrEqual(400);
    await expect(deliverMessage(env.DB, C, A, "hello")).rejects.toThrow(/banned/);

    expect((await api("/likes", { token: token[A], body: { personId: B } })).text).toMatch(/not in drop/);

    const dropId = crypto.randomUUID();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, date('now'))`).bind(dropId, A).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, 1)`).bind(dropId, B).run();
    expect((await api("/likes", { token: token[A], body: { personId: B } })).status).toBe(200);
    expect(await count(`select count(*) as n from likes where from_id = ? and to_id = ?`, A, B)).toBe(1);

    await env.DB.prepare(`delete from likes`).run();
    await env.DB.prepare(`delete from drop_picks`).run();
    await env.DB.prepare(`insert into social_connections (user_id, person_id, source) values (?, ?, 'play')`).bind(A, B).run();
    expect((await api("/likes", { token: token[A], body: { personId: B } })).status).toBe(200);
    expect(await count(`select count(*) as n from likes where from_id = ?`, A)).toBe(1);
  });

  it("fix 6 and 7: chat follows the paid booking clock, and the client cannot mark a deposit paid", async () => {
    await match(A, B);
    const created = await api("/plans", { token: token[A], body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" } });
    const plan = (created.json as { id: string; deposit: string }).id;
    expect(created.status).toBe(200);
    expect((created.json as { deposit: string }).deposit).toBe("unpaid");

    await expect(deliverMessage(env.DB, A, plan, "chai?")).rejects.toThrow(/chat closed/);
    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", token: token[A], body: { paymentId: "pay_1", userId: A } })).text).toMatch(/permission denied/);

    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_1", userId: A } })).status).toBe(200);
    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_1", userId: A } })).status).toBe(200);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`, plan)).toBe(1);
    expect(await count(`select count(*) as n from plans where id = ? and booked_at is not null`, plan)).toBe(0);
    await expect(deliverMessage(env.DB, A, plan, "too soon")).rejects.toThrow(/chat closed/);

    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_2", userId: B } })).status).toBe(200);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`, plan)).toBe(2);
    expect(await count(`select count(*) as n from plans where id = ? and booked_at is not null`, plan)).toBe(1);

    expect((await api("/messages", { method: "POST", token: token[A], body: { planId: plan, body: "chai?" } })).status).toBe(404);
    await expect(deliverMessage(env.DB, V, plan, "hi")).rejects.toThrow(/not in plan/);
    await deliverMessage(env.DB, A, plan, "chai?");
    expect(await count(`select count(*) as n from messages where plan_id = ?`, plan)).toBe(1);

    await env.DB.prepare(`update plans set booked_at = ? where id = ?`)
      .bind(new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(), plan)
      .run();
    await expect(deliverMessage(env.DB, A, plan, "still there?")).rejects.toThrow(/chat closed/);
    expect((await api(`/plans/${plan}/keep`, { method: "POST", token: token[A] })).status).toBe(200);
    expect((await api(`/plans/${plan}/keep`, { method: "POST", token: token[B] })).status).toBe(200);
    await deliverMessage(env.DB, A, plan, "kept");
    expect(await count(`select count(*) as n from messages where plan_id = ?`, plan)).toBe(2);
  });

  it("fix 8: a gift above the streak or the same milestone twice is refused", async () => {
    await env.DB.prepare(
      `insert into streaks (user_id, count, last_date, freezes_left, freeze_month) values (?, 100, date('now'), 2, '2026-10')`,
    ).bind(A).run();
    expect((await api("/gifts/claim", { token: token[A], body: { milestone: 7, gift: "mug", address: "Hyderabad" } })).text).toMatch(/closer plus only/);
    expect((await api("/me", { method: "PATCH", token: token[A], body: { closerPlus: true } })).text).toMatch(/protected field/);
    await env.DB.prepare(`update profiles set closer_plus = 1 where id = ?`).bind(A).run();
    await env.DB.prepare(`update streaks set count = 7 where user_id = ?`).bind(A).run();
    expect((await api("/gifts/claim", { token: token[A], body: { milestone: 30, gift: "mug", address: "Hyderabad" } })).text).toMatch(/streak too low/);
    expect((await api("/gifts/claim", { token: token[A], body: { milestone: 7, gift: "mug", address: "Hyderabad" } })).status).toBe(200);
    expect((await api("/gifts/claim", { token: token[A], body: { milestone: 7, gift: "mug", address: "Hyderabad" } })).text).toMatch(/already claimed/);
    expect(await count(`select count(*) as n from gift_claims where user_id = ?`, A)).toBe(1);
  });

  it("fix 9: only safety can confirm, the third minor strike bans, and one severe strike bans", async () => {
    const report = async (against: string, severe: boolean) => {
      const result = await env.DB.prepare(
        `insert into reports (id, reporter_id, against_id, category, severe, detail, created_at) values (?, ?, ?, ?, ?, 'detail', ?) returning id`,
      )
        .bind(crypto.randomUUID(), B, against, severe ? "Threats" : "Rude", severe ? 1 : 0, new Date().toISOString())
        .first<{ id: string }>();
      return result?.id as string;
    };
    const first = await report(T, false);
    expect((await api(`/admin/reports/${first}/confirm`, { token: token[A], body: { action: "confirm" } })).text).toMatch(/safety only/);
    await env.DB.prepare(`insert into staff_roles (user_id, role) values (?, 'ops')`).bind(A).run();
    expect((await api(`/admin/reports/${first}/confirm`, { token: token[A], body: { action: "confirm" } })).text).toMatch(/safety only/);
    expect((await api(`/admin/reports/${first}/confirm`, { token: token[S], body: { action: "confirm" } })).status).toBe(200);
    const second = await report(T, false);
    expect((await api(`/admin/reports/${second}/confirm`, { token: token[S], body: { action: "confirm" } })).status).toBe(200);
    expect(await count(`select count(*) as n from bans where user_id = ?`, T)).toBe(0);
    expect(await count(`select count(*) as n from strikes where user_id = ?`, T)).toBe(2);
    const third = await report(T, false);
    expect((await api(`/admin/reports/${third}/confirm`, { token: token[S], body: { action: "confirm" } })).status).toBe(200);
    expect(await count(`select count(*) as n from bans where user_id = ? and reason = 'third strike'`, T)).toBe(1);
    expect(await count(`select count(*) as n from audit_log where action = 'confirm report'`)).toBe(3);
    const severe = await report(V, true);
    expect((await api(`/admin/reports/${severe}/confirm`, { token: token[S], body: { action: "confirm" } })).status).toBe(200);
    expect(await count(`select count(*) as n from bans where user_id = ? and reason = 'severe'`, V)).toBe(1);
    expect(await count(`select count(*) as n from strikes where user_id = ?`, V)).toBe(1);
    await insertAiReport(env.DB, B, O1, "Rude", "model");
    expect(await count(`select count(*) as n from strikes where user_id = ?`, O1)).toBe(0);
  });

  it("fix 12: under-18 dates are rejected and a verified date of birth stays put", async () => {
    await expect(env.DB.prepare(`update profiles set dob = '2015-01-01' where id = ?`).bind(U).run()).rejects.toThrow(/under 18/);
    expect((await api("/me", { method: "PATCH", token: token[U], body: { dob: "1992-05-05" } })).status).toBe(200);
    const updated = await env.DB.prepare(`select dob from profiles where id = ?`).bind(U).first<{ dob: string }>();
    expect(updated?.dob).toBe("1992-05-05");
    expect((await api("/me", { method: "PATCH", token: token[A], body: { dob: "1990-01-01" } })).text).toMatch(/protected field/);
  });

  it("fix 13: activity, away, and the two monthly freezes follow the streak rules", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const month = today.slice(0, 7);
    const minus = (days: number) => {
      const [year, mon, day] = today.split("-").map(Number);
      const date = new Date(Date.UTC(year, (mon ?? 1) - 1, day ?? 1));
      date.setUTCDate(date.getUTCDate() - days);
      return date.toISOString().slice(0, 10);
    };
    await env.DB.prepare(
      `insert into streaks (user_id, count, last_date, freezes_left, freeze_month, frozen_by_away) values (?, 23, ?, 2, ?, 0)`,
    ).bind(A, minus(2), month).run();
    const resetCount = await api("/streak/activity", { token: token[A], body: { kind: "drop" } });
    expect((resetCount.json as { count: number }).count).toBe(1);

    await env.DB.prepare(`update streaks set count = 23, last_date = ?, freezes_left = 2, frozen_by_away = 0 where user_id = ?`).bind(minus(2), A).run();
    expect((await api("/away", { token: token[A], body: { kind: "trip" } })).status).toBe(200);
    const frozen = await api("/streak/activity", { token: token[A], body: { kind: "room" } });
    expect((frozen.json as { count: number }).count).toBe(23);
    expect(await count(`select count(*) as n from streaks where user_id = ? and frozen_by_away = 1`, A)).toBe(1);

    await env.DB.prepare(`delete from away_status`).run();
    await env.DB.prepare(
      `update streaks set count = 23, last_date = ?, freezes_left = 0, freeze_month = '1999-01', frozen_by_away = 0 where user_id = ?`,
    ).bind(minus(2), A).run();
    expect((await api("/streak/activity", { token: token[A], body: { kind: "play" } })).status).toBe(200);
    const freezes = await env.DB.prepare(`select freezes_left from streaks where user_id = ?`).bind(A).first<{ freezes_left: number }>();
    expect(Number(freezes?.freezes_left)).toBe(2);

    await env.DB.prepare(
      `update streaks set count = 23, last_date = ?, freezes_left = 2, freeze_month = ?, frozen_by_away = 0 where user_id = ?`,
    ).bind(minus(2), month, A).run();
    expect((await api("/streak/activity", { token: token[A], body: { kind: "freeze" } })).status).toBe(200);
    const covered = await env.DB.prepare(`select freezes_left, last_date from streaks where user_id = ?`).bind(A).first<{ freezes_left: number; last_date: string }>();
    expect(Number(covered?.freezes_left)).toBe(1);
    expect(covered?.last_date).toBe(minus(1));
  });

  it("fix 14: the open-plan cap counts either seat and blocks a second plan with the same person", async () => {
    await match(A, B);
    for (const owner of [O1, O2, O3]) {
      await env.DB.prepare(
        `insert into plans (id, owner_id, person_id, venue_id, slot, kind, status, created_at) values (?, ?, ?, 'heartcup', 'Sat · 8:00 pm', 'coffee', 'upcoming', ?)`,
      ).bind(crypto.randomUUID(), owner, A, new Date().toISOString()).run();
    }
    expect((await api("/plans", { token: token[A], body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" } })).text).toMatch(/open plan limit/);
    await env.DB.prepare(`delete from plans`).run();
    expect((await api("/plans", { token: token[A], body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" } })).status).toBe(200);
    expect((await api("/plans", { token: token[A], body: { personId: B, venueId: "heartcup", slot: "Sun · 5:00 pm", kind: "walk" } })).text).toMatch(/duplicate open plan/);
  });

  it("fix 15: deleting A's account succeeds and keeps reports and strikes against A", async () => {
    const reportId = crypto.randomUUID();
    await env.DB.prepare(
      `insert into reports (id, reporter_id, against_id, category, severe, detail, created_at) values (?, ?, ?, 'Rude', 0, 'kept', ?)`,
    ).bind(reportId, B, A, new Date().toISOString()).run();
    await env.DB.prepare(`insert into strikes (id, report_id, user_id, category, created_at) values (?, ?, ?, 'Rude', ?)`).bind(crypto.randomUUID(), reportId, A, new Date().toISOString()).run();
    await env.DB.prepare(`insert into sos_events (id, user_id, created_at) values (?, ?, ?)`).bind(crypto.randomUUID(), A, new Date().toISOString()).run();
    expect((await api("/account", { method: "DELETE", token: token[A] })).status).toBe(200);
    expect(await count(`select count(*) as n from profiles where id = ? and deleted_at is not null and dob is null and display_name = ''`, A)).toBe(1);
    expect(await count(`select count(*) as n from sessions where user_id = ?`, A)).toBe(0);
    expect(await count(`select count(*) as n from reports where against_id = ?`, A)).toBe(1);
    expect(await count(`select count(*) as n from strikes where user_id = ?`, A)).toBe(1);
    expect(await count(`select count(*) as n from sos_events where user_id = ?`, A)).toBe(1);
  });

  it("fix 16: confirmed contacts, debriefs and report status cannot be self-set", async () => {
    expect((await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "9876543210", confirmed: true } })).text).toMatch(/confirm via link/);
    const contact = await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "9876543210", confirmed: false } });
    const contactId = (contact.json as { id: string }).id;
    expect((await api(`/trusted-contacts/${contactId}`, { method: "PATCH", token: token[A], body: { confirmed: true } })).text).toMatch(/confirm via link/);
    await api("/trusted-contacts", { token: token[A], body: { name: "Didi", phone: "9876543211", confirmToken: "mine" } });
    expect(await count(`select count(*) as n from trusted_contacts where confirm_token = 'mine'`)).toBe(0);

    expect((await api(`/service/trusted-contacts/${contactId}/token`, { method: "POST", service: true, body: { token: "sms-token" } })).status).toBe(200);
    expect((await api(`/service/trusted-contacts/${contactId}/token`, { token: token[A] })).text).toMatch(/permission denied/);
    expect((await api("/trusted-contacts/confirm", { method: "POST", token: token[A], body: { token: "sms-token" } })).text).toMatch(/permission denied/);
    expect((await api("/trusted-contacts/confirm", { method: "POST", token: token[A], service: true, body: { token: "sms-token" } })).status).toBe(200);
    expect(await count(`select count(*) as n from trusted_contacts where id = ? and confirmed = 1`, contactId)).toBe(1);
    const listed = await api("/trusted-contacts", { token: token[A] });
    expect(JSON.stringify(listed.json)).not.toMatch(/confirmToken|confirm_token|sms-token/);

    const foreign = crypto.randomUUID();
    await env.DB.prepare(
      `insert into plans (id, owner_id, person_id, venue_id, slot, kind, created_at) values (?, ?, ?, 'heartcup', 'Sat · 8:00 pm', 'coffee', ?)`,
    ).bind(foreign, O1, B, new Date().toISOString()).run();
    expect((await api(`/plans/${foreign}/debrief`, { token: token[A], body: { feel: "good", again: "yes" } })).text).toMatch(/row-level security/);
    expect((await api("/reports", { token: token[A], body: { againstId: B, category: "Spam", detail: "x", status: "confirmed" } })).text).toMatch(/status is server owned/);
  });

  it("fix 18: photo, voice and selfie buckets are private and only the owner can write", async () => {
    const buckets = await api("/media/buckets", { token: token[A] });
    const rows = (buckets.json as { buckets: { id: string; public: boolean }[] }).buckets;
    expect(rows.map((row) => row.id)).toEqual(["photos", "selfies", "voice"]);
    expect(rows.every((row) => row.public === false)).toBe(true);
    const form = new FormData();
    form.set("kind", "photo");
    form.set("file", new File([tinyPng()], "a.png", { type: "image/png" }));
    const uploaded = await sendForm("/media", token[A], form);
    expect(uploaded.status).toBe(200);
    const key = (uploaded.json as { key: string }).key;
    expect((await api(`/media/${key}`, { token: token[A] })).status).toBe(200);
    expect((await api(`/media/${key}`, { token: token[B] })).status).toBe(404);
    const dropId = crypto.randomUUID();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, '2026-10-27')`).bind(dropId, B).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, 1)`).bind(dropId, A).run();
    const shown = await api(`/media/${key}`, { token: token[B] });
    expect(shown.status).toBe(200);
    const raw = await SELF.fetch(`http://closer.test/media/${key}`, { headers: { authorization: `Bearer ${token[B]}` } });
    await raw.arrayBuffer();
    expect(raw.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await api(`/media/${key}`, { token: token[U] })).status).toBe(404);
  });
});
