import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { sendDropReminders } from "../src/push";
import { A, B, api, count, login, reset } from "./harness";

function b64url(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function keys() {
  const signing = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", signing.privateKey);
  const client = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    publicKey: b64url(new Uint8Array(await crypto.subtle.exportKey("raw", signing.publicKey))),
    privateKey: jwk.d ?? "",
    p256dh: b64url(new Uint8Array(await crypto.subtle.exportKey("raw", client.publicKey))),
    auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

beforeEach(reset);

describe("drop reminders", () => {
  it("subscribes, unsubscribes, and pings only members who opted in", async () => {
    const tokenA = await login(A);
    const tokenB = await login(B);
    const made = await keys();
    expect((await api("/push", { token: tokenA })).json).toMatchObject({ optedIn: false });
    const subscribed = await api("/push", {
      method: "POST",
      token: tokenA,
      body: { endpoint: "https://push.example/a", p256dh: made.p256dh, auth: made.auth },
    });
    expect(subscribed.status).toBe(200);
    expect(await count(`select count(*) as n from push_subscriptions where user_id = ? and opted_in = 1`, A)).toBe(1);
    expect((await api("/push", { method: "POST", token: tokenB, body: { endpoint: "http://push.example/b", p256dh: made.p256dh, auth: made.auth } })).status).toBe(400);

    const now = new Date().toISOString();
    await env.DB.prepare(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, opted_in, created_at) values (?, 'https://push.example/off', ?, ?, 0, ?)`,
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
      expect(hits).toEqual(["https://push.example/a"]);
      expect(headers[0]).toContain("vapid ");
      expect(headers.join("\n")).not.toContain(made.privateKey);

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
