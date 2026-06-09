// backend/routes/transactions.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

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

// Get transaction history for authenticated user
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 50, offset = 0, type = 'all' } = req.query;

        console.log('📜 Fetching transactions for user:', userId);

        // Query to get all transactions where user is either sender or receiver
        let query = `
            SELECT 
                t.*,
                CASE 
                    WHEN t.from_account_id IS NOT NULL AND a_from.user_id = ? THEN 'sent'
                    WHEN t.to_account_id IS NOT NULL AND a_to.user_id = ? THEN 'received'
                    ELSE 'unknown'
                END as transaction_type,
                CASE 
                    WHEN t.from_account_id IS NOT NULL AND a_from.user_id = ? THEN a_to.account_number
                    WHEN t.to_account_id IS NOT NULL AND a_to.user_id = ? THEN a_from.account_number
                    ELSE NULL
                END as counterparty_account,
                CASE 
                    WHEN t.from_account_id IS NOT NULL AND a_from.user_id = ? THEN u_to.full_name
                    WHEN t.to_account_id IS NOT NULL AND a_to.user_id = ? THEN u_from.full_name
                    ELSE NULL
                END as counterparty_name,
                a_from.account_number as from_account_number,
                a_to.account_number as to_account_number,
                at_from.name as from_account_type,
                at_to.name as to_account_type
            FROM transactions t
            LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
            LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
            LEFT JOIN users u_from ON a_from.user_id = u_from.id
            LEFT JOIN users u_to ON a_to.user_id = u_to.id
            LEFT JOIN account_types at_from ON a_from.account_type_code = at_from.code
            LEFT JOIN account_types at_to ON a_to.account_type_code = at_to.code
            WHERE (a_from.user_id = ? OR a_to.user_id = ?)
        `;

        const params = [userId, userId, userId, userId, userId, userId, userId, userId];

        // Add type filter
        if (type !== 'all') {
            if (type === 'sent') {
                query += ` AND a_from.user_id = ?`;
                params.push(userId);
            } else if (type === 'received') {
                query += ` AND a_to.user_id = ?`;
                params.push(userId);
            }
        }

        query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const transactions = await db.all(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total
            FROM transactions t
            LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
            LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
            WHERE (a_from.user_id = ? OR a_to.user_id = ?)
        `;
        
        const countParams = [userId, userId];
        
        if (type !== 'all') {
            if (type === 'sent') {
                countQuery += ` AND a_from.user_id = ?`;
                countParams.push(userId);
            } else if (type === 'received') {
                countQuery += ` AND a_to.user_id = ?`;
                countParams.push(userId);
            }
        }
        
        const totalCount = await db.get(countQuery, countParams);

        // Format transactions for frontend
        const formattedTransactions = transactions.map(t => ({
            id: t.id,
            type: t.transaction_type,
            amount: t.amount,
            counterparty: t.counterparty_name || (t.transaction_type === 'sent' ? 'External Transfer' : 'External Deposit'),
            counterpartyAccount: t.counterparty_account,
            fromAccount: t.from_account_number,
            toAccount: t.to_account_number,
            fromAccountType: t.from_account_type,
            toAccountType: t.to_account_type,
            date: t.created_at,
            status: t.status,
            reference: t.reference,
            description: t.description,
            category: t.category
        }));

        console.log(`✅ Found ${formattedTransactions.length} transactions`);

        res.json({
            success: true,
            transactions: formattedTransactions,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: totalCount?.total || 0,
                hasMore: (parseInt(offset) + formattedTransactions.length) < (totalCount?.total || 0)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get single transaction details
router.get('/:transactionId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { transactionId } = req.params;

        const transaction = await db.get(`
            SELECT 
                t.*,
                a_from.account_number as from_account_number,
                a_to.account_number as to_account_number,
                u_from.full_name as from_user_name,
                u_to.full_name as to_user_name,
                at_from.name as from_account_type,
                at_to.name as to_account_type
            FROM transactions t
            LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
            LEFT JOIN accounts a_to ON t.to_account_id = a_to.id
            LEFT JOIN users u_from ON a_from.user_id = u_from.id
            LEFT JOIN users u_to ON a_to.user_id = u_to.id
            LEFT JOIN account_types at_from ON a_from.account_type_code = at_from.code
            LEFT JOIN account_types at_to ON a_to.account_type_code = at_to.code
            WHERE t.id = ? AND (a_from.user_id = ? OR a_to.user_id = ?)
        `, [transactionId, userId, userId]);

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Determine transaction type for this user
        const transactionType = transaction.from_user_name ? 'sent' : 'received';
        const counterparty = transactionType === 'sent' ? transaction.to_user_name : transaction.from_user_name;
        const counterpartyAccount = transactionType === 'sent' ? transaction.to_account_number : transaction.from_account_number;

        res.json({
            success: true,
            transaction: {
                id: transaction.id,
                type: transactionType,
                amount: transaction.amount,
                counterparty: counterparty,
                counterpartyAccount: counterpartyAccount,
                fromAccount: transaction.from_account_number,
                toAccount: transaction.to_account_number,
                date: transaction.created_at,
                status: transaction.status,
                reference: transaction.reference,
                description: transaction.description,
                category: transaction.category
            }
        });

    } catch (error) {
        console.error('❌ Error fetching transaction details:', error);
        res.status(500).json({ error: 'Failed to fetch transaction details' });
    }
});

module.exports = router;