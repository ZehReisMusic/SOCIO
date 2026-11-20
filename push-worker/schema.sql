CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 subscription TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 last_test_at INTEGER NOT NULL DEFAULT 0,
 test_day TEXT NOT NULL DEFAULT '',
 tests_today INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reminders (
 id TEXT PRIMARY KEY,
 device_id TEXT NOT NULL,
 title TEXT NOT NULL,
 due_at INTEGER NOT NULL,
 sent_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders(sent_at,due_at);
CREATE INDEX IF NOT EXISTS reminders_device ON reminders(device_id);
