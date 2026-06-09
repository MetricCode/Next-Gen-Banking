// backend/routes/mpesa.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, generateId } = require('../config/db');
const AccountService = require('../services/accountService');

// Use service factory
const mpesaService = require('../services/mpesa');

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

// Helper function to get or create savings account
async function getOrCreateSavingsAccount(userId) {
    // Try to get existing savings account
    let account = await db.get(
        'SELECT id, account_number, balance FROM accounts WHERE user_id = ? AND account_type_code = ? LIMIT 1',
        [userId, 'SAVINGS']
    );

    // If no savings account exists, create one
    if (!account) {
        console.log('📝 No savings account found, creating one...');
        
        try {
            const newAccount = await AccountService.createAccount(userId, 'SAVINGS', false);
            console.log('✅ Savings account created:', newAccount.account_number);
            
            // Fetch the newly created account with all details
            account = await db.get(
                'SELECT id, account_number, balance FROM accounts WHERE id = ?',
                [newAccount.id]
            );
        } catch (error) {
            // Check if error is due to existing account (race condition)
            if (error.message.includes('already have')) {
                account = await db.get(
                    'SELECT id, account_number, balance FROM accounts WHERE user_id = ? AND account_type_code = ? LIMIT 1',
                    [userId, 'SAVINGS']
                );
            } else {
                throw error;
            }
        }
    }

    return account;
}

// ==================== DEPOSIT ROUTES ====================

// Deposit - STK Push
router.post('/deposit', authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        const userId = req.user.userId;

        console.log('📱 Deposit Request:', { userId, phoneNumber, amount });

        // Validation
        if (!phoneNumber || !amount) {
            return res.status(400).json({ error: 'Phone number and amount are required' });
        }

        const depositAmount = parseFloat(amount);
        if (isNaN(depositAmount) || depositAmount < 1) {
            return res.status(400).json({ error: 'Amount must be at least KES 1' });
        }

        if (depositAmount > 150000) {
            return res.status(400).json({ error: 'Maximum amount is KES 150,000' });
        }

        // Get or create savings account
        const account = await getOrCreateSavingsAccount(userId);

        if (!account) {
            return res.status(500).json({ error: 'Failed to get or create savings account' });
        }

        console.log('💰 Depositing to savings account:', account.account_number);

        // Initiate STK Push (real or mock based on config)
        const result = await mpesaService.stkPush(
            phoneNumber,
            depositAmount,
            account.account_number,
            userId
        );

        res.json({
            success: true,
            message: result.message,
            checkoutRequestID: result.checkoutRequestID,
            requiresPin: result.requiresPin || false,
            isMock: result.isMock || false,
            isReal: result.isReal || false
        });

    } catch (error) {
        console.error('❌ Deposit Error:', error);
        res.status(500).json({
            error: error.message || 'Deposit failed'
        });
    }
});

// Verify PIN for deposit (only needed for mock mode)
router.post('/verify-deposit-pin', authenticateToken, async (req, res) => {
    try {
        const { checkoutRequestID, pin, amount } = req.body;
        const userId = req.user.userId;

        console.log('🔐 PIN Verification for deposit:', { 
            checkoutRequestID, 
            userId, 
            pinLength: pin?.length,
            amount 
        });

        // Validate inputs
        if (!checkoutRequestID) {
            console.log('❌ Missing checkoutRequestID');
            return res.status(400).json({ error: 'Checkout request ID is required' });
        }

        if (!pin) {
            console.log('❌ Missing PIN');
            return res.status(400).json({ error: 'PIN is required' });
        }

        if (pin.length !== 4) {
            console.log('❌ Invalid PIN length:', pin.length);
            return res.status(400).json({ error: 'PIN must be 4 digits' });
        }

        // Only mock service has verifyDepositPin
        if (typeof mpesaService.verifyDepositPin !== 'function') {
            return res.status(400).json({ 
                success: false, 
                message: 'PIN verification is not required for real M-Pesa. Please check your phone and enter your M-Pesa PIN.' 
            });
        }

        // Call the service
        const result = await mpesaService.verifyDepositPin(
            checkoutRequestID,
            pin,
            amount,
            userId
        );

        console.log('📤 PIN verification result:', result);

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                receiptNumber: result.receiptNumber,
                newBalance: result.newBalance
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('❌ PIN Verification Error Details:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'PIN verification failed',
            details: error.message 
        });
    }
});

// ==================== WITHDRAWAL ROUTES ====================

// Withdraw - B2C
router.post('/withdraw', authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, amount } = req.body;
        const userId = req.user.userId;

        console.log('💸 Withdrawal Request:', { userId, phoneNumber, amount });

        // Validation
        if (!phoneNumber || !amount) {
            return res.status(400).json({ error: 'Phone number and amount are required' });
        }

        const withdrawAmount = parseFloat(amount);
        if (isNaN(withdrawAmount) || withdrawAmount < 10) {
            return res.status(400).json({ error: 'Amount must be at least KES 10' });
        }

        if (withdrawAmount > 150000) {
            return res.status(400).json({ error: 'Maximum amount is KES 150,000' });
        }

        // Get savings account and check balance
        const account = await db.get(
            'SELECT id, account_number, balance FROM accounts WHERE user_id = ? AND account_type_code = ? LIMIT 1',
            [userId, 'SAVINGS']
        );

        if (!account) {
            return res.status(404).json({ 
                error: 'Savings account not found. Please deposit money first to create an account.' 
            });
        }

        if (account.balance < withdrawAmount) {
            return res.status(400).json({ 
                error: `Insufficient funds. Available balance: KES ${account.balance.toFixed(2)}` 
            });
        }

        // Debit account first
        await db.run(
            'UPDATE accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [withdrawAmount, account.id]
        );

        // Initiate B2C withdrawal
        const result = await mpesaService.b2cWithdrawal(
            phoneNumber,
            withdrawAmount,
            userId,
            account.account_number
        );

        res.json({
            success: true,
            message: result.message,
            conversationID: result.conversationID,
            requiresPin: result.requiresPin || false,
            isMock: result.isMock || false
        });

    } catch (error) {
        console.error('❌ Withdrawal Error:', error);
        
        // Try to refund if withdrawal failed after debit
        if (account) {
            try {
                await db.run(
                    'UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [withdrawAmount, account.id]
                );
                console.log('💰 Refunded amount due to error');
            } catch (refundError) {
                console.error('❌ Refund failed:', refundError);
            }
        }
        
        res.status(500).json({
            error: error.message || 'Withdrawal failed'
        });
    }
});

// Verify PIN for withdrawal (only needed for mock mode)
router.post('/verify-withdrawal-pin', authenticateToken, async (req, res) => {
    try {
        const { checkoutRequestID, pin, amount } = req.body;
        const userId = req.user.userId;

        console.log('🔐 PIN Verification for withdrawal:', { checkoutRequestID, userId, pinLength: pin?.length });

        if (!checkoutRequestID) {
            return res.status(400).json({ error: 'Checkout request ID is required' });
        }

        if (!pin) {
            return res.status(400).json({ error: 'PIN is required' });
        }

        if (pin.length !== 4) {
            return res.status(400).json({ error: 'PIN must be 4 digits' });
        }

        // Only mock service has verifyWithdrawalPin
        if (typeof mpesaService.verifyWithdrawalPin !== 'function') {
            return res.status(400).json({ 
                success: false, 
                message: 'PIN verification is not required for real M-Pesa. Please check your phone and approve the withdrawal.' 
            });
        }

        const result = await mpesaService.verifyWithdrawalPin(
            checkoutRequestID,
            pin,
            amount,
            userId
        );

        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                conversationID: result.conversationID,
                transactionID: result.transactionID
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('❌ PIN Verification Error:', error);
        res.status(500).json({ 
            error: 'PIN verification failed',
            details: error.message 
        });
    }
});

// ==================== STATUS & HISTORY ROUTES ====================

// Check transaction status
router.get('/status/:checkoutRequestID', authenticateToken, async (req, res) => {
    try {
        const { checkoutRequestID } = req.params;

        console.log('🔍 Checking status for:', checkoutRequestID);

        const result = await mpesaService.queryStatus(checkoutRequestID);

        res.json({
            success: true,
            status: result.status,
            message: result.message
        });

    } catch (error) {
        console.error('❌ Status Check Error:', error);
        res.status(500).json({
            error: error.message || 'Status check failed'
        });
    }
});

// Get M-Pesa transaction history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 20, offset = 0 } = req.query;

        console.log('📜 Fetching M-Pesa history for user:', userId);

        const transactions = await db.all(
            `SELECT * FROM mpesa_transactions 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), parseInt(offset)]
        );

        res.json({
            success: true,
            transactions
        });

    } catch (error) {
        console.error('❌ History Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to fetch history'
        });
    }
});

module.exports = router;