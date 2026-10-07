const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const databasePath = path.resolve(
  process.env.DATABASE_PATH ||
    "./data/social-studio.db"
);

fs.mkdirSync(
  path.dirname(databasePath),
  {
    recursive: true
  }
);

const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL
      CHECK (source_type IN ('url', 'markdown')),
    source_url TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (
        status IN (
          'draft',
          'approved',
          'rejected',
          'published'
        )
      ),
    validation_result TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,

    FOREIGN KEY (post_id)
      REFERENCES posts(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id INTEGER NOT NULL,
    scheduled_at TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'scheduled'
      CHECK (
        status IN (
          'scheduled',
          'processing',
          'published',
          'failed'
        )
      ),

    idempotency_key TEXT NOT NULL UNIQUE,

    created_at TEXT NOT NULL,
    published_at TEXT,

    FOREIGN KEY (variant_id)
      REFERENCES variants(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_schedule_slots_due
  ON schedule_slots(status, scheduled_at);  

`);

module.exports = db;