-- Accounts (OAuth) + saved squads. Sessions are stateless signed JWTs, so no
-- session table. A user's linked device guest id ties their pre-signup games to
-- the account.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,            -- "<provider>:<provider_id>"
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  avatar TEXT,
  guest_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS squads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  faction TEXT NOT NULL,
  xws TEXT NOT NULL,              -- serialized XWS squad
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS squads_user ON squads (user_id);
