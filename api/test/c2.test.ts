import { createExecutionContext, env, SELF, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import wrangler from "../wrangler.jsonc?raw";
import worker from "../src/index";
import { hmacSha256Hex } from "../src/crypto";
import { buildTomorrowDrop } from "../src/drop";
import { moderate, resetModerationRules, setModerationRules } from "../src/moderate";
import { raiseSos } from "../src/sos";
import { A, B, C, O1, O2, O3, S, T, U, V, api, count, login, reset, sendForm, tinyPng } from "./harness";

let token: Record<string, string>;

beforeEach(async () => {
  await reset();
  resetModerationRules();
  token = {
    [A]: await login(A),
    [B]: await login(B),
    [C]: await login(C),
    [U]: await login(U),
    [V]: await login(V),
    [S]: await login(S),
    [T]: await login(T),
    [O1]: await login(O1),
  };
});

async function openPlan() {
  await env.DB.prepare(`insert or ignore into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), A, B, new Date().toISOString())
    .run();
  const created = await api("/plans", {
    token: token[A],
    body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
  });
  const plan = (created.json as { id: string }).id;
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-a`, userId: A } });
  await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-b`, userId: B } });
  return plan;
}

function once(ws: WebSocket) {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no message")), 3000);
    ws.addEventListener("message", (event) => {
      clearTimeout(timer);
      resolve(String(event.data));
    });
  });
}

async function connect(plan: string, bearer: string) {
  const response = await SELF.fetch(`http://closer.test/plans/${plan}/chat`, {
    headers: { Upgrade: "websocket", authorization: `Bearer ${bearer}` },
  });
  const socket = response.webSocket;
  if (socket) socket.accept();
  return { response, socket };
}

describe("c2", () => {
  it("delivers moderated chat only to the two members while the plan is open", async () => {
    const plan = await openPlan();
    await env.DB.prepare(`update deposits set status = 'unpaid', payment_id = null where plan_id = ?`).bind(plan).run();
    await env.DB.prepare(`update plans set booked_at = null where id = ?`).bind(plan).run();
    expect((await connect(plan, token[A])).response.status).toBe(403);
    await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-a2`, userId: A } });
    await api(`/service/deposits/${plan}/pay`, { method: "POST", service: true, body: { paymentId: `pay-${plan}-b2`, userId: B } });
    expect((await connect(plan, token[V])).response.status).toBe(403);

    const left = await connect(plan, token[A]);
    const right = await connect(plan, token[B]);
    expect(left.response.status).toBe(101);
    expect(right.socket).toBeTruthy();
    const heard = once(right.socket as WebSocket);
    left.socket?.send(JSON.stringify({ body: "chai?" }));
    expect(JSON.parse(await heard)).toMatchObject({ type: "message", from: A, body: "chai?" });
    expect(await count(`select count(*) as n from messages where plan_id = ?`, plan)).toBe(1);

    for (const body of ["call 9848012345", "pay name@ybl", "see https://example.com"]) {
      const pending = once(left.socket as WebSocket);
      left.socket?.send(JSON.stringify({ body }));
      expect(JSON.parse(await pending).type).toBe("blocked");
    }
    expect(await count(`select count(*) as n from messages where plan_id = ?`, plan)).toBe(1);
    expect(await count(`select count(*) as n from reports where against_id = ? and source = 'ai'`, A)).toBe(1);
    expect(await count(`select count(*) as n from strikes where user_id = ?`, A)).toBe(0);

    setModerationRules([() => "custom"]);
    expect(moderate("hello").ok).toBe(false);
    resetModerationRules();
    expect(moderate("hello").ok).toBe(true);
  });

  it("builds tomorrow's drop at 21:00 IST", async () => {
    expect(wrangler).toContain('"30 15 * * *"');
    const when = new Date("2026-10-27T15:30:00.000Z");
    const ctx = createExecutionContext();
    await worker.scheduled({ cron: "30 15 * * *", scheduledTime: when.getTime(), type: "scheduled" } as unknown as ScheduledController, env, ctx);
    await waitOnExecutionContext(ctx);
    const tomorrow = "2026-10-28";
    const picks = await env.DB.prepare(
      `select dp.person_id as id from drop_picks dp join drops d on d.id = dp.drop_id
       where d.user_id = ? and d.drop_date = ? order by dp.position`,
    )
      .bind(A, tomorrow)
      .all<{ id: string }>();
    // Each viewer gets their own order, so compare the set, not the sequence.
    expect(picks.results.map((row) => row.id)).toHaveLength(3);
    const firstPicks = picks.results.map((row) => row.id);
    expect(firstPicks.every((id) => ![A, C, U].includes(id))).toBe(true);
    expect(await count(`select count(*) as n from drops d join profiles p on p.id = d.user_id where d.drop_date = ? and p.id = ?`, tomorrow, C)).toBe(0);
    expect(await count(`select count(*) as n from drops where user_id = ? and drop_date = ?`, U, tomorrow)).toBe(0);

    await env.DB.prepare(`update profiles set paused = 1 where id = ?`).bind(B).run();
    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(A, S).run();
    await env.DB.prepare(`insert into away_status (user_id, kind) values (?, 'trip')`).bind(T).run();
    await env.DB.prepare(`update profiles set area = 'Kondapur' where id in (?, ?, ?)`).bind(O1, O2, O3).run();
    await env.DB.prepare(`insert into preferences (user_id, areas, age_min, age_max) values (?, '["Kondapur"]', 40, 70)`).bind(A).run();
    await env.DB.prepare(`update profiles set dob = '1980-01-01' where id in (?, ?, ?)`).bind(O1, O2, O3).run();
    const older = crypto.randomUUID();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values (?, ?, '2026-10-20')`).bind(older, A).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values (?, ?, 1)`).bind(older, V).run();
    await buildTomorrowDrop(env.DB, when);
    const next = await env.DB.prepare(
      `select dp.person_id as id from drop_picks dp join drops d on d.id = dp.drop_id
       where d.user_id = ? and d.drop_date = ? order by dp.position`,
    )
      .bind(A, tomorrow)
      .all<{ id: string }>();
    expect(next.results.map((row) => row.id).sort()).toEqual([O1, O2, O3].sort());
    await buildTomorrowDrop(env.DB, when);
    expect(await count(`select count(*) as n from drops where user_id = ? and drop_date = ?`, A, tomorrow)).toBe(1);
  });

  it("stores private media in R2 and reads it with the profile rule", async () => {
    const photo = new FormData();
    photo.set("kind", "photo");
    photo.set("file", new File([tinyPng()], "a.png", { type: "image/png" }));
    const saved = await sendForm("/media", token[A], photo);
    expect(saved.status).toBe(200);
    const key = (saved.json as { key: string }).key;
    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
    const object = await env.MEDIA.get(key);
    expect(object).toBeTruthy();
    await object?.arrayBuffer();
    expect((await api(`/media/${key}`, { token: token[U] })).status).toBe(404);

    const bad = new FormData();
    bad.set("kind", "photo");
    bad.set("file", new File([tinyPng()], "a.gif", { type: "image/gif" }));
    expect((await sendForm("/media", token[A], bad)).text).toMatch(/bad type/);

    const huge = new FormData();
    huge.set("kind", "photo");
    huge.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect((await sendForm("/media", token[A], huge)).text).toMatch(/too large/);

    const voice = new FormData();
    voice.set("kind", "voice");
    voice.set("seconds", "31");
    voice.set("file", new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" }));
    expect((await sendForm("/media", token[A], voice)).text).toMatch(/too long/);

    const heavy = new FormData();
    heavy.set("kind", "voice");
    heavy.set("seconds", "10");
    heavy.set("file", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "clip.webm", { type: "audio/webm" }));
    expect((await sendForm("/media", token[A], heavy)).text).toMatch(/too large/);
  });

  it("records SOS, confirms a contact from the link, and skips SMS without MSG91", async () => {
    const contact = await api("/trusted-contacts", { token: token[A], body: { name: "Amma", phone: "+91 98765 43210" } });
    const contactId = (contact.json as { id: string }).id;
    await api(`/service/trusted-contacts/${contactId}/token`, { method: "POST", service: true, body: { token: "link-token" } });
    expect((await api("/trusted-contacts/confirm/link-token")).status).toBe(200);
    expect(await count(`select count(*) as n from trusted_contacts where id = ? and confirmed = 1`, contactId)).toBe(1);

    const sos = await api("/sos", { token: token[A], body: { lat: 17.38, lng: 78.48 } });
    expect(sos.status).toBe(200);
    expect(sos.json).toEqual({ tel: "tel:112", sent: false });
    expect(await count(`select count(*) as n from sos_events where user_id = ?`, A)).toBe(1);
    expect((await api("/sos", { token: token[C], body: {} })).text).toMatch(/banned/);

    const sent: string[] = [];
    const alert = await raiseSos(env.DB, { ...env, MSG91_KEY: "msg91-test" }, A, {}, {
      async send(phone) {
        sent.push(phone);
      },
    });
    expect(alert).toEqual({ tel: "tel:112", sent: true });
    expect(sent).toEqual(["919876543210"]);
  });

  it("marks a deposit paid from a signed Razorpay webhook", async () => {
    await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), A, B, new Date().toISOString())
      .run();
    const created = await api("/plans", {
      token: token[A],
      body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" },
    });
    const plan = (created.json as { id: string }).id;
    await env.DB.prepare(`update deposits set order_id = 'order_rz_1' where plan_id = ? and user_id = ?`).bind(plan, A).run();
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: { id: "pay_rz_1", amount: 9900, currency: "INR", order_id: "order_rz_1", notes: { plan_id: plan, user_id: A } },
        },
      },
    });
    const signature = await hmacSha256Hex("razorpay-test-secret", raw);
    const paid = await api("/webhooks/razorpay", { method: "POST", raw, headers: { "x-razorpay-signature": signature } });
    expect(paid.status).toBe(200);
    expect(await count(`select count(*) as n from deposits where plan_id = ? and user_id = ? and status = 'paid' and payment_id = 'pay_rz_1'`, plan, A)).toBe(1);
    expect((await api("/webhooks/razorpay", { method: "POST", raw, headers: { "x-razorpay-signature": signature } })).status).toBe(200);
    expect(await count(`select count(*) as n from deposits where payment_id = 'pay_rz_1'`)).toBe(1);
    expect((await api("/webhooks/razorpay", { method: "POST", raw, headers: { "x-razorpay-signature": "nope" } })).status).toBe(401);
  });

  it("signs a LiveKit token for a verified member", async () => {
    expect((await api("/rooms/room-1/token", { method: "POST", token: token[U] })).text).toMatch(/verified only/);
    expect((await api("/rooms/room-1/token", { method: "POST", token: token[C] })).text).toMatch(/banned/);
    const issued = await api("/rooms/room-1/token", { method: "POST", token: token[A] });
    expect(issued.status).toBe(200);
    const jwt = (issued.json as { token: string }).token;
    const payload = JSON.parse(atob(jwt.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
    expect(payload.iss).toBe("lk-test-key");
    expect(payload.sub).toBe(A);
    expect(payload.video.room).toBe("room-1");
    expect(payload.video.roomJoin).toBe(true);
  });
});
