-- Chat tickets are stored only as SHA-256 hashes. Razorpay order ids sit on the deposit.
ALTER TABLE deposits ADD COLUMN order_id TEXT;

CREATE TABLE IF NOT EXISTS chat_tickets (
  token_hash TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
