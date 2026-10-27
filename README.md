# Closer

A mobile-first dating and friends app for Hyderabad. React, TypeScript, Vite and Tailwind. The phone frame is 430px wide. The live path is a Cloudflare Worker; the preview runs on local data so every screen works before `VITE_API_URL` is set.

## Run

```bash
cd closer
npm install
npm test
npm run dev
```

Open the app and choose **Look around first** to enter a verified preview profile, or start with a phone number. The preview OTP is `482913` while `VITE_API_URL` is unset. Do not put real keys in the repo.

## Run live locally

```bash
cp api/.dev.vars.example api/.dev.vars
npm run api:dev
```

Apply `api/migrations/0001_schema.sql` and `api/migrations/0002_c4.sql` to the local D1 database (`wrangler d1 migrations apply` against the database in `api/wrangler.jsonc`). In another terminal:

```bash
VITE_API_URL=/api npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8787`. Sign in with any Indian mobile number and the `DEV_OTP` from `api/.dev.vars` (`123456` in the example). `DEV_OTP` works only when `ENVIRONMENT` is `development` or `test`.

Optional:

- `VITE_LIVEKIT_URL` for voice rooms
- Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`), SMS and the liveness check stay on the server. Do not commit those secrets.

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
