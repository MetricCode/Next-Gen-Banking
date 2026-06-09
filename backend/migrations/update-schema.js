// backend/migrations/safe-update-schema.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../nextgen_bank.db');
const backupPath = dbPath.replace('.db', `_backup_${Date.now()}.db`);

console.log('🔄 Starting SAFE database migration...');
console.log('📂 Database path:', dbPath);

// Create backup
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log('✅ Backup created:', backupPath);
} catch (error) {
    console.error('❌ Backup failed:', error.message);
    console.log('Continuing anyway...');
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Could not open database:', err);
        process.exit(1);
    }
    console.log('✅ Database connected');
});

// Helper function to run SQL with promise
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function migrate() {
    try {
        console.log('\n📋 Step 1: Creating account_types table...');
        await runSQL(`
            CREATE TABLE IF NOT EXISTS account_types (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                interest_rate REAL DEFAULT 0.0,
                min_balance REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ account_types table ready');

        console.log('\n📋 Step 2: Inserting account types...');
        const accountTypes = [
            ['SAVINGS', 'Savings Account', 'Standard savings account with interest', 2.5, 1000],
            ['CHECKING', 'Checking Account', 'Current account for daily transactions', 0.0, 0],
            ['CRYPTO', 'Crypto Account', 'Digital currency account', 0.0, 0]
        ];

        for (const [code, name, desc, rate, minBal] of accountTypes) {
            await runSQL(
                'INSERT OR IGNORE INTO account_types (code, name, description, interest_rate, min_balance) VALUES (?, ?, ?, ?, ?)',
                [code, name, desc, rate, minBal]
            );
        }
        console.log('✅ Account types inserted');

        console.log('\n📋 Step 3: Checking current accounts table...');
        const columns = await allSQL("PRAGMA table_info(accounts)");
        console.log('Current columns:', columns.map(c => c.name).join(', '));
        
        const hasAccountTypeCode = columns.some(col => col.name === 'account_type_code');
        
        if (hasAccountTypeCode) {
            console.log('✅ accounts table already has account_type_code - skipping migration');
            
            // Just add the unique constraint if it doesn't exist
            console.log('\n📋 Step 4: Adding unique constraint (if needed)...');
            try {
                await runSQL('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_account_type ON accounts(user_id, account_type_code)');
                console.log('✅ Unique constraint added');
            } catch (error) {
                console.log('⚠️ Constraint may already exist:', error.message);
            }
        } else {
            console.log('⚠️ Need to migrate accounts table structure');
            
            console.log('\n📋 Step 4: Getting existing accounts...');
            const existingAccounts = await allSQL('SELECT * FROM accounts');
            console.log(`Found ${existingAccounts.length} existing accounts`);

            console.log('\n📋 Step 5: Creating new accounts table...');
            await runSQL('DROP TABLE IF EXISTS accounts_new');
            await runSQL(`
                CREATE TABLE accounts_new (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    account_number TEXT UNIQUE NOT NULL,
                    account_type_code TEXT DEFAULT 'SAVINGS',
                    balance REAL DEFAULT 0.00,
                    currency TEXT DEFAULT 'KES',
                    status TEXT DEFAULT 'active',
                    is_default INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (account_type_code) REFERENCES account_types(code),
                    CHECK (balance >= 0),
                    CHECK (status IN ('active', 'frozen', 'closed'))
                )
            `);
            console.log('✅ accounts_new table created');

            console.log('\n📋 Step 6: Migrating account data...');
            let migratedCount = 0;
            
            for (const account of existingAccounts) {
                // Determine account type
                let accountTypeCode = 'SAVINGS';
                
                if (account.account_type) {
                    const type = account.account_type.toUpperCase();
                    if (type.includes('CHECK') || type.includes('CURRENT')) {
                        accountTypeCode = 'CHECKING';
                    } else if (type.includes('CRYPTO')) {
                        accountTypeCode = 'CRYPTO';
                    }
                } else if (account.account_type_code) {
                    accountTypeCode = account.account_type_code;
                }

                await runSQL(
                    `INSERT INTO accounts_new (id, user_id, account_number, account_type_code, balance, currency, status, is_default, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        account.id,
                        account.user_id,
                        account.account_number,
                        accountTypeCode,
                        account.balance || 0,
                        account.currency || 'KES',
                        account.status || 'active',
                        account.is_default || 0,
                        account.created_at || new Date().toISOString(),
                        account.updated_at || new Date().toISOString()
                    ]
                );
                migratedCount++;
            }
            console.log(`✅ Migrated ${migratedCount} accounts`);

            console.log('\n📋 Step 7: Replacing old accounts table...');
            await runSQL('DROP TABLE accounts');
            await runSQL('ALTER TABLE accounts_new RENAME TO accounts');
            console.log('✅ accounts table replaced');

            console.log('\n📋 Step 8: Adding unique constraint...');
            await runSQL('CREATE UNIQUE INDEX idx_user_account_type ON accounts(user_id, account_type_code)');
            console.log('✅ Unique constraint added');
        }

        console.log('\n📋 Step 9: Creating/updating other tables...');
        
        // Beneficiaries
        await runSQL(`
            CREATE TABLE IF NOT EXISTS beneficiaries (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                beneficiary_account_number TEXT NOT NULL,
                beneficiary_name TEXT NOT NULL,
                nickname TEXT,
                is_favorite INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, beneficiary_account_number)
            )
        `);
        console.log('✅ beneficiaries table ready');

        // Internal transfers
        await runSQL(`
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
                FOREIGN KEY (to_account_id) REFERENCES accounts(id),
                CHECK (amount > 0)
            )
        `);
        console.log('✅ internal_transfers table ready');

        console.log('\n📋 Step 10: Creating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_accounts_account_number ON accounts(account_number)',
            'CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type_code)',
            'CREATE INDEX IF NOT EXISTS idx_users_id_number ON users(id_number)',
            'CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON beneficiaries(user_id)'
        ];

        for (const indexSQL of indexes) {
            try {
                await runSQL(indexSQL);
            } catch (error) {
                console.log('⚠️ Index may already exist:', error.message);
            }
        }
        console.log('✅ Indexes created');

        console.log('\n📋 Step 11: Verifying migration...');
        const accountCount = await getSQL('SELECT COUNT(*) as count FROM accounts');
        const userCount = await getSQL('SELECT COUNT(*) as count FROM users');
        
        console.log(`✅ Verification complete:`);
        console.log(`   - ${accountCount.count} accounts in database`);
        console.log(`   - ${userCount.count} users in database`);

        console.log('\n✅✅✅ Migration completed successfully! ✅✅✅');
        console.log('\n💾 Backup saved at:', backupPath);
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.log('\n🔄 You can restore from backup:', backupPath);
        throw error;
    } finally {
        db.close();
    }
}

// Run migration
migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});