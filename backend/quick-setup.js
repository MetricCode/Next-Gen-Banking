// quick-setup.js - Fast Database Setup
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'nextgen_bank.db');

console.log('🚀 Quick Database Setup\n');

// Delete old database if exists
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Deleted old database');
}

const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
    
    console.log('✅ Database created');
    
    // Hash password
    const hash = await bcrypt.hash('Test@123', 10);
    
    // Create everything in one go
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');
        
        // Create tables
        db.run(`CREATE TABLE users (
            id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone_number TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            id_number TEXT UNIQUE NOT NULL,
            is_verified INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            failed_login_attempts INTEGER DEFAULT 0,
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE TABLE accounts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            account_number TEXT UNIQUE NOT NULL,
            account_type TEXT DEFAULT 'savings',
            balance REAL DEFAULT 0.00,
            currency TEXT DEFAULT 'KES',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        db.run(`CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            from_account_id TEXT,
            to_account_id TEXT,
            amount REAL NOT NULL,
            fee REAL DEFAULT 0.00,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            reference TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_account_id) REFERENCES accounts(id),
            FOREIGN KEY (to_account_id) REFERENCES accounts(id)
        )`);
        
        db.run(`CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            device_info TEXT,
            ip_address TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        console.log('✅ Tables created');
        
        // Insert test users
        const userId1 = 'user_' + Date.now();
        const userId2 = 'user_' + (Date.now() + 1);
        
        db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, NULL, datetime('now'), datetime('now'))`,
            [userId1, 'John Doe', 'john.doe@example.com', '0712345678', hash, '12345678']);
        
        db.run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, NULL, datetime('now'), datetime('now'))`,
            [userId2, 'Jane Smith', 'jane.smith@example.com', '0723456789', hash, '87654321']);
        
        console.log('✅ Users created');
        
        // Insert accounts
        db.run(`INSERT INTO accounts VALUES (?, ?, ?, 'savings', 25000.00, 'KES', 'active', datetime('now'))`,
            ['acc_' + Date.now(), userId1, '1000000001']);
        
        db.run(`INSERT INTO accounts VALUES (?, ?, ?, 'current', 15000.00, 'KES', 'active', datetime('now'))`,
            ['acc_' + (Date.now() + 1), userId2, '1000000002'], () => {
                
                console.log('✅ Accounts created\n');
                console.log('='.repeat(50));
                console.log('✅ SETUP COMPLETE!\n');
                console.log('Test Login:');
                console.log('  📧 john.doe@example.com');
                console.log('  🔑 Test@123\n');
                console.log('Start server: npm start');
                console.log('='.repeat(50));
                
                db.close();
            }
        );
    });
});