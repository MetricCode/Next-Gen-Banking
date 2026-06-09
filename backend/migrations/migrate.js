const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../nextgen_bank.db');

async function runMigration() {
    const db = new sqlite3.Database(dbPath);
    
    const migrationSQL = fs.readFileSync(
        path.join(__dirname, 'add_types.sql'),
        'utf8'
    );
    
    // Split SQL statements
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
        if (statement.trim()) {
            await new Promise((resolve, reject) => {
                db.exec(statement, (err) => {
                    if (err) {
                        console.error('Migration error:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }
    
    console.log('✅ Database migration completed successfully');
    db.close();
}

runMigration().catch(console.error);