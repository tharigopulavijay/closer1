# Closer

A mobile-first dating and friends app for Hyderabad. React, TypeScript, Vite and Tailwind. The phone frame is 430px wide. Supabase, LiveKit and boardgame.io are wired as the production path; the preview runs on local data so every screen works before keys exist.

## Run

```bash
cd closer
npm install
npm test
npm run dev
```

Open the app and choose **Look around first** to enter a verified preview profile, or start with a phone number. The preview OTP is `482913` until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Do not put real keys in the repo.

Optional:

- `VITE_LIVEKIT_URL` for voice rooms
- Razorpay, SMS and the liveness vendor stay behind `payDeposit`, `verifySelfie` and the edge functions

## What is enforced

- 18+ on the date of birth, in Asia/Kolkata
- Contact numbers are SHA-256 hashed on the device; raw numbers are not uploaded
- Unverified profiles never appear in the Drop
- Hide-from-contacts defaults on, with an allow-list
- At most three open plans (four on Closer+)
- Plan chat closes 48 hours after booking unless both people keep it
- Messages are moderated before they are delivered
- Streaks, deposits, strikes and bans are not client-writable in the SQL migration
- SOS hold is two seconds, then `tel:112` and the alert, with no extra confirmation
- No real-money games

## Licences

MIT and Apache-2.0 notices are in `LICENSES/`. The in-app list is under You → Open-source licences.
