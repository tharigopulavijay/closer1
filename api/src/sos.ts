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
    .prepare(`select phone from trusted_contacts where user_id = ? and confirmed = 1 and phone <> ''`)
    .bind(userId)
    .all<{ phone: string }>();
  if (!key) return { tel: "tel:112", sent: false };
  const me = await db.prepare(`select display_name from profiles where id = ?`).bind(userId).first<{ display_name: string }>();
  const who = me?.display_name?.trim() || "Your contact";
  const where =
    typeof input.lat === "number" && typeof input.lng === "number"
      ? ` Last location: https://maps.google.com/?q=${input.lat.toFixed(5)},${input.lng.toFixed(5)}`
      : "";
  const text = `Closer SOS: ${who} pressed the safety button. Please call them now.${where}`;
  const sms = sender ?? msg91Sender(key);
  let delivered = 0;
  // One failed number must not stop the alert reaching the others.
  for (const contact of contacts.results) {
    try {
      await sms.send(contact.phone, text);
      delivered += 1;
    } catch (error) {
      console.error("sos sms failed", error);
    }
  }
  return { tel: "tel:112", sent: delivered > 0 };
}
