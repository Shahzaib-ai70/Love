PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
  ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  media_data TEXT NOT NULL DEFAULT '',
  media_file_name TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'text',
  source_local_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, source_local_id)
);

CREATE INDEX IF NOT EXISTS memories_user_created_at_idx
  ON memories(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_invites (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (sender_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_invites_pending_pair_idx
  ON partner_invites (
    MIN(sender_id, recipient_id),
    MAX(sender_id, recipient_id)
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS partner_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  linked_at TEXT NOT NULL,
  CHECK (user_id <> partner_id)
);

CREATE INDEX IF NOT EXISTS partner_links_partner_id_idx
  ON partner_links(partner_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS chat_messages_pair_created_at_idx
  ON chat_messages(sender_id, recipient_id, created_at);
