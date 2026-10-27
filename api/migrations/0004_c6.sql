-- One row per phone that opted in to the 9 pm Drop reminder.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  opted_in INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_opted ON push_subscriptions (opted_in);
