# Closer: Cursor build review (`tharigopulavijay/closer1`, main @ d029c9a) and the combined plan

Reviewed 26 October 2026. I cloned the repo, ran `npm ci`, ran the tests (13/13 pass), ran `npm run build` (clean), opened it on a phone-sized screen, and read `0001_init.sql`, all 4 Edge Functions and the rule logic.

## Cursor vs Gemini, side by side

| | Gemini (`closer.zip`) | Cursor (`closer1`) |
|---|---|---|
| Looks like the designs | ✅ **Close** (photos, cards, Charminar headers) | ⚠️ Plainer: initials instead of faces |
| Code structure | One big file per tab | ✅ Routes, rule logic in its own module, typed API files |
| Tests | None | ✅ 13 rule tests |
| Database schema | None | ✅ 25 tables with RLS (needs fixes, below) |
| Server functions | None | ⚠️ 4 functions, all placeholders |
| Contacts hashed on device | ❌ Claimed, not done | ✅ Real SHA-256 of E.164 numbers |
| `npm install` works | ❌ Needs a workaround | ✅ |

**Decision:** **Cursor's repo is the base.** Its engineering is the stronger foundation. We bring Gemini's *visual layer* over it (photo cards, hero headers, Drop and profile layouts) so it looks like the designs. That's the "one best output."

---

## Short fix list (product rules)

### 🔴 Critical: the app breaks or the rules can be bypassed

1. **The profiles security rule will crash every profile query.** The `profiles_own` policy reads `public.profiles me` *inside* a policy on `profiles`. Postgres stops with "infinite recursion detected in policy". → Move "my phone hash" into a `security definer` function `my_phone_hash()` and call that.
2. **The app doesn't use the database at all.** `getSupabase()` is never called. Drops, likes, streaks, plans, deposits, strikes and bans all run in the browser's own state, so every "server-side" rule is currently client-side. → Wire each `src/features/*/api.ts` to Supabase (RPCs and Edge Functions) when env vars are set. Keep preview mode as-is.
3. **Likes can target anyone.** `likes_insert` only checks `from_id = auth.uid()`. A user can like any profile ID, including unverified, banned, blocked or contact-hidden profiles, and can mass-like. → Insert likes only through an RPC `send_like(person)` that requires the person to be in *my* drop picks (or a Rooms/Play connection), verified, not blocked either way, and that I'm not banned.
4. **Bans don't stop anything.** A banned user can still insert likes and reports, call `create_plan`, and read profiles. The client bans by **name string** (`bans: [report.againstName]`), not by user ID. → Add an `is_banned(uid)` check to every insert policy and RPC; key bans by `user_id`.
5. **There is no way to send a chat message.** There's no insert policy, no RPC, and `moderate-message` neither authenticates nor inserts anything. → One Edge Function `send-message`: verify JWT → check membership of the plan → check the chat is open (48-hour rule) → moderate (Telugu, Hindi, English, Hinglish) → insert with the service role. Return held/blocked honestly. Delete the duplicate client word list or generate both from one shared file.
6. **The 48-hour chat rule isn't in the database.** `plans` has no `booked_at`, `kept_by_owner` or `kept_by_person` columns, and only client code computes it. → Add the columns; set `booked_at` when the deposit is verified; `keep_chat(plan)` RPC; `send-message` enforces `now() < booked_at + 48h OR (kept_by_owner AND kept_by_person)`.
7. **Deposits have no payment path.** `create_plan` makes a plan with an "unpaid" deposit, and nothing marks it paid. → A `deposit-webhook` Edge Function (Razorpay signature check, idempotent on payment ID) sets `paid` + `booked_at`. The client can never change deposit status.
8. **Free gifts are possible.** `gifts_insert` lets any user claim any milestone. → `claim_gift(milestone, gift, address)` RPC that checks `streaks.count >= milestone` and a `unique (user_id, milestone)`; that milestone is for Closer+ members only.
9. **Strikes and bans have no server logic.** → A `confirm_report(report_id, action)` RPC for the `safety` role only: writes the strike, auto-bans at the 3rd confirmed minor strike or on the first severe one, writes `audit_log`. AI flags never count as strikes on their own.
10. **Drops are picked in the browser** (`selectDrop` in `drop/api.ts`) and `generate-drop` is a stub. → Move selection into the scheduled `generate-drop` function (21:00 IST, service role) with the same hard filters; the client only reads `drop_picks`.

### 🟠 Important

11. **Verified-only:** unverified users can still *browse* verified profiles. Add "viewer is verified" to `profiles_own` and `photos_read` (except for their own rows).
12. **Age:** `dob` stays editable after signup. Add `check (dob <= current_date - interval '18 years')` and protect `dob` in `protect_profile_fields` once verified.
13. **Streak:** `record_drop_open` ignores freezes, Away mode, and Rooms/Play activity. Make it one function `record_activity(kind)` that applies the 2-per-month freezes and the Away freeze, matching `recordActivity` in the client tests.
14. **Open-plan limit** counts only the plan's owner. Count plans where the user is owner **or** person, and block a second open plan with the same person.
15. **Deleting an account fails:** foreign keys without `on delete` (drop_picks.person_id, plans.person_id, messages.sender_id, reports, strikes, bans, debriefs, safety_sessions, sos_events, gift_claims) block it. Decide cascade versus anonymise for each table; keep safety evidence.
16. **Users can self-set values they shouldn't:** `trusted_contacts.confirmed` (should become true only via the SMS link function), `debriefs` for plans they're not in, and `reports.status` on insert. Tighten the `with check` rules.
17. **Edge Functions don't check who's calling.** All 4 accept anonymous requests. `sos-trigger` returns `ok: true` without sending anything, and `issue-room-token` returns a fake token. Verify the JWT in each; SOS must return `sent: false` until SMS/WhatsApp is wired, and the UI must say "Calling 112…" only.
18. **No storage buckets or policies** for photos, voice or the selfie video. Add private buckets plus owner-only write and signed-URL read.

### ✅ Already correct
- Contacts hashed on the device (E.164 → SHA-256); only hashes leave the phone.
- `verified` and `phone_hash` can't be changed by the client (trigger).
- Saathi is labelled "AI · not a person on Closer", and its replies say it's an AI.
- No "see who liked you"; matches are created only by a mutual-like trigger.
- `drops`, `matches`, `streaks`, `deposits`, `strikes` and `bans` have no client insert policy.

---

## How we split the work

| Who | Does what |
|---|---|
| **You** | Product decisions, testing on your phone, accounts (Supabase, Razorpay, LiveKit, Exotel/MSG91) |
| **Cursor** | Writes and runs the code: SQL, Edge Functions, wiring, tests, UI port. One task per branch, then a pull request |
| **Claude (me)** | Research, writing each Cursor task, reviewing every pull request on GitHub (security, rules, logic), the final production checklist |
| **Gemini** | Paused (credits used up). Its code is the visual reference for the UI port |

I can read the repo with your GitHub login (cloning worked). If you also give me write access, I can comment directly on Cursor's pull requests.

### Step 1: ask Cursor what it can do (paste this into Cursor chat)
```
Before we assign work, answer briefly, yes/no plus one line each:
1. Can you run the Supabase CLI locally here (supabase start / db reset) with Docker, and run SQL tests (pgTAP or
   a TS test that logs in as two users) against the real local database?
2. Can you deploy Supabase migrations and Edge Functions to a hosted project if I give you a project ref
   and access token as environment variables (not pasted in chat)?
3. Can you run the app in a browser and click through flows (Cursor browser / Playwright) to verify UI?
4. Can you work as a background agent on a branch and open a GitHub pull request on tharigopulavijay/closer1?
5. Which model are you using, and what is your practical limit per task (files / hours)?
6. Can you use MCP servers (for example Supabase MCP or GitHub MCP) in this workspace?
```

### Step 2: the first task for Cursor (after it answers)
```
Task 1 — database correctness (branch: fix/rls-and-rules). Use supabase/migrations/0002_rules.sql; don't edit 0001.
Implement fixes 1, 3, 4, 6, 7(schema only), 8, 9, 11, 12, 13, 14, 15, 16, 18 from
docs/Closer_Cursor_Review_and_Plan.md (I will add that file to the repo).
Add tests in supabase/tests/ that sign in as three users (A, B, banned C) on a local Supabase and prove:
- A can read B only when B is verified, not blocked, not hidden by contacts;
- profile query does not error (no RLS recursion);
- C cannot like, create plans, or report; A cannot like someone not in A's drop;
- A cannot claim a gift above A's streak; nobody but the safety role can confirm strikes; 3rd minor strike bans;
- open-plan limit counts both people; deleting A's account succeeds.
All tests must pass with `supabase db reset && npm run test:db`. Open a PR with a summary of what changed.
```
### Step 2, revised after Cursor's answers (26 Oct 2026)

Cursor's answers: no Docker, no local Supabase, it can't push to this repo, it uses Grok 4.7, and one task fits in one turn. So:
- **Database tests run on PGlite** (real Postgres compiled to WebAssembly; it runs inside `npm test` with no Docker and no hosted project). A small setup file creates a fake `auth` schema so `auth.uid()`, `auth.jwt()` and `auth.role()` work, then applies 0001 + 0002 and switches between users.
- **Getting code into GitHub:** Claude's GitHub login (`tharigopulavijay`) has admin on `closer1`. Either connect Cursor to the `tharigopulavijay` account (Cursor Settings → GitHub), or Cursor leaves the work in its folder and Claude commits it to a branch and opens the PR.

```
Task 1 — database correctness. Create supabase/migrations/0002_rules.sql (do not edit 0001) implementing fixes
1, 3, 4, 6, 7 (schema only), 8, 9, 11, 12, 13, 14, 15, 16, 18 from docs/Closer_Cursor_Review_and_Plan.md.

Testing without Docker: add devDependency @electric-sql/pglite. Create supabase/tests/setup.ts that:
- starts PGlite, creates schema auth with table auth.users(id uuid primary key), roles anon, authenticated,
  service_role, and functions auth.uid(), auth.role(), auth.jwt() that read
  current_setting('request.jwt.claims', true)::jsonb (sub, role, app_metadata);
- applies 0001_init.sql then 0002_rules.sql;
- exposes asUser(id, roles?) / asService() helpers that SET ROLE and set request.jwt.claims for a transaction.
If a Supabase-only feature (storage schema, pg_cron) breaks PGlite, stub it in setup.ts and say so in the PR text.
Write supabase/tests/rules.db.test.ts (vitest) with users A, B, banned C, staff S (role safety) proving:
- A reads B only when B is verified, not blocked either way, not hidden by contacts; the profile query never errors;
- an unverified user cannot read other profiles;
- C cannot like, create plans, report or send messages; A cannot like someone outside A's drop picks;
- A cannot claim a gift above A's streak, or the same milestone twice;
- only S can confirm a strike; the 3rd confirmed minor strike bans; one severe confirmation bans;
- the open-plan limit counts plans where the user is owner or person; no 2 open plans with the same person;
- deleting A's account succeeds and keeps reports/strikes against A for safety.
Add script "test:db": "vitest run supabase/tests". npm test and npm run build must stay green.
Finish with a summary listing each fix number and the test that proves it.
```

After this, Task 2 is the `send-message` + `deposit-webhook` + `generate-drop` functions, Task 3 is wiring the client to Supabase, and Task 4 is the UI port from Gemini. I'll write each one when the previous pull request is reviewed.
