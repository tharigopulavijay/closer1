import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { A, B, C, O1, S, T, U, V, api, count, login, reset, tinyPng, sendForm } from "./harness";

const O2 = "88888888-8888-4888-8888-888888888882";
const O3 = "88888888-8888-4888-8888-888888888883";

function payload(token: string) {
  const part = token.split(".")[1] ?? "";
  const padded = part.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { sub: string; name?: string; video: { room: string } };
}

beforeEach(reset);

describe("voice rooms", () => {
  it("refuses an unverified member, a banned member, someone the host blocked, and a ninth speaker", async () => {
    const token = { A: await login(A), B: await login(B), U: await login(U), C: await login(C), S: await login(S) };
    expect((await api("/rooms/full/token", { method: "POST", token: token.U })).text).toMatch(/verified only/);
    expect((await api("/rooms/full/token", { method: "POST", token: token.C })).text).toMatch(/banned/);
    // Asking for a token never creates a room.
    expect((await api("/rooms/made-up/token", { method: "POST", token: token.A })).status).toBe(404);
    expect(await count(`select count(*) as n from rooms where id = 'made-up'`)).toBe(0);

    const opened = await api("/rooms", { token: token.A, body: { title: "Hosted room", topic: "" } });
    const hosted = (opened.json as { id: string }).id;
    const host = await api(`/rooms/${hosted}/token`, { method: "POST", token: token.A });
    expect(host.status).toBe(200);
    expect(payload((host.json as { token: string }).token).sub).toBe(A);
    expect(((await api("/rooms", { token: token.S })).json as { rooms: { id: string }[] }).rooms.map((room) => room.id)).toContain(hosted);
    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(A, B).run();
    expect((await api(`/rooms/${hosted}/token`, { method: "POST", token: token.B })).text).toMatch(/blocked/);
    expect(((await api("/rooms", { token: token.B })).json as { rooms: { id: string }[] }).rooms.map((room) => room.id)).not.toContain(hosted);

    const now = new Date().toISOString();
    await env.DB.prepare(`insert into rooms (id, host_id, title, topic, kind, created_at) values ('packed', ?, 'Packed', '', 'room', ?)`).bind(A, now).run();
    for (const id of [A, S, T, V, O1, O2, O3, B]) {
      await env.DB.prepare(
        `insert into room_members (room_id, user_id, role, guest_name, revealed, joined_at) values ('packed', ?, 'speaker', ?, 0, ?)`,
      ).bind(id, `Guest ${id.slice(0, 4)}`, now).run();
    }
    const ninth = "99999999-9999-4999-8999-999999999999";
    await env.DB.batch([
      env.DB.prepare(`insert into users (id, phone_hash, created_at) values (?, 'hash-ninth', ?)`).bind(ninth, now),
      env.DB.prepare(
        `insert into profiles (id, display_name, dob, phone_hash, verified, hide_from_contacts, created_at) values (?, 'Ninth', '1995-01-01', 'hash-ninth', 1, 0, ?)`,
      ).bind(ninth, now),
    ]);
    const extra = await login(ninth);
    expect((await api("/rooms/packed/token", { method: "POST", token: extra })).text).toMatch(/room full/);
    expect((await api("/rooms/packed/token", { method: "POST", token: token.S })).status).toBe(200);
    expect(await count(`select count(*) as n from room_members where room_id = 'packed' and role = 'speaker'`)).toBe(8);

    // Seats taken over an hour ago have expired with their tokens, so the room has space again.
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`update room_members set joined_at = ? where room_id = 'packed' and user_id = ?`).bind(old, O3).run();
    expect((await api("/rooms/packed/token", { method: "POST", token: extra })).status).toBe(200);
  });

  it("never pairs Chai Break with a stale wait or across a block in either direction", async () => {
    const tokenA = await login(A);
    const tokenB = await login(B);
    const tokenS = await login(S);
    const stale = (await api("/rooms/chai", { method: "POST", token: tokenA })).json as { id: string };
    await env.DB.prepare(`update rooms set created_at = ? where id = ?`).bind(new Date(Date.now() - 10 * 60 * 1000).toISOString(), stale.id).run();
    const fresh = (await api("/rooms/chai", { method: "POST", token: tokenB })).json as { id: string };
    expect(fresh.id).not.toBe(stale.id);

    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(S, B).run();
    const other = (await api("/rooms/chai", { method: "POST", token: tokenS })).json as { id: string };
    expect(other.id).not.toBe(fresh.id);
    expect((await api(`/rooms/${fresh.id}/token`, { method: "POST", token: tokenS })).status).toBe(403);
  });

  it("keeps Chai Break anonymous until both people reveal", async () => {
    const tokenA = await login(A);
    const tokenB = await login(B);
    await env.DB.prepare(`update profiles set display_name = 'Ananya' where id = ?`).bind(A).run();
    await env.DB.prepare(`update profiles set display_name = 'Bharat' where id = ?`).bind(B).run();
    const first = await api("/rooms/chai", { method: "POST", token: tokenA });
    expect(first.status).toBe(200);
    const roomId = (first.json as { id: string; guestName: string }).id;
    expect((first.json as { guestName: string }).guestName).toMatch(/^Guest \d{4}$/);
    const second = await api("/rooms/chai", { method: "POST", token: tokenB });
    expect((second.json as { id: string }).id).toBe(roomId);

    const left = await api(`/rooms/${roomId}/token`, { method: "POST", token: tokenA });
    const right = await api(`/rooms/${roomId}/token`, { method: "POST", token: tokenB });
    const leftPayload = payload((left.json as { token: string }).token);
    const rightPayload = payload((right.json as { token: string }).token);
    expect(leftPayload.sub).toMatch(/^Guest \d{4}$/);
    expect(leftPayload.name).toBe(leftPayload.sub);
    expect(rightPayload.name).toMatch(/^Guest \d{4}$/);
    expect(JSON.stringify(leftPayload)).not.toMatch(/Ananya|Bharat/);
    expect(JSON.stringify(rightPayload)).not.toMatch(/Ananya|Bharat/);
    expect(leftPayload.sub).not.toBe(rightPayload.sub);

    const one = await api(`/rooms/chai/${roomId}/reveal`, { method: "POST", token: tokenA });
    expect(one.status).toBe(200);
    expect(one.json).toEqual({ revealed: false });
    expect(one.text).not.toMatch(/Ananya|Bharat/);

    const both = await api(`/rooms/chai/${roomId}/reveal`, { method: "POST", token: tokenB });
    expect(both.json).toEqual({
      revealed: true,
      people: expect.arrayContaining([
        { id: A, name: "Ananya" },
        { id: B, name: "Bharat" },
      ]),
    });
  });
});

describe("ops reject", () => {
  it("records a reason, clears the selfie, and asks the person to retake", async () => {
    const ops = await login(O1);
    const member = await login(U);
    await env.DB.prepare(`insert into staff_roles (user_id, role) values (?, 'ops')`).bind(O1).run();
    const form = new FormData();
    form.set("kind", "selfie");
    form.set("file", new File([tinyPng()], "selfie.png", { type: "image/png" }));
    const uploaded = await sendForm("/media", member, form);
    expect(uploaded.status).toBe(200);
    const key = (uploaded.json as { key: string }).key;

    expect((await api(`/admin/users/${U}/reject`, { method: "POST", token: ops, body: { reason: "  " } })).text).toMatch(/reason required/);
    const rejected = await api(`/admin/users/${U}/reject`, { method: "POST", token: ops, body: { reason: "Face is covered" } });
    expect(rejected.status).toBe(200);
    const audit = await env.DB.prepare(`select detail from audit_log where actor = ? and role = 'ops' and action = 'reject'`).bind(O1).first<{ detail: string }>();
    expect(audit?.detail).toContain(U);
    expect(audit?.detail).toContain("Face is covered");
    expect(await count(`select count(*) as n from media_objects where id = ?`, key)).toBe(0);
    expect(await env.MEDIA.head(key)).toBeNull();
    const me = await api("/me", { token: member });
    expect((me.json as { retakeNote: string }).retakeNote).toBe("Face is covered");
    const queue = await api("/admin/verify-queue", { token: ops });
    expect((queue.json as { queue: { id: string }[] }).queue.map((row) => row.id)).not.toContain(U);
    expect((await api("/admin/reports", { token: ops })).text).toMatch(/safety only/);
    const safety = await login(S);
    const reports = await api("/admin/reports", { token: safety });
    expect(reports.status).toBe(200);
    expect((reports.json as { reports: unknown[] }).reports).toEqual([]);
  });
});
