import { hmacSha256Hex, sameHex } from "./crypto";
import { fail } from "./env";
import { markDepositPaid } from "./policy";

type PaymentEvent = {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; notes?: { plan_id?: string; user_id?: string } } } };
};

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
  await markDepositPaid(db, planId, userId, paymentId);
  return { ok: true, ignored: false };
}
