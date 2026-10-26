// Deployed source of truth for chat delivery. Keep phrases aligned with
// src/features/safety/api.ts. The client copy is only a preview.

const severe = ["send nudes", "kill you", "send money", "gpay", "phonepe", "paisa bhej", "dabbulu pampu", "i am 17", "i'm 16"];

Deno.serve(async (request) => {
  const { body } = await request.json();
  const text = String(body ?? "").toLowerCase();
  const hit = severe.find((phrase) => text.includes(phrase));
  return Response.json({ allow: !hit, rule: hit ? "severe" : "ok" });
});
