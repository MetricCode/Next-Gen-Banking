// backend/routes/transfers.js
// UPDATED WITH KYC VERIFICATION

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, generateId } = require('../config/db');
const { requireKYCVerification } = require('../middleware/kycVerification');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// ==================== TRANSFERS ====================

// Get all transfers for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const transfers = await db.all(
            `SELECT t.*, 
                    sender.account_number as sender_account,
                    receiver.account_number as receiver_account,
                    b.beneficiary_name, b.account_number as beneficiary_account
             FROM transfers t
             LEFT JOIN accounts sender ON t.sender_account_id = sender.id
             LEFT JOIN accounts receiver ON t.receiver_account_id = receiver.id
             LEFT JOIN beneficiaries b ON t.beneficiary_id = b.id
             WHERE t.user_id = ?
             ORDER BY t.created_at DESC`,
            [userId]
        );

        res.json({ transfers });
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

// Create a new transfer - ✅ REQUIRES KYC VERIFICATION
router.post('/', authenticateToken, requireKYCVerification, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            fromAccountId, 
            toAccountNumber, 
            amount, 
            description,
            beneficiaryId 
        } = req.body;

        // Validation
        if (!fromAccountId || !toAccountNumber || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than zero' });
        }

        // Get sender account
        const senderAccount = await db.get(
            'SELECT * FROM accounts WHERE id = ? AND user_id = ?',
            [fromAccountId, userId]
        );

        if (!senderAccount) {
            return res.status(404).json({ error: 'Sender account not found' });
        }

        // Check sufficient balance
        if (senderAccount.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        // Get receiver account
        const receiverAccount = await db.get(
            'SELECT * FROM accounts WHERE account_number = ?',
            [toAccountNumber]
        );

        if (!receiverAccount) {
            return res.status(404).json({ error: 'Receiver account not found' });
        }

        // Cannot transfer to same account
        if (senderAccount.id === receiverAccount.id) {
            return res.status(400).json({ error: 'Cannot transfer to the same account' });
        }

        const transferId = generateId();
        const transactionId = `TXN_${Date.now()}`;

        // Start transaction
        await db.run('BEGIN TRANSACTION');

        try {
            // Deduct from sender
            await db.run(
                'UPDATE accounts SET balance = balance - ? WHERE id = ?',
                [amount, senderAccount.id]
            );

            // Add to receiver
            await db.run(
                'UPDATE accounts SET balance = balance + ? WHERE id = ?',
                [amount, receiverAccount.id]
            );

            // Create transfer record
            await db.run(
                `INSERT INTO transfers (
                    id, user_id, sender_account_id, receiver_account_id,
                    beneficiary_id, amount, description, status,
                    transaction_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)`,
                [
                    transferId,
                    userId,
                    senderAccount.id,
                    receiverAccount.id,
                    beneficiaryId || null,
                    amount,
                    description || 'Transfer',
                    transactionId
                ]
            );

            // Commit transaction
            await db.run('COMMIT');

            res.json({
                success: true,
                message: 'Transfer completed successfully',
                transfer: {
                    id: transferId,
                    transactionId,
                    amount,
                    from: senderAccount.account_number,
                    to: toAccountNumber
                }
            });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Transfer failed' });
    }
});

// ==================== BENEFICIARIES ====================

// Get all beneficiaries
router.get('/beneficiaries', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const beneficiaries = await db.all(
            'SELECT * FROM beneficiaries WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        res.json({ beneficiaries });
    } catch (error) {
        console.error('Error fetching beneficiaries:', error);
        res.status(500).json({ error: 'Failed to fetch beneficiaries' });
    }
});

// Add a new beneficiary - ✅ REQUIRES KYC VERIFICATION
router.post('/beneficiaries', authenticateToken, requireKYCVerification, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { beneficiaryName, accountNumber, bankName } = req.body;

        // Validation
        if (!beneficiaryName || !accountNumber) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if beneficiary already exists
        const existing = await db.get(
            'SELECT * FROM beneficiaries WHERE user_id = ? AND account_number = ?',
            [userId, accountNumber]
        );

        if (existing) {
            return res.status(400).json({ error: 'Beneficiary already exists' });
        }

        const beneficiaryId = generateId();

        await db.run(
            `INSERT INTO beneficiaries (
                id, user_id, beneficiary_name, account_number,
                bank_name, created_at
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [beneficiaryId, userId, beneficiaryName, accountNumber, bankName || 'NextGen Bank']
        );

        const newBeneficiary = await db.get(
            'SELECT * FROM beneficiaries WHERE id = ?',
            [beneficiaryId]
        );

        res.json({
            success: true,
            message: 'Beneficiary added successfully',
            beneficiary: newBeneficiary
        });
    } catch (error) {
        console.error('Error adding beneficiary:', error);
        res.status(500).json({ error: 'Failed to add beneficiary' });
    }
});

// Delete a beneficiary
router.delete('/beneficiaries/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const beneficiaryId = req.params.id;

        // Check if beneficiary exists and belongs to user
        const beneficiary = await db.get(
            'SELECT * FROM beneficiaries WHERE id = ? AND user_id = ?',
            [beneficiaryId, userId]
        );

        if (!beneficiary) {
            return res.status(404).json({ error: 'Beneficiary not found' });
        }

        await db.run(
            'DELETE FROM beneficiaries WHERE id = ?',
            [beneficiaryId]
        );

        res.json({
            success: true,
            message: 'Beneficiary deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting beneficiary:', error);
        res.status(500).json({ error: 'Failed to delete beneficiary' });
    }
});

module.exports = router;