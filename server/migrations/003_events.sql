PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS game_round_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id TEXT,
  room_id TEXT,
  username TEXT,
  event_type TEXT,
  payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(round_id) REFERENCES game_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY(username) REFERENCES users(username) ON DELETE SET NULL
);