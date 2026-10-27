import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { dropDate } from "../src/time";
import { A, B, O1, S, U, V, api, count, login, reset, sendForm, tinyPng } from "./harness";

const token: Record<string, string> = {};
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

beforeEach(async () => {
  await reset();
  for (const id of [A, B, O1, S, U, V]) token[id] = await login(id);
});

function prefs(ageMin = 23, ageMax = 36) {
  return { areas: ["Jubilee Hills"], languages: ["Telugu"], ageMin, ageMax, foods: ["Vegetarian"] };
}

async function upload(user: string, kind: "photo" | "voice" | "selfie", seconds?: string) {
  const form = new FormData();
  form.set("kind", kind);
  if (kind === "voice") {
    form.set("seconds", seconds ?? "5");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "clip.webm", { type: "audio/webm" }));
  } else {
    form.set("file", new File([tinyPng()], "a.png", { type: "image/png" }));
  }
  const saved = await sendForm("/media", token[user], form);
  expect(saved.status).toBe(200);
  return (saved.json as { key: string }).key;
}

describe("live routes", () => {
  it("validates preferences", async () => {
    expect((await api("/preferences", { method: "PUT", token: token[A], body: prefs(17, 30) })).text).toMatch(/bad age/);
    expect((await api("/preferences", { method: "PUT", token: token[A], body: prefs(18, 71) })).text).toMatch(/bad age/);
    expect((await api("/preferences", { method: "PUT", token: token[A], body: prefs(30, 25) })).text).toMatch(/bad age/);
    const saved = await api("/preferences", { method: "PUT", token: token[A], body: prefs(18, 70) });
    expect(saved.status).toBe(200);
    expect(saved.json).toMatchObject({ ageMin: 18, ageMax: 70, areas: ["Jubilee Hills"] });
    expect((await api("/preferences", { token: token[A] })).json).toMatchObject({ ageMin: 18, ageMax: 70 });
  });

  it("replaces contact hashes and the allowlist", async () => {
    const first = await api("/contacts", { method: "PUT", token: token[A], body: { hashes: [HASH_A, HASH_B, HASH_A] } });
    expect(first.status).toBe(200);
    expect(await count(`select count(*) as n from contact_hashes where owner_id = ?`, A)).toBe(2);
    await api("/contacts", { method: "PUT", token: token[A], body: { hashes: [HASH_C] } });
    expect(await count(`select count(*) as n from contact_hashes where owner_id = ?`, A)).toBe(1);
    expect(await count(`select count(*) as n from contact_hashes where owner_id = ? and hash = ?`, A, HASH_A)).toBe(0);
    const tooMany = Array.from({ length: 5001 }, (_, index) => index.toString(16).padStart(64, "0"));
    expect((await api("/contacts", { method: "PUT", token: token[A], body: { hashes: tooMany } })).status).toBe(400);
    expect((await api("/contacts", { method: "PUT", token: token[A], body: { hashes: ["zz"] } })).text).toMatch(/bad hash/);
    await api("/contacts/allowlist", { method: "PUT", token: token[A], body: { hashes: [HASH_B] } });
    expect(await count(`select count(*) as n from contact_allowlist where owner_id = ?`, A)).toBe(1);
    await api("/contacts/allowlist", { method: "PUT", token: token[A], body: { hashes: [] } });
    expect(await count(`select count(*) as n from contact_allowlist where owner_id = ?`, A)).toBe(0);
    expect(await count(`select count(*) as n from contact_hashes where owner_id = ?`, A)).toBe(1);
  });

  it("registers only the caller's photos and one voice", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const key = await upload(A, "photo");
      const saved = await api("/me/photos", { token: token[A], body: { key, main: i === 1 } });
      expect(saved.status).toBe(200);
      ids.push((saved.json as { id: string }).id);
    }
    const extra = await upload(A, "photo");
    expect((await api("/me/photos", { token: token[A], body: { key: extra } })).text).toMatch(/photo limit/);
    const foreign = await upload(B, "photo");
    expect((await api("/me/photos", { token: token[A], body: { key: foreign } })).text).toMatch(/not your media/);
    const mains = await env.DB.prepare(`select storage_path, is_main from profile_photos where user_id = ?`).bind(A).all<{ is_main: number }>();
    expect(mains.results.filter((row) => row.is_main === 1)).toHaveLength(1);
    expect((await api(`/me/photos/${ids[0]}`, { method: "DELETE", token: token[B] })).status).toBe(404);
    expect((await api(`/me/photos/${ids[0]}`, { method: "DELETE", token: token[A] })).status).toBe(200);
    expect(await count(`select count(*) as n from profile_photos where user_id = ?`, A)).toBe(5);

    const voice = await upload(A, "voice");
    expect((await api("/me/voice", { token: token[A], body: { key: voice, prompt: "", seconds: 5 } })).text).toMatch(/bad prompt/);
    expect((await api("/me/voice", { token: token[A], body: { key: voice, prompt: "Sunday", seconds: 0 } })).text).toMatch(/bad seconds/);
    expect((await api("/me/voice", { token: token[A], body: { key: foreign, prompt: "Sunday", seconds: 5 } })).text).toMatch(/not your media/);
    expect((await api("/me/voice", { token: token[A], body: { key: voice, prompt: "Sunday", seconds: 5 } })).status).toBe(200);
  });

  it("lists plans, deposits and member messages", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values ('match-ab', ?, ?, ?)`).bind(A, B, now).run();
    const created = await api("/plans", { token: token[A], body: { personId: B, venueId: "heartcup", slot: "Sat · 8:00 pm", kind: "coffee" } });
    const planId = (created.json as { id: string }).id;
    const listed = await api("/plans", { token: token[A] });
    const plan = (listed.json as { plans: { id: string; chatOpen: boolean; deposits: { userId: string; status: string }[]; partner: { id: string }; keptByMe: boolean }[] }).plans[0];
    expect(plan.id).toBe(planId);
    expect(plan.chatOpen).toBe(false);
    expect(plan.partner.id).toBe(B);
    expect(plan.deposits).toHaveLength(2);
    expect(plan.keptByMe).toBe(false);
    expect((await api(`/plans/${planId}/messages`, { token: token[A] })).text).toMatch(/chat closed/);
    expect((await api(`/plans/${planId}/messages`, { token: token[V] })).text).toMatch(/not in plan/);

    await api(`/service/deposits/${planId}/pay`, { service: true, body: { userId: A, paymentId: "pay_a" } });
    await api(`/service/deposits/${planId}/pay`, { service: true, body: { userId: B, paymentId: "pay_b" } });
    await env.DB.prepare(`insert into messages (id, plan_id, sender_id, body, created_at) values ('m1', ?, ?, 'earlier', '2026-01-01T00:00:00.000Z')`).bind(planId, A).run();
    await env.DB.prepare(`insert into messages (id, plan_id, sender_id, body, created_at) values ('m2', ?, ?, 'later', '2026-01-02T00:00:00.000Z')`).bind(planId, B).run();
    const open = await api("/plans", { token: token[B] });
    const theirs = (open.json as { plans: { chatOpen: boolean; keptByThem: boolean; deposits: { status: string }[] }[] }).plans[0];
    expect(theirs.chatOpen).toBe(true);
    expect(theirs.deposits.every((row) => row.status === "paid")).toBe(true);
    const messages = await api(`/plans/${planId}/messages`, { token: token[B] });
    expect((messages.json as { messages: { id: string }[] }).messages.map((row) => row.id)).toEqual(["m1", "m2"]);
    const earlier = await api(`/plans/${planId}/messages?before=2026-01-02T00:00:00.000Z`, { token: token[A] });
    expect((earlier.json as { messages: { id: string }[] }).messages.map((row) => row.id)).toEqual(["m1"]);
    await api(`/plans/${planId}/keep`, { method: "POST", token: token[A] });
    const kept = (await api("/plans", { token: token[A] })).json as { plans: { keptByMe: boolean; keptByThem: boolean }[] };
    expect(kept.plans[0].keptByMe).toBe(true);
    expect(kept.plans[0].keptByThem).toBe(false);
  });

  it("returns matches and received likes only through canView", async () => {
    const now = new Date().toISOString();
    await env.DB.prepare(`insert into matches (id, user_a, user_b, created_at) values ('match-ab', ?, ?, ?)`).bind(A, B, now).run();
    await env.DB.prepare(`insert into likes (from_id, to_id, created_at) values (?, ?, ?)`).bind(V, A, now).run();
    await env.DB.prepare(`insert into likes (from_id, to_id, created_at) values (?, ?, ?)`).bind(B, A, now).run();
    await env.DB.prepare(`update profiles set paused = 1 where id = ?`).bind(V).run();
    const likes = await api("/likes/received", { token: token[A] });
    expect((likes.json as { likes: { id: string; profile: { displayName: string } }[] }).likes.map((row) => row.id)).toEqual([B]);
    expect((likes.json as { likes: { profile: { dob?: string } }[] }).likes[0].profile.dob).toBeUndefined();
    await env.DB.prepare(`insert into blocks (blocker, blocked) values (?, ?)`).bind(A, B).run();
    const matches = await api("/matches", { token: token[A] });
    expect((matches.json as { matches: unknown[] }).matches).toEqual([]);
  });

  it("returns today's drop with a public profile and photo keys", async () => {
    const key = await upload(B, "photo");
    await api("/me/photos", { token: token[B], body: { key, main: true } });
    const date = dropDate();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values ('drop-a', ?, ?)`).bind(A, date).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values ('drop-a', ?, 1)`).bind(B).run();
    const drop = await api("/drop/today", { token: token[A] });
    const pick = (drop.json as { picks: { personId: string; position: number; profile: { id: string } | null; photos: string[] }[] }).picks[0];
    expect(pick.personId).toBe(B);
    expect(pick.position).toBe(1);
    expect(pick.profile?.id).toBe(B);
    expect(pick.photos).toEqual([key]);
  });

  it("keeps selfies owner-only and lets ops verify", async () => {
    const key = await upload(A, "selfie");
    const date = dropDate();
    await env.DB.prepare(`insert into drops (id, user_id, drop_date) values ('drop-b', ?, ?)`).bind(B, date).run();
    await env.DB.prepare(`insert into drop_picks (drop_id, person_id, position) values ('drop-b', ?, 1)`).bind(A).run();
    expect((await api(`/profiles/${A}`, { token: token[B] })).status).toBe(200);
    expect((await api(`/media/${key}`, { token: token[B] })).status).toBe(404);
    expect((await api(`/media/${key}`, { token: token[A] })).status).toBe(200);

    const selfie = await upload(U, "selfie");
    expect(selfie).toBeTruthy();
    expect((await api("/admin/verify-queue", { token: token[S] })).text).toMatch(/ops only/);
    expect((await api(`/admin/users/${U}/verify`, { method: "POST", token: token[S] })).status).toBe(403);
    await env.DB.prepare(`insert into staff_roles (user_id, role) values (?, 'ops')`).bind(O1).run();
    const queue = await api("/admin/verify-queue", { token: token[O1] });
    const entry = (queue.json as { queue: { id: string; selfies: string[] }[] }).queue.find((row) => row.id === U);
    expect(entry?.selfies).toEqual([selfie]);
    expect((await api(`/media/${selfie}`, { token: token[S] })).status).toBe(404);
    const seen = await SELF.fetch(`http://closer.test/media/${selfie}`, { headers: { authorization: `Bearer ${token[O1]}` } });
    await seen.arrayBuffer();
    expect(seen.status).toBe(200);
    expect(await count(`select count(*) as n from audit_log where actor = ? and action = 'view_selfie' and detail = ?`, O1, U)).toBe(1);
    expect((await api(`/admin/users/${U}/verify`, { method: "POST", token: token[O1] })).status).toBe(200);
    expect((await api(`/media/${selfie}`, { token: token[O1] })).status).toBe(404);
    expect(await count(`select count(*) as n from profiles where id = ? and verified = 1`, U)).toBe(1);
    expect(await count(`select count(*) as n from audit_log where actor = ? and role = 'ops' and action = 'verify' and detail = ?`, O1, U)).toBe(1);
    const after = await api("/admin/verify-queue", { token: token[O1] });
    expect((after.json as { queue: { id: string }[] }).queue.map((row) => row.id)).not.toContain(U);
  });

  it("promotes another photo when the main one is removed", async () => {
    const first = await api("/me/photos", { token: token[A], body: { key: await upload(A, "photo") } });
    const second = await api("/me/photos", { token: token[A], body: { key: await upload(A, "photo") } });
    expect((first.json as { main: boolean }).main).toBe(true);
    expect((second.json as { main: boolean }).main).toBe(false);
    expect((await api(`/me/photos/${(first.json as { id: string }).id}`, { method: "DELETE", token: token[A] })).status).toBe(200);
    expect(await count(`select count(*) as n from profile_photos where user_id = ? and is_main = 1`, A)).toBe(1);
  });

  it("stores a full contact book in one request", async () => {
    const book = Array.from({ length: 5000 }, (_, index) => index.toString(16).padStart(64, "0"));
    expect((await api("/contacts", { method: "PUT", token: token[A], body: { hashes: book } })).status).toBe(200);
    expect(await count(`select count(*) as n from contact_hashes where owner_id = ?`, A)).toBe(5000);
  });

  it("removes a deleted member's photos and selfie from storage", async () => {
    const photo = await upload(A, "photo");
    const selfie = await upload(A, "selfie");
    expect((await api("/account", { method: "DELETE", token: token[A] })).status).toBe(200);
    expect(await env.MEDIA.head(photo)).toBeNull();
    expect(await env.MEDIA.head(selfie)).toBeNull();
    expect(await count(`select count(*) as n from media_objects where owner_id = ?`, A)).toBe(0);
  });

  it("allows only listed origins and never cookie credentials", async () => {
    const ok = await SELF.fetch("http://closer.test/me", { method: "OPTIONS", headers: { origin: "http://localhost:5173" } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(ok.headers.get("access-control-allow-credentials")).toBeNull();
    const denied = await SELF.fetch("http://closer.test/me", { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    const read = await SELF.fetch("http://closer.test/drop/today", {
      headers: { origin: "http://localhost:5173", authorization: `Bearer ${token[A]}` },
    });
    expect(read.status).toBe(200);
    expect(read.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(read.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
