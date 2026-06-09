
require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_PATH = path.resolve(__dirname, 'database.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) { console.error('Could not open database:', err.message); process.exit(1); }
});

db.run(`
    CREATE TABLE IF NOT EXISTS crypto_deposits (
        id                TEXT PRIMARY KEY,
        user_id           TEXT NOT NULL,
        order_id          TEXT UNIQUE NOT NULL,
        payment_id        TEXT,
        fiat_amount       REAL NOT NULL,
        crypto_currency   TEXT NOT NULL,
        crypto_amount     REAL,
        wallet_address    TEXT,
        network           TEXT,
        actually_paid     REAL,
        status            TEXT NOT NULL DEFAULT 'pending',
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
    )
`, (err) => {
    if (err) { console.error('Migration failed:', err.message); }
    else { console.log('✅ crypto_deposits table created (or already exists).'); }
    db.close();
});