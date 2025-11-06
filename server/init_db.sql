-- init_db.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT,
  role TEXT DEFAULT 'player',
  balance INTEGER NOT NULL DEFAULT 1000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(host) REFERENCES users(username) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS room_players (
  room_id TEXT,
  username TEXT,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(room_id, username),
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS room_bets (
  room_id TEXT,
  username TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(room_id, username),
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

-- Audit: store each game round details (seed, deals, evaluations, winners)
CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY,
  room_id TEXT,
  game_type TEXT, -- 'poker' | 'qiuqiu' | 'samgong'
  seed TEXT,
  deals TEXT,         -- JSON string
  evaluations TEXT,   -- JSON string
  winners TEXT,       -- JSON string (array)
  bets_snapshot TEXT, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- Normalized payouts for audit: one row per (round, username, amount)
CREATE TABLE IF NOT EXISTS round_payouts (
  round_id TEXT,
  username TEXT,
  amount INTEGER NOT NULL,
  PRIMARY KEY(round_id, username),
  FOREIGN KEY(round_id) REFERENCES game_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);