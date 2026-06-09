-- Add account_type_enum if not exists
CREATE TABLE IF NOT EXISTS account_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    min_balance REAL DEFAULT 0,
    interest_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert account types
INSERT OR IGNORE INTO account_types (name, code, description, min_balance, interest_rate) VALUES
    ('Savings Account', 'SAVINGS', 'Traditional savings account with interest', 0, 2.5),
    ('Checking Account', 'CHECKING', 'Everyday transaction account', 0, 0),
    ('Crypto Wallet', 'CRYPTO', 'Digital currency wallet for crypto transactions', 0, 0);

-- Add columns to accounts table if they don't exist
PRAGMA foreign_keys=off;

-- Create new accounts table with additional fields
CREATE TABLE accounts_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    account_type_code TEXT NOT NULL,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'KES',
    status TEXT DEFAULT 'active',
    is_default BOOLEAN DEFAULT 0,
    crypto_address TEXT,  -- For crypto wallet address
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_type_code) REFERENCES account_types(code)
);

-- Copy existing data
INSERT INTO accounts_new (id, user_id, account_number, account_type_code, balance, currency, status, created_at, updated_at)
SELECT id, user_id, account_number, 'SAVINGS', balance, currency, status, created_at, updated_at
FROM accounts;

-- Drop old table and rename new one
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;

PRAGMA foreign_keys=on;

-- Create indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_account_number ON accounts(account_number);
CREATE INDEX idx_accounts_type ON accounts(account_type_code);

-- Create beneficiaries table
CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    beneficiary_account_number TEXT NOT NULL,
    beneficiary_name TEXT NOT NULL,
    beneficiary_bank TEXT DEFAULT 'NextGen Bank',
    nickname TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, beneficiary_account_number)
);

-- Create internal transfers table
CREATE TABLE IF NOT EXISTS internal_transfers (
    id TEXT PRIMARY KEY,
    from_account_id TEXT NOT NULL,
    to_account_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id),
    FOREIGN KEY (to_account_id) REFERENCES accounts(id)
);

-- Create transaction categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    icon TEXT,
    color TEXT
);

-- Insert default categories
INSERT OR IGNORE INTO transaction_categories (name, icon, color) VALUES
    ('Transfer', '🔄', '#4F46E5'),
    ('Deposit', '💰', '#10B981'),
    ('Withdrawal', '💸', '#EF4444'),
    ('Crypto Purchase', '₿', '#F59E0B'),
    ('Crypto Sale', '📈', '#10B981'),
    ('Bill Payment', '📄', '#6366F1'),
    ('Shopping', '🛍️', '#EC4899');