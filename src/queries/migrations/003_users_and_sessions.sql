-- Accounts. Only admins can change site content; 'user' accounts are for
-- future features (registration is off unless ALLOW_REGISTRATION=true).
CREATE TABLE IF NOT EXISTS users (
  ID SERIAL PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  disabled BOOLEAN NOT NULL DEFAULT false,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT NULL
);
-- Usernames are unique regardless of case ("Carter" and "carter" are the same)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

-- Login sessions (used by express-session through connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire ON session (expire);
