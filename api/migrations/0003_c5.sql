-- Voice rooms and the note ops leaves when a selfie has to be retaken.
ALTER TABLE profiles ADD COLUMN retake_note TEXT;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'room' CHECK (kind IN ('room', 'chai')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('speaker', 'listener')),
  guest_name TEXT NOT NULL DEFAULT '',
  revealed INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS room_members_room ON room_members (room_id, role);
