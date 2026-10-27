import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sha256, hmacSha256Hex } from "../src/crypto";
import { createDepositOrder } from "../src/razorpay";
import { A, B, U, V, api, count, login, reset } from "./harness";

let token: Record<string, string>;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

beforeEach(async () => {
  await reset();
  token = { [A]: await login(A), [B]: await login(B), [V]: await login(V), [U]: await login(U) };
});

async function openPlan(left: string, right: string) {
  const [userA, userB] = left < right ? [left, right] : [right, left];
  await env.DB.prepare(`insert or ignore into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), userA, userB, new Date().toISOString())
    .run();
  const created = await api("/plans", {
    token: token[left],
    body: { personId: right, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
  });
  const plan = (created.json as { id: string }).id;
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-a`, userId: left } });
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-b`, userId: right } });
  return plan;
}

async function connect(plan: string, search: string, bearer = "") {
  const headers = new Headers({ Upgrade: "websocket" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  const response = await SELF.fetch(`http://closer.test/plans/${plan}/chat${search}`, { headers });
  if (response.webSocket) response.webSocket.accept();
  return response;
}

describe("c4", () => {
  it("issues a one-time chat ticket and refuses query session tokens", async () => {
    const plan = await openPlan(A, B);
    const other = await openPlan(A, V);
    expect((await api(`/plans/${plan}/chat-ticket`, { method: "POST", token: token[U] })).status).toBe(403);

    const issued = await api(`/plans/${plan}/chat-ticket`, { method: "POST", token: token[A] });
    expect(issued.status).toBe(200);
    const ticket = (issued.json as { ticket: string; expiresAt: string }).ticket;
    expect(ticket.length).toBeGreaterThan(20);
    const row = await env.DB.prepare(`select token_hash, used_at from chat_tickets where plan_id = ?`)
      .bind(plan)
      .first<{ token_hash: string; used_at: string | null }>();
    expect(row?.token_hash).toBe(await sha256(ticket));
    expect(row?.token_hash).not.toBe(ticket);
    expect(row?.used_at).toBeNull();

    expect((await connect(other, `?ticket=${encodeURIComponent(ticket)}`)).status).toBe(401);
    expect(
      (
        await env.DB.prepare(`select used_at from chat_tickets where token_hash = ?`)
          .bind(await sha256(ticket))
          .first<{ used_at: string | null }>()
      )?.used_at,
    ).toBeNull();

    expect((await connect(plan, `?ticket=${encodeURIComponent(ticket)}`)).status).toBe(101);
    expect((await connect(plan, `?ticket=${encodeURIComponent(ticket)}`)).status).toBe(401);

    const expired = await api(`/plans/${plan}/chat-ticket`, { method: "POST", token: token[B] });
    const expiredTicket = (expired.json as { ticket: string }).ticket;
    await env.DB.prepare(`update chat_tickets set expires_at = ? where token_hash = ?`)
      .bind("2000-01-01T00:00:00.000Z", await sha256(expiredTicket))
      .run();
    expect((await connect(plan, `?ticket=${encodeURIComponent(expiredTicket)}`)).status).toBe(401);

    expect((await connect(plan, `?token=${encodeURIComponent(token[A])}`)).status).toBe(401);
    expect((await connect(plan, "", token[A])).status).toBe(101);
  });

  it("creates a 9900 paise Razorpay order and ignores a payment that does not match", async () => {
    await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), A, B, new Date().toISOString())
      .run();
    const created = await api("/plans", {
      token: token[A],
      body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
    });
    const plan = (created.json as { id: string }).id;
    await expect(createDepositOrder(env.DB, { ...env, RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" }, A, plan)).rejects.toThrow(/not configured/);

    let authorization = "";
    let body = "";
    fetchMock
      .get("https://api.razorpay.com")
      .intercept({ path: "/v1/orders", method: "POST" })
      .reply(200, (options) => {
        const headers = options.headers;
        if (headers instanceof Headers) authorization = headers.get("authorization") ?? "";
        else if (headers) authorization = headers.authorization ?? headers.Authorization ?? "";
        body = typeof options.body === "string" ? options.body : JSON.stringify(options.body ?? "");
        return { id: "order_c4", amount: 9900, currency: "INR" };
      });
    const order = await api(`/plans/${plan}/deposit/order`, { method: "POST", token: token[A] });
    expect(order.status).toBe(200);
    expect(order.json).toEqual({ orderId: "order_c4", amount: 9900, currency: "INR" });
    expect(authorization).toBe(`Basic ${btoa("rzp_test_key:rzp_test_secret")}`);
    expect(JSON.parse(body)).toMatchObject({ amount: 9900, currency: "INR", notes: { plan_id: plan, user_id: A } });
    expect(await count(`select count(*) as n from deposits where plan_id = ? and user_id = ? and order_id = 'order_c4'`, plan, A)).toBe(1);
    expect((await api(`/plans/${plan}/deposit/order`, { method: "POST", token: token[U] })).status).toBe(403);

    const wrongAmount = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_bad", amount: 100, currency: "INR", order_id: "order_c4", notes: { plan_id: plan, user_id: A } } } },
    });
    const wrongSignature = await hmacSha256Hex("razorpay-test-secret", wrongAmount);
    const ignored = await api("/webhooks/razorpay", { method: "POST", raw: wrongAmount, headers: { "x-razorpay-signature": wrongSignature } });
    expect(ignored.status).toBe(200);
    expect(ignored.json).toMatchObject({ ignored: true });
    expect(await count(`select count(*) as n from deposits where plan_id = ? and user_id = ? and status = 'unpaid'`, plan, A)).toBe(1);
    expect(await count(`select count(*) as n from audit_log where role = 'payments' and action = 'ignore razorpay' and actor = ?`, A)).toBe(1);

    const wrongOrder = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_other", amount: 9900, currency: "INR", order_id: "order_other", notes: { plan_id: plan, user_id: A } } } },
    });
    const otherSignature = await hmacSha256Hex("razorpay-test-secret", wrongOrder);
    expect((await api("/webhooks/razorpay", { method: "POST", raw: wrongOrder, headers: { "x-razorpay-signature": otherSignature } })).json).toMatchObject({ ignored: true });
    expect(await count(`select count(*) as n from deposits where plan_id = ? and status = 'paid'`, plan)).toBe(0);

    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_ok", amount: 9900, currency: "INR", order_id: "order_c4", notes: { plan_id: plan, user_id: A } } } },
    });
    const signature = await hmacSha256Hex("razorpay-test-secret", raw);
    expect((await api("/webhooks/razorpay", { method: "POST", raw, headers: { "x-razorpay-signature": signature } })).status).toBe(200);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and user_id = ? and status = 'paid' and payment_id = 'pay_ok'`, plan, A)).toBe(1);
  });

  it("shows a trusted-contact page on GET and confirms only on POST", async () => {
    const contact = await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "9876543210" } });
    const contactId = (contact.json as { id: string }).id;
    await api(`/service/trusted-contacts/${contactId}/token`, { method: "POST", service: true, body: { token: "page-token" } });
    const before = await env.DB.prepare(`select confirmed, confirm_token from trusted_contacts where id = ?`)
      .bind(contactId)
      .first<{ confirmed: number; confirm_token: string }>();

    const page = await SELF.fetch("http://closer.test/trusted-contacts/confirm?token=page-token");
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    expect(page.headers.get("x-robots-tag")).toBe("noindex");
    const html = await page.text();
    expect(html).toContain("Yes, I'll be their trusted contact");
    expect(html).toContain("/trusted-contacts/confirm?token=page-token");
    const afterGet = await env.DB.prepare(`select confirmed, confirm_token from trusted_contacts where id = ?`)
      .bind(contactId)
      .first<{ confirmed: number; confirm_token: string }>();
    expect(afterGet).toEqual(before);

    const posted = await SELF.fetch("http://closer.test/trusted-contacts/confirm?token=page-token", { method: "POST" });
    expect(posted.status).toBe(200);
    expect(await count(`select count(*) as n from trusted_contacts where id = ? and confirmed = 1 and confirm_token is null`, contactId)).toBe(1);
  });
});
