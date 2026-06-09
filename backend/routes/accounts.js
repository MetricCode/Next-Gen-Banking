// backend/routes/accounts.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const AccountService = require('../services/accountService');
const { requireKYCVerification } = require('../middleware/kycVerification');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==================== PUBLIC ENDPOINTS (No KYC required) ====================

// Get all account types - NO KYC REQUIRED (view only)
router.get('/account-types', authenticateToken, async (req, res) => {
    try {
        const accountTypes = await db.all(
            'SELECT code, name, description, min_balance, interest_rate FROM account_types ORDER BY code'
        );
        
        console.log('✅ Account types fetched:', accountTypes.length);
        res.json({ success: true, types: accountTypes });
    } catch (error) {
        console.error('❌ Error fetching account types:', error);
        res.status(500).json({ error: 'Failed to fetch account types' });
    }
});

// Get all accounts for the authenticated user - NO KYC REQUIRED (view only)
router.get('/accounts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const accounts = await AccountService.getUserAccounts(userId);
        
        console.log('✅ Accounts fetched for user:', userId, 'count:', accounts.length);
        res.json({ success: true, accounts });
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Get account balance - NO KYC REQUIRED (view only)
router.get('/balance/:accountId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { accountId } = req.params;
        
        const account = await db.get(
            'SELECT balance FROM accounts WHERE id = ? AND user_id = ?',
            [accountId, userId]
        );
        
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        
        res.json({ success: true, balance: account.balance });
    } catch (error) {
        console.error('❌ Error getting balance:', error);
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

// Get transfer history - NO KYC REQUIRED (view only)
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 50, offset = 0 } = req.query;
        
        const transfers = await AccountService.getTransferHistory(userId, parseInt(limit), parseInt(offset));
        
        console.log('✅ Transfer history fetched:', transfers.length);
        res.json({ success: true, transfers });
    } catch (error) {
        console.error('❌ Error fetching transfer history:', error);
        res.status(500).json({ error: 'Failed to fetch transfer history' });
    }
});

// ==================== PROTECTED ENDPOINTS (KYC REQUIRED) ====================

// Create a new account - ✅ REQUIRES KYC
router.post('/accounts', authenticateToken, requireKYCVerification, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { accountType, setAsDefault = false } = req.body;
        
        if (!accountType) {
            return res.status(400).json({ error: 'Account type is required' });
        }
        
        // Check if user already has this account type
        const existing = await db.get(
            'SELECT id FROM accounts WHERE user_id = ? AND account_type_code = ?',
            [userId, accountType.toUpperCase()]
        );
        
        if (existing) {
            return res.status(400).json({ error: `You already have a ${accountType} account` });
        }
        
        const account = await AccountService.createAccount(userId, accountType.toUpperCase(), setAsDefault);
        
        console.log('✅ Account created:', account.account_number);
        res.json({ success: true, account });
    } catch (error) {
        console.error('❌ Error creating account:', error);
        res.status(500).json({ error: error.message || 'Failed to create account' });
    }
});

// Set default account - ✅ REQUIRES KYC
router.put('/accounts/:accountId/default', authenticateToken, requireKYCVerification, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { accountId } = req.params;
        
        await AccountService.setDefaultAccount(userId, accountId);
        
        console.log('✅ Default account set:', accountId);
        res.json({ success: true, message: 'Default account updated' });
    } catch (error) {
        console.error('❌ Error setting default account:', error);
        res.status(500).json({ error: 'Failed to set default account' });
    }
});

// Internal transfer - ✅ REQUIRES KYC
router.post('/internal-transfer', authenticateToken, requireKYCVerification, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fromAccountId, toAccountNumber, amount, description } = req.body;
        
        // Verify the from account belongs to the user
        const fromAccount = await db.get(
            'SELECT id FROM accounts WHERE id = ? AND user_id = ?',
            [fromAccountId, userId]
        );
        
        if (!fromAccount) {
            return res.status(404).json({ error: 'Source account not found' });
        }
        
        const result = await AccountService.internalTransfer(
            fromAccountId,
            toAccountNumber,
            parseFloat(amount),
            description
        );
        
        console.log('✅ Internal transfer completed:', result.reference);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ Error processing transfer:', error);
        res.status(500).json({ error: error.message || 'Transfer failed' });
    }
});

module.exports = router;