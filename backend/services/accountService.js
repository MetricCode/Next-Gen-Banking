const { db, generateId } = require('../config/db');

class AccountService {
    // Create a new account for a user
    async createAccount(userId, accountTypeCode, isDefault = false) {
        try {
            // Validate account type exists
            const accountType = await db.get(
                'SELECT * FROM account_types WHERE code = ?',
                [accountTypeCode.toUpperCase()]
            );
            
            if (!accountType) {
                throw new Error(`Invalid account type: ${accountTypeCode}`);
            }
            
            // Check if user already has this account type
            const existingAccount = await db.get(
                'SELECT id FROM accounts WHERE user_id = ? AND account_type_code = ?',
                [userId, accountTypeCode.toUpperCase()]
            );
            
            if (existingAccount) {
                throw new Error(`You already have a ${accountType.name}`);
            }
            
            // Generate unique account number
            const accountNumber = this.generateAccountNumber(accountTypeCode);
            const accountId = generateId();
            
            // If this is default, unset other defaults
            if (isDefault) {
                await db.run(
                    'UPDATE accounts SET is_default = 0 WHERE user_id = ?',
                    [userId]
                );
            }
            
            // Create account
            const result = await db.run(
                `INSERT INTO accounts (
                    id, user_id, account_number, account_type_code, 
                    balance, is_default, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [accountId, userId, accountNumber, accountTypeCode.toUpperCase(), 0, isDefault ? 1 : 0]
            );
            
            // Get the created account
            const account = await db.get(
                `SELECT a.*, at.name as account_type_name, at.description, at.interest_rate 
                 FROM accounts a 
                 JOIN account_types at ON a.account_type_code = at.code 
                 WHERE a.id = ?`,
                [accountId]
            );
            
            return account;
        } catch (error) {
            console.error('Error creating account:', error);
            throw error;
        }
    }
    
    // Generate account number based on type
    generateAccountNumber(accountType) {
        const prefixes = {
            'SAVINGS': '10',
            'CHECKING': '20',
            'CRYPTO': '30'
        };
        
        const prefix = prefixes[accountType.toUpperCase()] || '40';
        const random = Math.floor(100000000 + Math.random() * 900000000);
        return prefix + random.toString();
    }
    
    // Get all accounts for a user
    async getUserAccounts(userId) {
        try {
            const accounts = await db.all(
                `SELECT a.*, at.name as account_type_name, at.description, at.interest_rate,
                        at.min_balance
                 FROM accounts a 
                 JOIN account_types at ON a.account_type_code = at.code 
                 WHERE a.user_id = ? 
                 ORDER BY a.is_default DESC, a.created_at ASC`,
                [userId]
            );
            
            return accounts;
        } catch (error) {
            console.error('Error getting user accounts:', error);
            throw error;
        }
    }
    
    // Get account by ID
    async getAccountById(accountId) {
        try {
            const account = await db.get(
                `SELECT a.*, at.name as account_type_name, at.description 
                 FROM accounts a 
                 JOIN account_types at ON a.account_type_code = at.code 
                 WHERE a.id = ?`,
                [accountId]
            );
            return account;
        } catch (error) {
            console.error('Error getting account:', error);
            throw error;
        }
    }
    
    // Get account by account number
    async getAccountByNumber(accountNumber) {
        try {
            const account = await db.get(
                `SELECT a.*, u.full_name as user_name, u.email as user_email,
                        at.name as account_type_name
                 FROM accounts a 
                 JOIN users u ON a.user_id = u.id
                 JOIN account_types at ON a.account_type_code = at.code 
                 WHERE a.account_number = ?`,
                [accountNumber]
            );
            return account;
        } catch (error) {
            console.error('Error getting account by number:', error);
            throw error;
        }
    }
    
    // Set default account
    async setDefaultAccount(userId, accountId) {
        try {
            await db.run('BEGIN TRANSACTION');
            
            // Unset all defaults for this user
            await db.run(
                'UPDATE accounts SET is_default = 0 WHERE user_id = ?',
                [userId]
            );
            
            // Set new default
            await db.run(
                'UPDATE accounts SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                [accountId, userId]
            );
            
            await db.run('COMMIT');
            return { success: true };
        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Error setting default account:', error);
            throw error;
        }
    }
    
    // Internal transfer between accounts
    async internalTransfer(fromAccountId, toAccountNumber, amount, description = '') {
        try {
            await db.run('BEGIN TRANSACTION');
            
            // Get source account
            const fromAccount = await this.getAccountById(fromAccountId);
            if (!fromAccount) {
                throw new Error('Source account not found');
            }
            
            // Check sufficient balance
            if (fromAccount.balance < amount) {
                throw new Error('Insufficient funds');
            }
            
            // Get destination account
            const toAccount = await this.getAccountByNumber(toAccountNumber);
            if (!toAccount) {
                throw new Error('Destination account not found');
            }
            
            // Prevent self-transfer
            if (fromAccount.account_number === toAccountNumber) {
                throw new Error('Cannot transfer to the same account');
            }
            
            // Deduct from source
            await db.run(
                'UPDATE accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [amount, fromAccountId]
            );
            
            // Add to destination
            await db.run(
                'UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [amount, toAccount.id]
            );
            
            // Generate UNIQUE reference numbers for each record
            const crypto = require('crypto');
            const transferReference = 'TRF' + Date.now() + crypto.randomBytes(8).toString('hex');
            const debitReference = 'TXN' + Date.now() + crypto.randomBytes(8).toString('hex') + '_DB';
            const creditReference = 'TXN' + Date.now() + crypto.randomBytes(8).toString('hex') + '_CR';
            
            const transferId = generateId();
            
            // Record transfer
            await db.run(
                `INSERT INTO internal_transfers (
                    id, from_account_id, to_account_id, amount, 
                    reference, description, status, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [transferId, fromAccountId, toAccount.id, amount, transferReference, description]
            );
            
            // Debit transaction (from account)
            await db.run(
                `INSERT INTO transactions (
                    id, from_account_id, amount, type, status, reference, 
                    description, created_at
                ) VALUES (?, ?, ?, 'sent', 'completed', ?, ?, CURRENT_TIMESTAMP)`,
                [generateId(), fromAccountId, amount, debitReference, description || 'Internal transfer']
            );
            
            // Credit transaction (to account)
            await db.run(
                `INSERT INTO transactions (
                    id, to_account_id, amount, type, status, reference, 
                    description, created_at
                ) VALUES (?, ?, ?, 'received', 'completed', ?, ?, CURRENT_TIMESTAMP)`,
                [generateId(), toAccount.id, amount, creditReference, description || 'Internal transfer']
            );
            
            await db.run('COMMIT');
            
            return {
                success: true,
                reference: transferReference,
                amount,
                fromAccount: fromAccount.account_number,
                toAccount: toAccount.account_number,
                newBalance: fromAccount.balance - amount
            };
        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Transfer error:', error);
            throw error;
        }
    }
    
    // Get transfer history
    async getTransferHistory(userId, limit = 50, offset = 0) {
        try {
            const transfers = await db.all(
                `SELECT 
                    it.*,
                    fa.account_number as from_account_number,
                    fa.account_type_code as from_account_type,
                    ta.account_number as to_account_number,
                    ta.account_type_code as to_account_type,
                    u.full_name as recipient_name
                 FROM internal_transfers it
                 JOIN accounts fa ON it.from_account_id = fa.id
                 JOIN accounts ta ON it.to_account_id = ta.id
                 JOIN users u ON ta.user_id = u.id
                 WHERE fa.user_id = ? OR ta.user_id = ?
                 ORDER BY it.created_at DESC
                 LIMIT ? OFFSET ?`,
                [userId, userId, limit, offset]
            );
            
            return transfers;
        } catch (error) {
            console.error('Error getting transfer history:', error);
            throw error;
        }
    }
    
    // Get account balance
    async getAccountBalance(accountId) {
        try {
            const account = await db.get(
                'SELECT balance FROM accounts WHERE id = ?',
                [accountId]
            );
            return account ? account.balance : 0;
        } catch (error) {
            console.error('Error getting balance:', error);
            throw error;
        }
    }
    
    // Get beneficiaries - FIXED: Changed a.account_type_name to at.name
    async getBeneficiaries(userId) {
        try {
            const beneficiaries = await db.all(
                `SELECT 
                    b.id, 
                    b.beneficiary_account_number as accountNumber,
                    b.beneficiary_name as name,
                    b.nickname,
                    b.is_favorite as isFavorite,
                    b.created_at as createdAt,
                    a.account_type_code as accountType,
                    at.name as accountTypeName
                FROM beneficiaries b
                JOIN accounts a ON b.beneficiary_account_number = a.account_number
                JOIN account_types at ON a.account_type_code = at.code
                WHERE b.user_id = ?
                ORDER BY b.is_favorite DESC, b.created_at DESC`,
                [userId]
            );
            return beneficiaries;
        } catch (error) {
            console.error('Error getting beneficiaries:', error);
            throw error;
        }
    }

    // Add beneficiary
    async addBeneficiary(userId, accountNumber, nickname = null) {
        try {
            // Get account details
            const account = await this.getAccountByNumber(accountNumber);
            if (!account) {
                throw new Error('Account not found');
            }
            
            // Don't allow adding self as beneficiary
            const userAccounts = await this.getUserAccounts(userId);
            const isSelfAccount = userAccounts.some(acc => acc.account_number === accountNumber);
            if (isSelfAccount) {
                throw new Error('Cannot add your own account as beneficiary');
            }
            
            // Check if already a beneficiary
            const existing = await db.get(
                'SELECT id FROM beneficiaries WHERE user_id = ? AND beneficiary_account_number = ?',
                [userId, accountNumber]
            );
            
            if (existing) {
                throw new Error('Beneficiary already exists');
            }
            
            const beneficiaryId = generateId();
            await db.run(
                `INSERT INTO beneficiaries (
                    id, user_id, beneficiary_account_number, beneficiary_name, nickname
                ) VALUES (?, ?, ?, ?, ?)`,
                [beneficiaryId, userId, accountNumber, account.user_name, nickname]
            );
            
            return {
                success: true,
                beneficiary: {
                    id: beneficiaryId,
                    accountNumber,
                    name: account.user_name,
                    nickname
                }
            };
        } catch (error) {
            console.error('Error adding beneficiary:', error);
            throw error;
        }
    }
}

module.exports = new AccountService();