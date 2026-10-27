import { hmacSha256Hex, sameHex } from "./crypto";
import { fail, type Env } from "./env";
import { assertDepositPayer, markDepositPaid, saveDepositOrder } from "./policy";

const DEPOSIT_PAISE = 9900;

type PaymentEntity = {
  id?: string;
  amount?: number;
  currency?: string;
  order_id?: string;
  notes?: { plan_id?: string; user_id?: string };
};

type PaymentEvent = {
  event?: string;
  payload?: { payment?: { entity?: PaymentEntity } };
};

async function ignorePayment(db: D1Database, detail: string, actor: string) {
  await db
    .prepare(`insert into audit_log (id, actor, role, action, detail, created_at) values (?, ?, 'payments', 'ignore razorpay', ?, ?)`)
    .bind(crypto.randomUUID(), actor || null, detail, new Date().toISOString())
    .run();
  return { ok: true, ignored: true };
}

export async function createDepositOrder(db: D1Database, env: Env, userId: string, planId: string) {
  await assertDepositPayer(db, userId, planId);
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) fail("not configured", 500);
  // Asking twice reuses the first order: a new one would orphan a payment already in flight.
  const existing = await db
    .prepare(`select order_id from deposits where plan_id = ? and user_id = ?`)
    .bind(planId, userId)
    .first<{ order_id: string | null }>();
  if (existing?.order_id) return { orderId: existing.order_id, amount: DEPOSIT_PAISE, currency: "INR" as const, keyId };
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: DEPOSIT_PAISE,
      currency: "INR",
      receipt: crypto.randomUUID(),
      notes: { plan_id: planId, user_id: userId },
    }),
  });
  if (!response.ok) fail("payment desk", 502);
  const created = (await response.json()) as { id?: string; amount?: number; currency?: string };
  if (!created.id || created.amount !== DEPOSIT_PAISE || created.currency !== "INR") fail("payment desk", 502);
  await saveDepositOrder(db, planId, userId, created.id);
  // The key id is public by Razorpay's design; Checkout needs it. The secret never leaves the Worker.
  return { orderId: created.id, amount: DEPOSIT_PAISE, currency: "INR" as const, keyId };
}

export async function handleRazorpayWebhook(db: D1Database, secret: string | undefined, raw: string, signature: string) {
  const key = secret?.trim() ?? "";
  if (!key) fail("not configured", 500);
  const expected = await hmacSha256Hex(key, raw);
  if (!sameHex(expected, signature.trim().toLowerCase())) fail("bad signature", 401);
  let event: PaymentEvent;
  try {
    event = JSON.parse(raw) as PaymentEvent;
  } catch {
    fail("bad payload", 400);
  }
  if (event.event !== "payment.captured") return { ok: true, ignored: true };
  const payment = event.payload?.payment?.entity;
  const paymentId = payment?.id ?? "";
  const orderId = payment?.order_id ?? "";
  // The order id we created is the only link we trust. Checkout notes are optional and
  // come from the browser, so they never decide whose deposit this is.
  const row = orderId
    ? await db
        .prepare(`select plan_id, user_id from deposits where order_id = ?`)
        .bind(orderId)
        .first<{ plan_id: string; user_id: string }>()
    : null;
  const amountOk = payment?.amount === DEPOSIT_PAISE && payment.currency === "INR";
  // A signed but unusable event is logged and acknowledged, so Razorpay stops retrying it.
  if (!paymentId || !row || !amountOk) {
    return ignorePayment(
      db,
      `payment ${paymentId} order ${orderId} amount ${String(payment?.amount ?? "")} ${payment?.currency ?? ""}`,
      row?.user_id ?? payment?.notes?.user_id ?? "",
    );
  }
  await markDepositPaid(db, row.plan_id, row.user_id, paymentId);
  return { ok: true, ignored: false };
}
