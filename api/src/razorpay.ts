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
  return { orderId: created.id, amount: DEPOSIT_PAISE, currency: "INR" as const };
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
  const planId = payment?.notes?.plan_id ?? "";
  const userId = payment?.notes?.user_id ?? "";
  const paymentId = payment?.id ?? "";
  if (!planId || !userId || !paymentId) fail("bad payload", 400);
  const row = await db
    .prepare(`select order_id from deposits where plan_id = ? and user_id = ?`)
    .bind(planId, userId)
    .first<{ order_id: string | null }>();
  const amountOk = payment?.amount === DEPOSIT_PAISE && payment.currency === "INR";
  const orderOk = Boolean(row?.order_id) && row?.order_id === payment?.order_id;
  if (!orderOk || !amountOk) {
    return ignorePayment(
      db,
      `plan ${planId} order ${payment?.order_id ?? ""} amount ${String(payment?.amount ?? "")} ${payment?.currency ?? ""}`,
      userId,
    );
  }
  await markDepositPaid(db, planId, userId, paymentId);
  return { ok: true, ignored: false };
}
