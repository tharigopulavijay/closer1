import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sendDropReminders } from "../src/push";
import { dropDate } from "../src/time";
import { A, B, api, count, login, reset } from "./harness";

function b64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function keys() {
  const signing = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", signing.privateKey)) as JsonWebKey;
  const client = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  return {
    publicKey: b64url(new Uint8Array((await crypto.subtle.exportKey("raw", signing.publicKey)) as ArrayBuffer)),
    privateKey: jwk.d ?? "",
    p256dh: b64url(new Uint8Array((await crypto.subtle.exportKey("raw", client.publicKey)) as ArrayBuffer)),
    auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

beforeEach(reset);

describe("drop reminders", () => {
  it("switches to the next Drop at 9 pm India time, when the reminder goes out", () => {
    expect(dropDate(new Date("2026-10-28T15:29:00Z"))).toBe("2026-10-28"); // 8:59 pm IST
    expect(dropDate(new Date("2026-10-28T15:30:00Z"))).toBe("2026-10-29"); // 9:00 pm IST
    expect(dropDate(new Date("2026-10-28T18:31:00Z"))).toBe("2026-10-29"); // 00:01 IST next day
  });

  it("subscribes, unsubscribes, and pings only members who opted in", async () => {
    const tokenA = await login(A);
    const tokenB = await login(B);
    const made = await keys();
    expect((await api("/push", { token: tokenA })).json).toMatchObject({ optedIn: false });
    const subscribed = await api("/push", {
      method: "POST",
      token: tokenA,
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: made.p256dh, auth: made.auth },
    });
    expect(subscribed.status).toBe(200);
    expect(await count(`select count(*) as n from push_subscriptions where user_id = ? and opted_in = 1`, A)).toBe(1);
    expect((await api("/push", { method: "POST", token: tokenB, body: { endpoint: "http://push.example/b", p256dh: made.p256dh, auth: made.auth } })).status).toBe(400);

    // Only real push services, so the cron can never be pointed at an arbitrary server.
    expect((await api("/push", { method: "POST", token: tokenB, body: { endpoint: "https://evil.example/b", p256dh: made.p256dh, auth: made.auth } })).status).toBe(400);
    // Reminders go only to people who have picks tonight.
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values ('drop-push', ?, ?)`).bind(A, dropDate()).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values ('drop-push', ?, 1)`).bind(B).run();

    const now = new Date().toISOString();
    await env.DB.prepare(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, opted_in, created_at) values (?, 'https://fcm.googleapis.com/fcm/send/off', ?, ?, 0, ?)`,
    )
      .bind(B, made.p256dh, made.auth, now)
      .run();

    const hits: string[] = [];
    const headers: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      hits.push(String(input));
      headers.push(new Headers(init?.headers).get("authorization") ?? "");
      return new Response("", { status: 201 });
    }) as typeof fetch;
    const envWithKeys = env as unknown as { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string };
    envWithKeys.VAPID_PUBLIC_KEY = made.publicKey;
    envWithKeys.VAPID_PRIVATE_KEY = made.privateKey;
    try {
      const first = await sendDropReminders(env);
      expect(first.sent).toEqual([A]);
      expect(hits).toEqual(["https://fcm.googleapis.com/fcm/send/a"]);
      expect(headers[0]).toContain("vapid ");
      expect(headers.join("\n")).not.toContain(made.privateKey);

      // A phone the push service has forgotten is removed instead of retried every night.
      globalThis.fetch = (async () => new Response("", { status: 410 })) as typeof fetch;
      expect((await sendDropReminders(env)).sent).toEqual([]);
      expect(await count(`select count(*) as n from push_subscriptions where user_id = ?`, A)).toBe(0);
      await api("/push", { method: "POST", token: tokenA, body: { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: made.p256dh, auth: made.auth } });
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        hits.push(String(input));
        return new Response("", { status: 201 });
      }) as typeof fetch;

      expect((await api("/push", { method: "DELETE", token: tokenA })).status).toBe(200);
      expect(await count(`select count(*) as n from push_subscriptions where user_id = ?`, A)).toBe(0);
      hits.length = 0;
      const second = await sendDropReminders(env);
      expect(second.sent).toEqual([]);
      expect(hits).toEqual([]);
    } finally {
      globalThis.fetch = original;
      envWithKeys.VAPID_PUBLIC_KEY = undefined;
      envWithKeys.VAPID_PRIVATE_KEY = undefined;
    }
  });
});
