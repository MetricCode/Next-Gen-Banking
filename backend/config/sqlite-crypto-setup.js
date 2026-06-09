// backend/config/sqlite-crypto-setup.js
const { db } = require('./db');

async function setupCryptoTables() {
    console.log('🔧 Setting up crypto deposit tables...');
    
    // Create crypto_deposits table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS crypto_deposits (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            order_id TEXT UNIQUE,
            payment_id TEXT UNIQUE,
            fiat_amount REAL NOT NULL,
            crypto_currency TEXT NOT NULL,
            crypto_amount REAL,
            wallet_address TEXT,
            status TEXT DEFAULT 'pending',
            actually_paid REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Create indexes
    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_crypto_deposits_user_id ON crypto_deposits(user_id);
        CREATE INDEX IF NOT EXISTS idx_crypto_deposits_status ON crypto_deposits(status);
        CREATE INDEX IF NOT EXISTS idx_crypto_deposits_payment_id ON crypto_deposits(payment_id);
    `);
    
    console.log('✅ Crypto deposit tables created');
}

module.exports = { setupCryptoTables };