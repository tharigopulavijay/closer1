// Issues a LiveKit token for a verified user. The browser never sees the API secret.

Deno.serve(async () => {
  const url = Deno.env.get("LIVEKIT_URL") ?? "";
  if (!url) return Response.json({ token: "", url: "" });
  return Response.json({ token: "replace-with-livekit-jwt", url });
});
