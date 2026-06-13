export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  tg_id            INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  tz_offset_min    INTEGER NOT NULL DEFAULT 0,
  daily_goal_ml    INTEGER NOT NULL DEFAULT 2000,
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS water_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_tg_id  INTEGER NOT NULL REFERENCES users(tg_id),
  amount_ml   INTEGER NOT NULL CHECK(amount_ml > 0),
  logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  source      TEXT NOT NULL CHECK(source IN ('command', 'button'))
);

CREATE TABLE IF NOT EXISTS streaks (
  user_tg_id   INTEGER PRIMARY KEY REFERENCES users(tg_id),
  current_days INTEGER NOT NULL DEFAULT 0,
  longest_days INTEGER NOT NULL DEFAULT 0,
  last_met_date TEXT
);

CREATE TABLE IF NOT EXISTS sip_grants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_tg_id  INTEGER NOT NULL REFERENCES users(tg_id),
  amount      INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  granted_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders_sent (
  user_tg_id INTEGER NOT NULL REFERENCES users(tg_id),
  local_date TEXT NOT NULL,
  hour       INTEGER NOT NULL,
  PRIMARY KEY (user_tg_id, local_date, hour)
);
`;
