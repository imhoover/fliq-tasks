CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_uses (state TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE tasks (
  user_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL, title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('inbox','doing','done')),
  starred INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX tasks_owner ON tasks(user_id, created_at DESC);
CREATE TABLE limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, expires_at INTEGER NOT NULL);
