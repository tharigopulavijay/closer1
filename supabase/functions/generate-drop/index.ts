// Scheduled for 21:00 Asia/Kolkata. Hard filters: verified, intent, preferences,
// area, contact hide, blocks. Scoring: shared interests, languages, recency.
// The client cannot insert into drops.

Deno.serve(async () => {
  return Response.json({ ok: true, note: "Wire this to public.record_drop_open and drop_picks." });
});
