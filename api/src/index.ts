import { Hono } from "hono";
import { logout, requestOtp, userIdForToken, verifyOtp } from "./auth";
import { PlanChat } from "./chat";
import { buildTomorrowDrop } from "./drop";
import { PolicyError, fail, type Env } from "./env";
import { createVoiceRoom, issueRoomToken, joinChai, listVoiceRooms, revealChai } from "./livekit";
import { readMedia, storeMedia } from "./media";
import {
  addTrusted,
  assertChatAccess,
  blockPerson,
  claimGift,
  clearAway,
  confirmReport,
  confirmTrustedContact,
  consumeChatTicket,
  createPlan,
  deleteAccount,
  deleteProfilePhoto,
  fileReport,
  insertDebrief,
  issueChatTicket,
  keepChat,
  listBuckets,
  listMatches,
  listMyPlans,
  listPlanMessages,
  listReceivedLikes,
  listReports,
  listTrusted,
  listVisibleIds,
  markDepositPaid,
  readPhotos,
  readPreferences,
  readProfile,
  recordActivity,
  rejectMember,
  registerProfilePhoto,
  registerVoice,
  replaceAllowlist,
  replaceContactHashes,
  savePreferences,
  sendLike,
  setAway,
  setTrustedToken,
  todayDrop,
  updateProfile,
  verifyMember,
  verifyQueue,
} from "./policy";
import { pushStatus, sendDropReminders, subscribePush, unsubscribePush } from "./push";
import { createDepositOrder, handleRazorpayWebhook } from "./razorpay";
import { raiseSos } from "./sos";

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.onError((err, c) => {
  if (err instanceof PolicyError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  return c.json({ error: "error" }, 500);
});

function allowedOrigin(env: Env, origin: string) {
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return origin && list.includes(origin) ? origin : "";
}

app.use("*", async (c, next) => {
  const origin = c.req.header("origin") ?? "";
  const allowed = allowedOrigin(c.env, origin);
  if (c.req.method === "OPTIONS") {
    if (!allowed) return c.body(null, 403);
    c.header("access-control-allow-origin", allowed);
    c.header("vary", "Origin");
    c.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    c.header("access-control-allow-headers", "authorization,content-type");
    c.header("access-control-max-age", "600");
    return c.body(null, 204);
  }
  await next();
  if (allowed) {
    c.header("access-control-allow-origin", allowed);
    c.header("vary", "Origin");
  }
});

function service(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const token = c.env.SERVICE_TOKEN;
  return Boolean(token) && c.req.header("x-closer-service") === token;
}

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }
  const path = c.req.path;
  if (path.startsWith("/auth") || path.startsWith("/service") || path.startsWith("/webhooks") || path.startsWith("/trusted-contacts/confirm")) {
    await next();
    return;
  }
  const header = c.req.header("authorization");
  const ticket = path.endsWith("/chat") ? (c.req.query("ticket") ?? "") : "";
  if (ticket) {
    await next();
    return;
  }
  const userId = await userIdForToken(c.env.DB, header);
  if (!userId) return c.json({ error: "auth required" }, 401);
  c.set("userId", userId);
  await next();
});

app.post("/auth/otp", async (c) => {
  const body = await c.req.json<{ phone?: string }>();
  const result = await requestOtp(c.env, body.phone ?? "");
  return c.json(result);
});

app.post("/auth/verify", async (c) => {
  const body = await c.req.json<{ phone?: string; code?: string }>();
  return c.json(await verifyOtp(c.env, body.phone ?? "", body.code ?? ""));
});

app.post("/auth/logout", async (c) => {
  await logout(c.env.DB, c.req.header("authorization"));
  return c.json({ ok: true });
});

app.get("/me", async (c) => c.json(await readProfile(c.env.DB, c.get("userId"), c.get("userId"))));

app.patch("/me", async (c) => {
  const patch = await c.req.json<Record<string, unknown>>();
  return c.json(await updateProfile(c.env.DB, c.get("userId"), patch));
});

app.get("/profiles", async (c) => c.json({ ids: await listVisibleIds(c.env.DB, c.get("userId")) }));

app.get("/profiles/:id/photos", async (c) => {
  return c.json({ photos: await readPhotos(c.env.DB, c.get("userId"), c.req.param("id")) });
});

app.get("/profiles/:id", async (c) => c.json(await readProfile(c.env.DB, c.get("userId"), c.req.param("id"))));

app.get("/preferences", async (c) => c.json(await readPreferences(c.env.DB, c.get("userId"))));

app.put("/preferences", async (c) => {
  const body = await c.req.json<{ areas?: unknown; languages?: unknown; ageMin?: unknown; ageMax?: unknown; foods?: unknown }>();
  return c.json(await savePreferences(c.env.DB, c.get("userId"), body));
});

app.put("/contacts/allowlist", async (c) => {
  const body = await c.req.json<{ hashes?: unknown }>();
  return c.json(await replaceAllowlist(c.env.DB, c.get("userId"), body.hashes));
});

app.put("/contacts", async (c) => {
  const body = await c.req.json<{ hashes?: unknown }>();
  return c.json(await replaceContactHashes(c.env.DB, c.get("userId"), body.hashes));
});

app.post("/me/photos", async (c) => {
  const body = await c.req.json<{ key?: string; main?: boolean }>();
  return c.json(await registerProfilePhoto(c.env.DB, c.get("userId"), body.key ?? "", Boolean(body.main)));
});

app.delete("/me/photos/:id", async (c) => c.json(await deleteProfilePhoto(c.env.DB, c.get("userId"), c.req.param("id"))));

app.post("/me/voice", async (c) => {
  const body = await c.req.json<{ key?: string; prompt?: string; seconds?: number }>();
  return c.json(await registerVoice(c.env.DB, c.get("userId"), body.key ?? "", body.prompt ?? "", Number(body.seconds)));
});

app.get("/drop/today", async (c) => c.json(await todayDrop(c.env.DB, c.get("userId"))));

app.get("/matches", async (c) => c.json({ matches: await listMatches(c.env.DB, c.get("userId")) }));

app.get("/likes/received", async (c) => c.json({ likes: await listReceivedLikes(c.env.DB, c.get("userId")) }));

app.get("/plans", async (c) => c.json({ plans: await listMyPlans(c.env.DB, c.get("userId")) }));

app.get("/plans/:id/messages", async (c) => {
  const before = c.req.query("before");
  return c.json({ messages: await listPlanMessages(c.env.DB, c.get("userId"), c.req.param("id"), before || undefined) });
});

app.post("/likes", async (c) => {
  const body = await c.req.json<{ personId?: string; note?: string }>();
  await sendLike(c.env.DB, c.get("userId"), body.personId ?? "", body.note ?? "");
  return c.json({ ok: true });
});

app.post("/plans", async (c) => {
  const body = await c.req.json<{ personId?: string; venueId?: string; slot?: string; kind?: string }>();
  const id = await createPlan(c.env.DB, c.get("userId"), body.personId ?? "", body.venueId ?? "", body.slot ?? "", body.kind ?? "");
  const deposit = await c.env.DB.prepare(`select status from deposits where plan_id = ? and user_id = ?`).bind(id, c.get("userId")).first<{ status: string }>();
  return c.json({ id, deposit: deposit?.status ?? "unpaid" });
});

app.post("/plans/:id/chat-ticket", async (c) => {
  return c.json(await issueChatTicket(c.env.DB, c.get("userId"), c.req.param("id")));
});

app.post("/plans/:id/deposit/order", async (c) => {
  return c.json(await createDepositOrder(c.env.DB, c.env, c.get("userId"), c.req.param("id")));
});

app.get("/plans/:id/chat", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") return c.json({ error: "expected websocket" }, 426);
  const planId = c.req.param("id");
  const ticket = c.req.query("ticket") ?? "";
  const userId = ticket ? await consumeChatTicket(c.env.DB, planId, ticket) : c.get("userId");
  await assertChatAccess(c.env.DB, userId, planId);
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-closer-user", userId);
  headers.set("x-closer-plan", planId);
  const stub = c.env.PLAN_CHAT.get(c.env.PLAN_CHAT.idFromName(planId));
  return stub.fetch(new Request(c.req.url, { method: "GET", headers }));
});

app.post("/plans/:id/keep", async (c) => {
  await keepChat(c.env.DB, c.get("userId"), c.req.param("id"));
  return c.json({ ok: true });
});

app.post("/plans/:id/debrief", async (c) => {
  const body = await c.req.json<{ feel?: string; again?: string; note?: string }>();
  await insertDebrief(c.env.DB, c.get("userId"), c.req.param("id"), body.feel ?? "", body.again ?? "", body.note ?? "");
  return c.json({ ok: true });
});

app.post("/reports", async (c) => {
  const body = await c.req.json<{ againstId?: string; category?: string; detail?: string; severe?: boolean; status?: string; source?: string }>();
  await fileReport(c.env.DB, c.get("userId"), {
    againstId: body.againstId ?? "",
    category: body.category ?? "",
    detail: body.detail ?? "",
    severe: body.severe,
    status: body.status,
    source: body.source,
  });
  return c.json({ ok: true });
});

app.post("/blocks", async (c) => {
  const body = await c.req.json<{ personId?: string }>();
  await blockPerson(c.env.DB, c.get("userId"), body.personId ?? "");
  return c.json({ ok: true });
});

app.post("/away", async (c) => {
  const body = await c.req.json<{ kind?: string; until?: string | null }>();
  await setAway(c.env.DB, c.get("userId"), body.kind ?? "", body.until ?? null);
  return c.json({ ok: true });
});

app.delete("/away", async (c) => {
  await clearAway(c.env.DB, c.get("userId"));
  return c.json({ ok: true });
});

function confirmPage(token: string) {
  const button = token
    ? `<form method="post" action="/trusted-contacts/confirm?token=${encodeURIComponent(token)}"><button type="submit">Yes, I'll be their trusted contact</button></form>`
    : "<p>This link is missing a token.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Trusted contact</title></head><body><p>Someone asked you to be their trusted contact.</p>${button}</body></html>`;
}

function noStore(c: { header: (name: string, value: string) => void }) {
  c.header("cache-control", "no-store");
  c.header("x-robots-tag", "noindex");
}

app.get("/trusted-contacts", async (c) => c.json({ contacts: await listTrusted(c.env.DB, c.get("userId")) }));

app.get("/trusted-contacts/confirm", async (c) => {
  noStore(c);
  return c.html(confirmPage(c.req.query("token") ?? ""));
});

app.post("/trusted-contacts/confirm", async (c) => {
  const queryToken = c.req.query("token") ?? "";
  if (queryToken) {
    noStore(c);
    const page = (text: string) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Trusted contact</title></head><body><p>${text}</p></body></html>`;
    try {
      await confirmTrustedContact(c.env.DB, queryToken);
    } catch {
      // A person opened this link, not an app: a used or wrong link gets a sentence, not JSON.
      return c.html(page("This link has already been used or is no longer valid."), 400);
    }
    return c.html(page("You are a trusted contact."));
  }
  if (!service(c)) return c.json({ error: "permission denied" }, 403);
  const body = await c.req.json<{ token?: string }>();
  await confirmTrustedContact(c.env.DB, body.token ?? "");
  return c.json({ ok: true });
});

app.patch("/trusted-contacts/:id", async (c) => {
  const body = await c.req.json<{ confirmed?: boolean }>();
  if (body.confirmed !== undefined) fail("confirm via link");
  return c.json({ ok: true });
});

app.post("/trusted-contacts", async (c) => {
  const body = await c.req.json<{ name?: string; phone?: string; confirmed?: boolean }>();
  const created = await addTrusted(c.env.DB, c.get("userId"), body.name ?? "", body.phone ?? "", Boolean(body.confirmed));
  return c.json(created);
});

app.post("/streak/activity", async (c) => {
  const body = await c.req.json<{ kind?: string }>();
  const count = await recordActivity(c.env.DB, c.get("userId"), body.kind ?? "");
  return c.json({ count });
});

app.post("/gifts/claim", async (c) => {
  const body = await c.req.json<{ milestone?: number; gift?: string; address?: string }>();
  const id = await claimGift(c.env.DB, c.get("userId"), Number(body.milestone), body.gift ?? "", body.address ?? "");
  return c.json({ id });
});

app.get("/admin/verify-queue", async (c) => c.json({ queue: await verifyQueue(c.env.DB, c.get("userId")) }));

app.post("/admin/users/:id/verify", async (c) => c.json(await verifyMember(c.env.DB, c.get("userId"), c.req.param("id"))));

app.post("/admin/users/:id/reject", async (c) => {
  const body = await c.req.json<{ reason?: string }>();
  const result = await rejectMember(c.env.DB, c.get("userId"), c.req.param("id"), body.reason ?? "");
  if (result.selfieKeys.length) await c.env.MEDIA.delete(result.selfieKeys);
  return c.json({ ok: true });
});

app.get("/admin/reports", async (c) => c.json({ reports: await listReports(c.env.DB, c.get("userId")) }));

app.post("/admin/reports/:id/confirm", async (c) => {
  const body = await c.req.json<{ action?: string }>();
  await confirmReport(c.env.DB, c.get("userId"), c.req.param("id"), body.action ?? "");
  return c.json({ ok: true });
});

app.delete("/account", async (c) => {
  const userId = c.get("userId");
  // Photos, voice notes and the selfie leave storage too, not just the database.
  const media = await c.env.DB.prepare(`select id from media_objects where owner_id = ?`).bind(userId).all<{ id: string }>();
  if (media.results.length) await c.env.MEDIA.delete(media.results.map((row) => row.id));
  await deleteAccount(c.env.DB, userId);
  return c.json({ ok: true });
});

app.get("/media/buckets", async (c) => c.json({ buckets: await listBuckets(c.env.DB) }));

app.post("/media", async (c) => {
  const saved = await storeMedia(c.env.DB, c.env.MEDIA, c.get("userId"), await c.req.formData());
  return c.json(saved);
});

app.get("/media/:key", async (c) => readMedia(c.env.DB, c.env.MEDIA, c.get("userId"), c.req.param("key")));

app.post("/sos", async (c) => {
  const body = await c.req.json<{ planId?: string; lat?: number; lng?: number }>();
  return c.json(await raiseSos(c.env.DB, c.env, c.get("userId"), body));
});

app.get("/trusted-contacts/confirm/:token", async (c) => {
  await confirmTrustedContact(c.env.DB, c.req.param("token"));
  return c.json({ ok: true });
});

app.post("/webhooks/razorpay", async (c) => {
  const raw = await c.req.text();
  return c.json(await handleRazorpayWebhook(c.env.DB, c.env.RAZORPAY_WEBHOOK_SECRET, raw, c.req.header("x-razorpay-signature") ?? ""));
});

app.get("/rooms", async (c) => c.json({ rooms: await listVoiceRooms(c.env.DB, c.get("userId")) }));

app.get("/push", async (c) => c.json(await pushStatus(c.env.DB, c.get("userId"), c.env.VAPID_PUBLIC_KEY)));

app.post("/push", async (c) => {
  const body = await c.req.json<{ endpoint?: string; p256dh?: string; auth?: string; keys?: { p256dh?: string; auth?: string } }>();
  return c.json(
    await subscribePush(c.env.DB, c.get("userId"), {
      endpoint: body.endpoint,
      p256dh: body.p256dh ?? body.keys?.p256dh,
      auth: body.auth ?? body.keys?.auth,
    }),
  );
});

app.delete("/push", async (c) => c.json(await unsubscribePush(c.env.DB, c.get("userId"))));

app.post("/rooms", async (c) => {
  const body = await c.req.json<{ title?: string; topic?: string }>();
  return c.json(await createVoiceRoom(c.env.DB, c.get("userId"), body.title ?? "", body.topic ?? ""));
});

app.post("/rooms/chai", async (c) => c.json(await joinChai(c.env.DB, c.get("userId"))));

app.post("/rooms/chai/:id/reveal", async (c) => c.json(await revealChai(c.env.DB, c.get("userId"), c.req.param("id"))));

app.post("/rooms/:id/token", async (c) => {
  const token = await issueRoomToken(c.env.DB, c.env.LIVEKIT_API_KEY, c.env.LIVEKIT_API_SECRET, c.get("userId"), c.req.param("id"));
  return c.json({ token });
});

app.post("/service/deposits/:planId/pay", async (c) => {
  if (!service(c)) return c.json({ error: "permission denied" }, 403);
  const body = await c.req.json<{ paymentId?: string; userId?: string }>();
  await markDepositPaid(c.env.DB, c.req.param("planId"), body.userId ?? "", body.paymentId ?? "");
  return c.json({ ok: true });
});

app.post("/service/trusted-contacts/:id/token", async (c) => {
  if (!service(c)) return c.json({ error: "permission denied" }, 403);
  const body = await c.req.json<{ token?: string }>();
  await setTrustedToken(c.env.DB, c.req.param("id"), body.token ?? "");
  return c.json({ ok: true });
});

app.get("/service/trusted-contacts/:id/token", async (c) => {
  if (!service(c)) return c.json({ error: "permission denied" }, 403);
  const row = await c.env.DB.prepare(`select confirm_token from trusted_contacts where id = ?`)
    .bind(c.req.param("id"))
    .first<{ confirm_token: string | null }>();
  return c.json({ token: row?.confirm_token ?? null });
});

export { PlanChat };

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    const when = new Date(_event.scheduledTime);
    ctx.waitUntil(Promise.all([buildTomorrowDrop(env.DB, when), sendDropReminders(env)]));
  },
};
