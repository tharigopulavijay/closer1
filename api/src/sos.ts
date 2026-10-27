import type { Env } from "./env";
import { fail } from "./env";
import type { SmsSender } from "./sms";

export function msg91Sender(key: string, fetchImpl: typeof fetch = fetch): SmsSender {
  return {
    async send(phone, text) {
      const response = await fetchImpl("https://control.msg91.com/api/v5/sms", {
        method: "POST",
        headers: { authkey: key, "content-type": "application/json" },
        body: JSON.stringify({ recipients: [phone], message: text }),
      });
      if (!response.ok) fail("sms failed", 502);
    },
  };
}

export async function raiseSos(
  db: D1Database,
  env: Env,
  userId: string,
  input: { planId?: string; lat?: number; lng?: number },
  sender?: SmsSender,
) {
  const banned = await db.prepare(`select 1 as n from bans where user_id = ?`).bind(userId).first();
  if (banned) fail("banned");
  await db
    .prepare(`insert into sos_events (id, user_id, plan_id, lat, lng, created_at) values (?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      userId,
      input.planId || null,
      input.lat ?? null,
      input.lng ?? null,
      new Date().toISOString(),
    )
    .run();
  const key = env.MSG91_KEY?.trim() ?? "";
  const contacts = await db
    .prepare(`select phone_hash from trusted_contacts where user_id = ? and confirmed = 1`)
    .bind(userId)
    .all<{ phone_hash: string }>();
  if (!key) return { tel: "tel:112", sent: false };
  const sms = sender ?? msg91Sender(key);
  for (const contact of contacts.results) {
    await sms.send(contact.phone_hash, "Closer safety alert. Please check on them.");
  }
  return { tel: "tel:112", sent: contacts.results.length > 0 };
}
