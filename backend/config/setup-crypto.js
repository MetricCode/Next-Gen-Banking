// backend/create-table.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the same database path as your app
const dbPath = path.join(__dirname, 'nextgen_bank.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

const createTableSQL = `
    CREATE TABLE IF NOT EXISTS crypto_deposits (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_id TEXT UNIQUE,
        payment_id TEXT UNIQUE,
        fiat_amount REAL NOT NULL,
        crypto_currency TEXT NOT NULL,
        crypto_amount REAL,
        wallet_address TEXT,
        network TEXT,
        status TEXT DEFAULT 'pending',
        actually_paid REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`;

db.run(createTableSQL, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('✅ crypto_deposits table created successfully!');
        
        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_crypto_deposits_user_id ON crypto_deposits(user_id)`, (err) => {
            if (err) console.error('Error creating index:', err.message);
            else console.log('✅ Index created: user_id');
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_crypto_deposits_status ON crypto_deposits(status)`, (err) => {
            if (err) console.error('Error creating index:', err.message);
            else console.log('✅ Index created: status');
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_crypto_deposits_payment_id ON crypto_deposits(payment_id)`, (err) => {
            if (err) console.error('Error creating index:', err.message);
            else console.log('✅ Index created: payment_id');
        });
        
        console.log('\n✨ Table and indexes created!');
        console.log('Restart your backend server now.');
    }
    
    db.close();
});