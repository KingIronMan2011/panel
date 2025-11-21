ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN suspended_at INTEGER;
ALTER TABLE users ADD COLUMN suspension_reason TEXT;
ALTER TABLE users ADD COLUMN password_reset_required INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sessions ADD COLUMN impersonated_by TEXT;

CREATE TABLE user_impersonation_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX user_impersonation_tokens_user_id_index ON user_impersonation_tokens(user_id);
CREATE INDEX user_impersonation_tokens_token_hash_index ON user_impersonation_tokens(token_hash);
