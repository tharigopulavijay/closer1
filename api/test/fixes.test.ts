import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256 } from "../src/crypto";
import { A, B, O1, api, count, login, reset } from "./harness";

let token: Record<string, string>;

beforeEach(async () => {
  await reset();
  token = { [A]: await login(A), [B]: await login(B) };
});

async function planBetween(left: string, right: string, slot: string, createdAt: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `insert into plans (id, owner_id, person_id, venue_id, slot, kind, status, created_at) values (?, ?, ?, 'heartcup', ?, 'coffee', 'upcoming', ?)`,
  )
    .bind(id, left, right, slot, createdAt)
    .run();
  await env.DB.batch([
    env.DB.prepare(`insert into deposits (plan_id, user_id) values (?, ?)`).bind(id, left),
    env.DB.prepare(`insert into deposits (plan_id, user_id) values (?, ?)`).bind(id, right),
  ]);
  return id;
}

describe("c1 fixes", () => {
  it("lets both people debrief after the slot, and not before", async () => {
    const past = await planBetween(A, B, "Sat · 8:00 pm", "2020-01-01T00:00:00.000Z");
    expect((await api(`/plans/${past}/debrief`, { token: token[A], body: { feel: "good", again: "yes" } })).status).toBe(200);
    expect((await api(`/plans/${past}/debrief`, { token: token[B], body: { feel: "good", again: "yes", note: "chai" } })).status).toBe(200);
    expect(await count(`select count(*) as n from debriefs where plan_id = ?`, past)).toBe(2);
    expect((await api(`/plans/${past}/debrief`, { token: token[A], body: { feel: "good", again: "yes" } })).text).toMatch(/already debriefed/);

    const future = await planBetween(A, B, "2099-01-01T00:00:00.000Z", new Date().toISOString());
    expect((await api(`/plans/${future}/debrief`, { token: token[A], body: { feel: "good", again: "yes" } })).text).toMatch(/slot not started/);
    expect(await count(`select count(*) as n from debriefs where plan_id = ?`, future)).toBe(0);

    const foreign = await planBetween(O1, B, "Sat · 8:00 pm", "2020-01-01T00:00:00.000Z");
    expect((await api(`/plans/${foreign}/debrief`, { token: token[A], body: { feel: "good", again: "yes" } })).text).toMatch(/row-level security/);
  });

  it("pays each person once and opens chat only when both deposits are paid", async () => {
    await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), A, B, new Date().toISOString())
      .run();
    const created = await api("/plans", {
      token: token[A],
      body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
    });
    const plan = (created.json as { id: string }).id;
    expect(await count(`select count(*) as n from deposits where plan_id = ?`, plan)).toBe(2);

    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_a", userId: A } })).status).toBe(200);
    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_a", userId: A } })).status).toBe(200);
    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_a", userId: B } })).text).toMatch(/payment already used/);
    expect(await count(`select count(*) as n from plans where id = ? and booked_at is not null`, plan)).toBe(0);

    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_b", userId: B } })).status).toBe(200);
    expect((await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: "pay_b", userId: B } })).status).toBe(200);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`, plan)).toBe(2);
    expect(await count(`select count(*) as n from plans where id = ? and booked_at is not null`, plan)).toBe(1);
  });

  it("stores only the hash of a trusted-contact token", async () => {
    const contact = await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "9876543210" } });
    const contactId = (contact.json as { id: string }).id;
    expect((await api(`/service/trusted-contacts/${contactId}/token`, { method: "POST", service: true, body: { token: "sms-token" } })).status).toBe(200);
    const row = await env.DB.prepare(`select confirm_token from trusted_contacts where id = ?`)
      .bind(contactId)
      .first<{ confirm_token: string }>();
    expect(row?.confirm_token).toBe(await sha256("sms-token"));
    expect(row?.confirm_token).not.toBe("sms-token");
    const revealed = await api(`/service/trusted-contacts/${contactId}/token`, { method: "GET", service: true });
    expect((revealed.json as { token: string }).token).toBe(await sha256("sms-token"));
    expect((await api("/trusted-contacts/confirm", { method: "POST", token: token[A], service: true, body: { token: "sms-token" } })).status).toBe(200);
    expect(await count(`select count(*) as n from trusted_contacts where id = ? and confirmed = 1 and confirm_token is null`, contactId)).toBe(1);
  });
});
