// backend/migrations/add-mpesa-table.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../nextgen_bank.db');
const db = new sqlite3.Database(dbPath);

// Create M-Pesa transactions table
const createMPesaTable = `
CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    amount REAL NOT NULL,
    transaction_type TEXT NOT NULL, -- 'deposit' or 'withdrawal'
    
    -- STK Push fields
    checkout_request_id TEXT,
    merchant_request_id TEXT,
    
    -- B2C fields
    conversation_id TEXT,
    originator_conversation_id TEXT,
    
    -- Common fields
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    mpesa_receipt_number TEXT,
    transaction_date TEXT,
    error_message TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (transaction_type IN ('deposit', 'withdrawal')),
    CHECK (status IN ('pending', 'completed', 'failed'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mpesa_user_id ON mpesa_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_checkout_request ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_conversation_id ON mpesa_transactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_status ON mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_created_at ON mpesa_transactions(created_at);
`;

db.exec(createMPesaTable, (err) => {
    if (err) {
        console.error('❌ Error creating M-Pesa table:', err);
    } else {
        console.log('✅ M-Pesa transactions table created successfully');
    }
    db.close();
});