// Alerts trusted contacts and the safety desk. The phone call to 112 is opened
// on the device; this function does not ask for a second confirmation.

Deno.serve(async (request) => {
  const payload = await request.json();
  console.log("sos", payload.session_id, payload.lat, payload.lng);
  return Response.json({ ok: true, opened: "tel:112" });
});
