const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, '../nextgen_bank.db');

// Create/connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database at:', dbPath);
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create all tables
const createTables = `
-- Enable WAL mode for better concurrency
PRAGMA journal_mode = WAL;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    id_number TEXT UNIQUE NOT NULL,
    biometric_key TEXT,
    device_id TEXT,
    is_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    failed_login_attempts INTEGER DEFAULT 0,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    account_type TEXT DEFAULT 'savings',
    balance REAL DEFAULT 0.00,
    currency TEXT DEFAULT 'KES',
    status TEXT DEFAULT 'active',
    interest_rate REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (account_type IN ('savings', 'current', 'fixed')),
    CHECK (balance >= 0),
    CHECK (status IN ('active', 'frozen', 'closed'))
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    from_account_id TEXT,
    to_account_id TEXT,
    amount REAL NOT NULL,
    fee REAL DEFAULT 0.00,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reference TEXT UNIQUE NOT NULL,
    description TEXT,
    mpesa_code TEXT,
    fraud_score REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(id),
    CHECK (amount > 0),
    CHECK (fee >= 0),
    CHECK (status IN ('pending', 'completed', 'failed', 'reversed'))
);

-- 4. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. BENEFICIARIES TABLE
CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT NOT NULL,
    beneficiary_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT,
    phone_number TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. SUPPORT_TICKETS TABLE
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT,
    conversation_id TEXT,
    issue_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    assigned_to TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- 7. CHATBOT_CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT,
    session_id TEXT,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    intent TEXT,
    confidence REAL,
    required_escalation INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 8. SECURITY_LOGS TABLE
CREATE TABLE IF NOT EXISTS security_logs (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    user_id TEXT,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    device_info TEXT,
    details TEXT,
    is_suspicious INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from_account ON transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);

-- Insert test user (password: Test@123) - CORRECTED HASH
INSERT OR IGNORE INTO users (id, full_name, email, phone_number, password_hash, id_number, is_verified)
VALUES (
    hex(randomblob(16)),
    'John Doe',
    'john.doe@example.com',
    '0712345678',
    '$2b$10$G64EPyl854DJs.C4GHzyPOVaZY8a0RemPB8WyvSGSec6.qx7beCPq',
    '12345678',
    1
);

-- Insert test account for John Doe
INSERT OR IGNORE INTO accounts (user_id, account_number, account_type, balance)
SELECT 
    id,
    '1000000001',
    'savings',
    25000.00
FROM users 
WHERE email = 'john.doe@example.com'
AND NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1000000001');

-- Insert another test user (password: Test@123) - CORRECTED HASH
INSERT OR IGNORE INTO users (id, full_name, email, phone_number, password_hash, id_number, is_verified)
VALUES (
    hex(randomblob(16)),
    'Jane Smith',
    'jane.smith@example.com',
    '0723456789',
    '$2b$10$G64EPyl854DJs.C4GHzyPOVaZY8a0RemPB8WyvSGSec6.qx7beCPq',
    '87654321',
    1
);

-- Insert test account for Jane
INSERT OR IGNORE INTO accounts (user_id, account_number, account_type, balance)
SELECT 
    id,
    '1000000002',
    'current',
    15000.00
FROM users 
WHERE email = 'jane.smith@example.com'
AND NOT EXISTS (SELECT 1 FROM accounts WHERE account_number = '1000000002');
`;

// Execute table creation
db.exec(createTables, (err) => {
    if (err) {
        console.error('❌ Error creating tables:', err.message);
    } else {
        console.log('✅ Tables created successfully');
        
        // Verify setup
        db.get("SELECT COUNT(*) as user_count FROM users", (err, row) => {
            if (err) {
                console.error('Error counting users:', err.message);
            } else {
                console.log(`✅ Database ready! ${row.user_count} users in database`);
                console.log('\nTest credentials:');
                console.log('  Email: john.doe@example.com');
                console.log('  Email: jane.smith@example.com');
                console.log('  Password: Test@123');
            }
        });
    }
});

module.exports = db;