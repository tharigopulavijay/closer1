import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { requestOtp, verifyOtp } from "../src/auth";
import { buildTomorrowDrop } from "../src/drop";
import { moderate } from "../src/moderate";
import { deliverMessage } from "../src/policy";
import { A, B, C, O1, O2, O3, S, T, V, api, count, login, reset } from "./harness";

let token: Record<string, string>;

beforeEach(async () => {
  await reset();
  token = { [A]: await login(A), [B]: await login(B), [C]: await login(C) };
});

async function paidPlan() {
  await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), A, B, new Date().toISOString())
    .run();
  const created = await api("/plans", {
    token: token[A],
    body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
  });
  const plan = (created.json as { id: string }).id;
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-a`, userId: A } });
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-b`, userId: B } });
  return plan;
}

describe("review fixes", () => {
  it("a block ends an open chat at once and stops a new plan", async () => {
    const plan = await paidPlan();
    await deliverMessage(env.DB, B, plan, "see you at 8");
    expect((await api("/blocks", { token: token[A], body: { personId: B } })).status).toBe(200);
    await expect(deliverMessage(env.DB, B, plan, "why did you block me")).rejects.toThrow(/chat closed/);
    await expect(deliverMessage(env.DB, A, plan, "bye")).rejects.toThrow(/chat closed/);

    await env.DB.prepare(`update plans set status = 'closed' where id = ?`).bind(plan).run();
    const again = await api("/plans", {
      token: token[B],
      body: { personId: A, venueId: "heartcup", slot: "Sun · 6:00 pm", kind: "coffee" },
    });
    expect(again.text).toMatch(/blocked/);
    // Blocking twice is harmless, and blocking nobody is refused.
    expect((await api("/blocks", { token: token[A], body: { personId: B } })).status).toBe(200);
    expect((await api("/blocks", { token: token[A], body: { personId: "nobody" } })).status).toBe(400);
  });

  it("the Drop respects who each person wants to meet, both ways", async () => {
    // A is a woman who wants men. Only O1 is a man who wants women.
    await env.DB.prepare(`update profiles set gender = 'woman', show_me = 'men' where id = ?`).bind(A).run();
    await env.DB.prepare(`update profiles set gender = 'woman', show_me = 'everyone' where id in (?, ?, ?, ?)`).bind(B, S, T, V).run();
    await env.DB.prepare(`update profiles set gender = 'man', show_me = 'women' where id = ?`).bind(O1).run();
    await env.DB.prepare(`update profiles set gender = 'man', show_me = 'men' where id = ?`).bind(O2).run();
    await env.DB.prepare(`update profiles set gender = 'man', show_me = 'women', intent = 'friends' where id = ?`).bind(O3).run();
    await env.DB.prepare(`update profiles set intent = 'dating' where id = ?`).bind(A).run();
    await buildTomorrowDrop(env.DB, new Date("2026-10-27T15:30:00.000Z"));
    const picks = await env.DB.prepare(
      `select dp.person_id as id from drop_picks dp join drops d on d.id = dp.drop_id where d.user_id = ?`,
    )
      .bind(A)
      .all<{ id: string }>();
    expect(picks.results.map((row) => row.id)).toEqual([O1]);
  });

  it("no one person fills every Drop in a big night", async () => {
    const ids: string[] = [];
    const now = new Date().toISOString();
    for (let i = 0; i < 40; i += 1) {
      const id = crypto.randomUUID();
      ids.push(id);
      await env.DB.batch([
        env.DB.prepare(`insert into users (id, phone_hash, created_at) values (?, ?, ?)`).bind(id, `bulk-${i}`, now),
        env.DB.prepare(`insert into profiles (id, phone_hash, verified, hide_from_contacts, created_at) values (?, ?, 1, 0, ?)`).bind(id, `bulk-${i}`, now),
      ]);
    }
    await buildTomorrowDrop(env.DB, new Date("2026-10-27T15:30:00.000Z"));
    const top = await env.DB.prepare(
      `select max(n) as n from (select count(*) as n from drop_picks group by person_id)`,
    ).first<{ n: number }>();
    expect(Number(top?.n)).toBeLessThanOrEqual(12);
    expect(await count(`select count(*) as n from drops where drop_date = '2026-10-28'`)).toBeGreaterThan(40);
  });

  it("the fixed dev login code does nothing in production", async () => {
    const sent = await requestOtp({ DB: env.DB, DEV_OTP: "482913", ENVIRONMENT: "production" }, "+919000000001");
    expect(sent).toEqual({ sent: true });
    await expect(verifyOtp({ DB: env.DB, DEV_OTP: "482913", ENVIRONMENT: "production" }, "+919000000001", "482913")).rejects.toThrow(
      /wrong code/,
    );
    const dev = await requestOtp({ DB: env.DB, DEV_OTP: "482913", ENVIRONMENT: "test" }, "+919000000002");
    expect(dev).toEqual({ sent: false });
  });

  it("a banned person who deletes and signs up again with the same number is still banned", async () => {
    const phone = "+919000000003";
    await requestOtp({ DB: env.DB, DEV_OTP: "111111", ENVIRONMENT: "test" }, phone);
    const first = await verifyOtp({ DB: env.DB, DEV_OTP: "111111", ENVIRONMENT: "test" }, phone, "111111");
    await env.DB.prepare(`insert into bans (user_id, reason, created_at) values (?, 'severe', ?)`).bind(first.userId, new Date().toISOString()).run();
    expect((await api("/account", { method: "DELETE", token: first.token })).status).toBe(200);

    await requestOtp({ DB: env.DB, DEV_OTP: "111111", ENVIRONMENT: "test" }, phone);
    const second = await verifyOtp({ DB: env.DB, DEV_OTP: "111111", ENVIRONMENT: "test" }, phone, "111111");
    expect(second.userId).toBe(first.userId);
    expect((await api("/me", { method: "PATCH", token: second.token, body: { displayName: "new me" } })).text).toMatch(/banned/);
  });

  it("deleting an account keeps the plan, payments and messages as evidence", async () => {
    const plan = await paidPlan();
    await deliverMessage(env.DB, A, plan, "see you there");
    expect((await api("/account", { method: "DELETE", token: token[A] })).status).toBe(200);
    expect(await count(`select count(*) as n from plans where id = ?`, plan)).toBe(1);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`, plan)).toBe(2);
    expect(await count(`select count(*) as n from messages where plan_id = ?`, plan)).toBe(1);
    expect((await api(`/profiles/${A}`, { token: token[B] })).status).toBe(404);
  });

  it("chat moderation stops phone numbers but not times and dates", () => {
    expect(moderate("meet at 7:30 on 12/11/2026?").ok).toBe(true);
    expect(moderate("table for 2 at 8, booking ref 4417").ok).toBe(true);
    expect(moderate("call me 98765 43210").ok).toBe(false);
    expect(moderate("+91-98765-43210").ok).toBe(false);
  });

  it("trusted contacts need a real number, are capped at five, and only show the last 4 digits", async () => {
    expect((await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "123" } })).text).toMatch(/bad phone/);
    for (let i = 0; i < 5; i += 1) {
      expect((await api("/trusted-contacts", { token: token[A], body: { name: `C${i}`, phone: `987654321${i}` } })).status).toBe(200);
    }
    expect((await api("/trusted-contacts", { token: token[A], body: { name: "C6", phone: "9876543216" } })).text).toMatch(/contact limit/);
    const list = await api("/trusted-contacts", { token: token[A] });
    const contacts = (list.json as { contacts: { phoneEnding: string }[] }).contacts;
    expect(contacts[0]).toEqual(expect.objectContaining({ phoneEnding: "3210" }));
    expect(list.text).not.toMatch(/9876543210/);
  });
});
