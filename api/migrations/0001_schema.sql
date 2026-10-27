-- SQLite port of supabase/migrations/0001_init.sql, 0002_rules.sql and
-- 0003_hardening.sql, plus the auth tables for the Worker.
-- Foreign keys match the final Postgres shape: safety evidence (reports
-- against a person, strikes, bans, sos) keeps its id when a user is deleted.
-- Rules live in api/src/policy.ts. SQLite has no row level security.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS otp_codes_phone_created ON otp_codes (phone_hash, created_at);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  dob TEXT,
  gender TEXT,
  show_me TEXT,
  intent TEXT,
  area TEXT,
  phone_hash TEXT UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  hide_from_contacts INTEGER NOT NULL DEFAULT 1,
  paused INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  closer_plus INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_roles (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('safety', 'ops', 'finance')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS profile_photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  is_main INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS voice_answers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  seconds INTEGER NOT NULL CHECK (seconds BETWEEN 1 AND 30)
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  areas TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  age_min INTEGER NOT NULL DEFAULT 18,
  age_max INTEGER NOT NULL DEFAULT 70,
  foods TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS contact_hashes (
  owner_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  PRIMARY KEY (owner_id, hash)
);

CREATE TABLE IF NOT EXISTS contact_allowlist (
  owner_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  PRIMARY KEY (owner_id, hash)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  blocked TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  PRIMARY KEY (blocker, blocked)
);

CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  drop_date TEXT NOT NULL,
  UNIQUE (user_id, drop_date)
);

CREATE TABLE IF NOT EXISTS drop_picks (
  drop_id TEXT NOT NULL REFERENCES drops (id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  PRIMARY KEY (drop_id, position)
);

CREATE TABLE IF NOT EXISTS likes (
  from_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS streaks (
  user_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  last_date TEXT,
  freezes_left INTEGER NOT NULL DEFAULT 2,
  freeze_month TEXT NOT NULL DEFAULT '',
  frozen_by_away INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  person_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  venue_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  booked_at TEXT,
  kept_by_owner INTEGER NOT NULL DEFAULT 0,
  kept_by_person INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deposits (
  plan_id TEXT PRIMARY KEY REFERENCES plans (id) ON DELETE CASCADE,
  amount_inr INTEGER NOT NULL DEFAULT 99,
  status TEXT NOT NULL DEFAULT 'unpaid',
  payment_id TEXT,
  booked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS deposits_payment_id_key ON deposits (payment_id) WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS away_status (
  user_id TEXT PRIMARY KEY REFERENCES profiles (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  until TEXT
);

CREATE TABLE IF NOT EXISTS debriefs (
  plan_id TEXT PRIMARY KEY REFERENCES plans (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  feel TEXT NOT NULL,
  again TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS trusted_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  confirm_token TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS safety_sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES plans (id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,
  checked_in_at TEXT,
  prompt_at TEXT,
  answered_at TEXT
);

CREATE TABLE IF NOT EXISTS sos_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT REFERENCES plans (id) ON DELETE SET NULL,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES profiles (id) ON DELETE SET NULL,
  against_id TEXT,
  category TEXT NOT NULL,
  severe INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strikes (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL UNIQUE REFERENCES reports (id),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bans (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gift_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  milestone INTEGER NOT NULL,
  gift TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, milestone)
);

CREATE TABLE IF NOT EXISTS social_connections (
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('room', 'play')),
  PRIMARY KEY (user_id, person_id)
);

CREATE TABLE IF NOT EXISTS media_buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media_objects (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL REFERENCES media_buckets (id),
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL
);

INSERT OR IGNORE INTO media_buckets (id, name, public) VALUES
  ('photos', 'photos', 0),
  ('voice', 'voice', 0),
  ('selfies', 'selfies', 0);

CREATE TRIGGER IF NOT EXISTS profiles_adult_insert
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN NEW.dob IS NOT NULL AND NEW.dob > date('now', '-18 years')
BEGIN
  SELECT RAISE(ABORT, 'under 18');
END;

CREATE TRIGGER IF NOT EXISTS profiles_adult_update
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN NEW.dob IS NOT NULL AND NEW.dob > date('now', '-18 years')
BEGIN
  SELECT RAISE(ABORT, 'under 18');
END;
