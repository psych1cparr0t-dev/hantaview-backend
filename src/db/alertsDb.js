const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'alerts.db');
const db = new Database(dbPath);

// WAL mode: better concurrency under load
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    north       REAL NOT NULL,
    south       REAL NOT NULL,
    east        REAL NOT NULL,
    west        REAL NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notified (
    subscription_id   TEXT NOT NULL,
    case_fingerprint  TEXT NOT NULL,
    notified_at       TEXT NOT NULL,
    PRIMARY KEY (subscription_id, case_fingerprint)
  );

  CREATE INDEX IF NOT EXISTS idx_subs_email ON subscriptions(email);
`);

logger.info({ message: `AlertsDB ready at ${dbPath}` });

// ─── Prepared statements ──────────────────────────────────────────────────────
const stmts = {
  insertSub: db.prepare(`
    INSERT INTO subscriptions (id, email, north, south, east, west, created_at)
    VALUES (@id, @email, @north, @south, @east, @west, @created_at)
  `),
  getSub:        db.prepare('SELECT * FROM subscriptions WHERE id = ?'),
  deleteSub:     db.prepare('DELETE FROM subscriptions WHERE id = ?'),
  getAllSubs:    db.prepare('SELECT * FROM subscriptions'),
  countByEmail:  db.prepare('SELECT COUNT(*) AS count FROM subscriptions WHERE email = ?'),
  isNotified:    db.prepare('SELECT 1 FROM notified WHERE subscription_id = ? AND case_fingerprint = ?'),
  insertNotified: db.prepare(`
    INSERT OR IGNORE INTO notified (subscription_id, case_fingerprint, notified_at)
    VALUES (?, ?, ?)
  `),
};

// ─── Public API ───────────────────────────────────────────────────────────────

function createSubscription({ id, email, north, south, east, west }) {
  stmts.insertSub.run({ id, email, north, south, east, west, created_at: new Date().toISOString() });
  return stmts.getSub.get(id);
}

function getSubscription(id) {
  return stmts.getSub.get(id) || null;
}

function deleteSubscription(id) {
  return stmts.deleteSub.run(id).changes > 0;
}

function getAllSubscriptions() {
  return stmts.getAllSubs.all();
}

function countByEmail(email) {
  return stmts.countByEmail.get(email).count;
}

function isAlreadyNotified(subscriptionId, caseFingerprint) {
  return !!stmts.isNotified.get(subscriptionId, caseFingerprint);
}

function markNotified(subscriptionId, caseFingerprint) {
  stmts.insertNotified.run(subscriptionId, caseFingerprint, new Date().toISOString());
}

module.exports = {
  createSubscription,
  getSubscription,
  deleteSubscription,
  getAllSubscriptions,
  countByEmail,
  isAlreadyNotified,
  markNotified,
};
