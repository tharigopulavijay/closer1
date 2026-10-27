import { Hono } from "hono";
import { logout, requestOtp, userIdForToken, verifyOtp } from "./auth";
import { PolicyError, fail, type Env } from "./env";
import {
  addTrusted,
  blockPerson,
  claimGift,
  clearAway,
  confirmReport,
  confirmTrustedContact,
  createPlan,
  deleteAccount,
  fileReport,
  insertDebrief,
  keepChat,
  listBuckets,
  listMedia,
  listTrusted,
  listVisibleIds,
  markDepositPaid,
  putMedia,
  readPhotos,
  readProfile,
  recordActivity,
  sendLike,
  setAway,
  setTrustedToken,
  todayDrop,
  updateProfile,
} from "./policy";

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

app.onError((err, c) => {
  if (err instanceof PolicyError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  return c.json({ error: "error" }, 500);
});

function service(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const token = c.env.SERVICE_TOKEN;
  return Boolean(token) && c.req.header("x-closer-service") === token;
}

app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/auth") || c.req.path.startsWith("/service")) {
    await next();
    return;
  }
  const userId = await userIdForToken(c.env.DB, c.req.header("authorization"));
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

app.get("/drop/today", async (c) => c.json(await todayDrop(c.env.DB, c.get("userId"))));

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

app.get("/trusted-contacts", async (c) => c.json({ contacts: await listTrusted(c.env.DB, c.get("userId")) }));

app.post("/trusted-contacts/confirm", async (c) => {
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
  const body = await c.req.json<{ name?: string; phoneHash?: string; confirmed?: boolean }>();
  const created = await addTrusted(c.env.DB, c.get("userId"), body.name ?? "", body.phoneHash ?? "", Boolean(body.confirmed));
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

app.post("/admin/reports/:id/confirm", async (c) => {
  const body = await c.req.json<{ action?: string }>();
  await confirmReport(c.env.DB, c.get("userId"), c.req.param("id"), body.action ?? "");
  return c.json({ ok: true });
});

app.delete("/account", async (c) => {
  await deleteAccount(c.env.DB, c.get("userId"));
  return c.json({ ok: true });
});

app.get("/media/buckets", async (c) => c.json({ buckets: await listBuckets(c.env.DB) }));

app.post("/media", async (c) => {
  const body = await c.req.json<{ bucket?: string; name?: string }>();
  await putMedia(c.env.DB, c.get("userId"), body.bucket ?? "", body.name ?? "");
  return c.json({ ok: true });
});

app.get("/media", async (c) => {
  return c.json({ objects: await listMedia(c.env.DB, c.get("userId"), service(c)) });
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

export default app;
