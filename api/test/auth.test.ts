import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { requestOtp, verifyOtp } from "../src/auth";
import { setSmsSender, type SmsSender } from "../src/sms";
import { sha256 } from "../src/crypto";
import { api, count, reset } from "./harness";

beforeEach(async () => {
  await reset();
  setSmsSender({ async send() {} });
});

describe("auth", () => {
  it("accepts DEV_OTP, limits requests, locks a bad code, and ends a session", async () => {
    const phone = "+919000000111";
    const sent: string[] = [];
    const spy: SmsSender = { async send(_phone, code) { sent.push(code); } };
    setSmsSender(spy);

    expect((await api("/auth/otp", { method: "POST", body: { phone } })).status).toBe(200);
    expect((await api("/auth/otp", { method: "POST", body: { phone } })).status).toBe(200);
    expect((await api("/auth/otp", { method: "POST", body: { phone } })).status).toBe(200);
    const limited = await api("/auth/otp", { method: "POST", body: { phone } });
    expect(limited.status).toBe(429);
    expect(limited.text).toMatch(/rate limit/);
    expect(sent).toEqual([]);

    for (let i = 0; i < 5; i += 1) {
      const wrong = await api("/auth/verify", { method: "POST", body: { phone, code: "000000" } });
      expect(wrong.status).toBe(401);
      expect(wrong.text).toMatch(/wrong code/);
    }
    const locked = await api("/auth/verify", { method: "POST", body: { phone, code: "482913" } });
    expect(locked.status).toBe(401);
    expect(locked.text).toMatch(/too many attempts/);

    await env.DB.prepare(`delete from otp_codes`).run();
    await api("/auth/otp", { method: "POST", body: { phone } });
    const verified = await api("/auth/verify", { method: "POST", body: { phone, code: "482913" } });
    expect(verified.status).toBe(200);
    const token = (verified.json as { token: string }).token;
    expect((await api("/me", { token })).status).toBe(200);

    const session = await env.DB.prepare(`select token_hash from sessions`).first<{ token_hash: string }>();
    expect(session?.token_hash).not.toBe(token);
    expect(token).toHaveLength(64);

    await env.DB.prepare(`update sessions set expires_at = '2000-01-01T00:00:00.000Z'`).run();
    const expired = await api("/me", { token });
    expect(expired.status).toBe(401);

    await env.DB.prepare(`delete from otp_codes`).run();
    await api("/auth/otp", { method: "POST", body: { phone: "+919000000222" } });
    const again = await api("/auth/verify", { method: "POST", body: { phone: "+919000000222", code: "482913" } });
    const next = (again.json as { token: string }).token;
    expect((await api("/auth/logout", { method: "POST", token: next })).status).toBe(200);
    expect((await api("/me", { token: next })).status).toBe(401);

    await env.DB.prepare(`update otp_codes set expires_at = '2000-01-01T00:00:00.000Z'`).run();
    await api("/auth/otp", { method: "POST", body: { phone: "+919000000333" } });
    await env.DB.prepare(`update otp_codes set expires_at = '2000-01-01T00:00:00.000Z'`).run();
    const stale = await api("/auth/verify", { method: "POST", body: { phone: "+919000000333", code: "482913" } });
    expect(stale.status).toBe(401);
    expect(stale.text).toMatch(/expired code/);
  });

  it("sends an SMS only when DEV_OTP is unset", async () => {
    const sent: string[] = [];
    setSmsSender({
      async send(_phone, code) {
        sent.push(code);
      },
    });
    await requestOtp({ DB: env.DB, DEV_OTP: "" }, "+919111112222");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^\d{6}$/);
    const session = await verifyOtp({ DB: env.DB, DEV_OTP: "" }, "+919111112222", sent[0] ?? "");
    expect(session.token).toHaveLength(64);
  });

  it("sends production codes through MSG91 and keeps the code out of the response", async () => {
    const phone = "+919888877766";
    const calls: { url: string; body: string; auth?: string }[] = [];
    const original = globalThis.fetch;
    const logs: string[] = [];
    const log = console.log;
    const info = console.info;
    const debug = console.debug;
    const error = console.error;
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.info = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.debug = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : "",
        auth: new Headers(init?.headers).get("authkey") ?? "",
      });
      return new Response(JSON.stringify({ type: "success", message: "otp sent" }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await requestOtp(
        { DB: env.DB, ENVIRONMENT: "production", DEV_OTP: "482913", MSG91_KEY: "msg91-test", MSG91_TEMPLATE_ID: "template-test" },
        phone,
      );
      expect(result).toEqual({ sent: true });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://control.msg91.com/api/v5/otp");
      expect(calls[0].auth).toBe("msg91-test");
      const posted = JSON.parse(calls[0].body) as { template_id: string; mobile: string; otp: string };
      expect(posted.template_id).toBe("template-test");
      expect(posted.mobile).toBe("919888877766");
      expect(posted.otp).toMatch(/^\d{6}$/);
      expect(posted.otp).not.toBe("482913");
      const response = JSON.stringify(result);
      expect(response).not.toContain(posted.otp);
      expect(logs.join("\n")).not.toContain(posted.otp);
      expect(await count(`select count(*) as n from otp_codes where phone_hash = ?`, await sha256("919888877766"))).toBe(1);

      calls.length = 0;
      globalThis.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
      await expect(
        requestOtp(
          { DB: env.DB, ENVIRONMENT: "production", DEV_OTP: "482913", MSG91_KEY: "msg91-test", MSG91_TEMPLATE_ID: "template-test" },
          "+919888877767",
        ),
      ).rejects.toThrow(/could not send code/);
      expect(await count(`select count(*) as n from otp_codes where phone_hash = ?`, await sha256("919888877767"))).toBe(0);
    } finally {
      globalThis.fetch = original;
      console.log = log;
      console.info = info;
      console.debug = debug;
      console.error = error;
    }
  });
});
