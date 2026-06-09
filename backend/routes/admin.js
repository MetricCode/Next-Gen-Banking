// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const AccountService = require('../services/accountService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-key-change-in-production';

// Middleware to verify admin token
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, ADMIN_SECRET, (err, admin) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired admin token' });
        }
        req.admin = admin;
        next();
    });
};

// Admin login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Admin login attempt:', username);
    
    // Simple hardcoded admin credentials - In production, use database with hashed passwords
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        console.log('❌ Invalid admin credentials');
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate admin token
    const token = jwt.sign(
        { username, role: 'admin' },
        ADMIN_SECRET,
        { expiresIn: '8h' }
    );
    
    console.log('✅ Admin login successful');
    res.json({ 
        success: true, 
        token,
        admin: { username, role: 'admin' }
    });
});

// Get dashboard statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Get total users
        const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
        
        // Get total accounts
        const accountsCount = await db.get('SELECT COUNT(*) as count FROM accounts');
        
        // Get total transactions
        const transactionsCount = await db.get('SELECT COUNT(*) as count FROM transactions');
        
        // Get total balance across all accounts
        const totalBalance = await db.get('SELECT SUM(balance) as total FROM accounts');
        
        // Get today's transactions
        const todayTransactions = await db.get(
            `SELECT COUNT(*) as count FROM transactions 
             WHERE DATE(created_at) = DATE('now')`
        );
        
        // Get this month's transactions
        const monthTransactions = await db.get(
            `SELECT COUNT(*) as count FROM transactions 
             WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
        );
        
        // Get new users this month
        const newUsersThisMonth = await db.get(
            `SELECT COUNT(*) as count FROM users 
             WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
        );
        
        const stats = {
            totalUsers: usersCount.count,
            totalAccounts: accountsCount.count,
            totalTransactions: transactionsCount.count,
            totalBalance: totalBalance.total || 0,
            todayTransactions: todayTransactions.count,
            monthTransactions: monthTransactions.count,
            newUsersThisMonth: newUsersThisMonth.count,
        };
        
        console.log('✅ Stats fetched:', stats);
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ==================== CRYPTO ADMIN ENDPOINTS ====================

// Get crypto deposit statistics
router.get('/crypto/stats', authenticateAdmin, async (req, res) => {
    try {
        console.log('💰 Fetching crypto deposit stats...');
        
        const stats = await db.get(`
            SELECT 
                COALESCE(SUM(fiat_amount), 0) as total_deposits,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN fiat_amount ELSE 0 END), 0) as pending_deposits,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN fiat_amount ELSE 0 END), 0) as completed_deposits,
                COUNT(*) as deposit_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
            FROM crypto_deposits
        `);
        
        res.json({ 
            success: true, 
            totalDeposits: stats.total_deposits || 0,
            pendingDeposits: stats.pending_deposits || 0,
            completedDeposits: stats.completed_deposits || 0,
            depositCount: stats.deposit_count || 0,
            pendingCount: stats.pending_count || 0,
            completedCount: stats.completed_count || 0
        });
    } catch (error) {
        console.error('❌ Error fetching crypto stats:', error);
        // Return zeros instead of error
        res.json({ 
            success: true, 
            totalDeposits: 0,
            pendingDeposits: 0,
            completedDeposits: 0,
            depositCount: 0,
            pendingCount: 0,
            completedCount: 0
        });
    }
});

// Get all crypto deposits with user info
router.get('/crypto/deposits', authenticateAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, status = '' } = req.query;
        
        console.log('💰 Fetching crypto deposits - limit:', limit, 'status:', status);
        
        // First, check if the table exists
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='crypto_deposits'"
        );
        
        if (!tableExists) {
            console.log('⚠️ crypto_deposits table not found yet');
            return res.json({ 
                success: true, 
                deposits: [],
                pagination: {
                    page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
                    limit: parseInt(limit),
                    total: 0,
                    totalPages: 0
                }
            });
        }
        
        let query = `
            SELECT 
                cd.*,
                u.full_name as user_name,
                u.email as user_email,
                u.phone_number as user_phone
            FROM crypto_deposits cd
            LEFT JOIN users u ON cd.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status && status !== 'all') {
            query += ` AND cd.status = ?`;
            params.push(status);
        }
        
        query += ` ORDER BY cd.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const deposits = await db.all(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM crypto_deposits WHERE 1=1';
        const countParams = [];
        
        if (status && status !== 'all') {
            countQuery += ` AND status = ?`;
            countParams.push(status);
        }
        
        const totalCount = await db.get(countQuery, countParams);
        
        console.log(`✅ Found ${deposits.length} crypto deposits`);
        
        res.json({ 
            success: true, 
            deposits,
            pagination: {
                page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
                limit: parseInt(limit),
                total: totalCount.count || 0,
                totalPages: Math.ceil((totalCount.count || 0) / limit)
            }
        });
    } catch (error) {
        console.error('❌ Error fetching crypto deposits:', error);
        res.json({ 
            success: true, 
            deposits: [],
            pagination: {
                page: 1,
                limit: 50,
                total: 0,
                totalPages: 0
            }
        });
    }
});

// Get user details with crypto deposits and accounts
router.get('/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🔍 Fetching user details:', userId);
        
        // Get user info
        const user = await db.get(
            'SELECT id, full_name, email, phone_number, id_number, is_verified, is_active, created_at, last_login FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user accounts with balances
        const accounts = await db.all(`
            SELECT a.*, at.name as account_type_name 
            FROM accounts a 
            JOIN account_types at ON a.account_type_code = at.code 
            WHERE a.user_id = ?
        `, [userId]);
        
        // Get total balance
        const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        
        // Get crypto deposits
        let cryptoDeposits = [];
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='crypto_deposits'"
        );
        
        if (tableExists) {
            cryptoDeposits = await db.all(`
                SELECT * FROM crypto_deposits 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            `, [userId]);
        }
        
        // Get recent transactions
        const recentTransactions = await db.all(`
            SELECT t.*, 
                   fa.account_number as from_account_number,
                   ta.account_number as to_account_number
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            WHERE fa.user_id = ? OR ta.user_id = ?
            ORDER BY t.created_at DESC
            LIMIT 10
        `, [userId, userId]);
        
        res.json({ 
            success: true, 
            user: {
                ...user,
                accounts,
                total_balance: totalBalance,
                crypto_deposits: cryptoDeposits,
                recent_transactions: recentTransactions
            }
        });
    } catch (error) {
        console.error('❌ Error fetching user details:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// ==================== EXISTING ADMIN ENDPOINTS ====================

// Get all users with pagination
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('👥 Fetching users - page:', page, 'search:', search);
        
        let query = `
            SELECT 
                u.id,
                u.full_name,
                u.email,
                u.phone_number,
                u.id_number,
                u.is_verified,
                u.is_active,
                u.created_at,
                u.last_login,
                COUNT(DISTINCT a.id) as account_count,
                COALESCE(SUM(a.balance), 0) as total_balance
            FROM users u
            LEFT JOIN accounts a ON u.id = a.user_id
        `;
        
        const params = [];
        
        if (search) {
            query += ` WHERE u.full_name LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ?`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        
        query += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const users = await db.all(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM users';
        const countParams = [];
        
        if (search) {
            countQuery += ` WHERE full_name LIKE ? OR email LIKE ? OR phone_number LIKE ?`;
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }
        
        const totalCount = await db.get(countQuery, countParams);
        
        console.log(`✅ Found ${users.length} users`);
        res.json({ 
            success: true, 
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user details
router.put('/users/:userId', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, email, phoneNumber, idNumber } = req.body;
        
        console.log('✏️ Updating user:', userId, req.body);
        
        // Validate required fields
        if (!fullName || !email || !phoneNumber || !idNumber) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check if email is taken by another user
        const existingEmail = await db.get(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );
        
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already in use by another user' });
        }
        
        // Check if phone is taken by another user
        const existingPhone = await db.get(
            'SELECT id FROM users WHERE phone_number = ? AND id != ?',
            [phoneNumber, userId]
        );
        
        if (existingPhone) {
            return res.status(409).json({ error: 'Phone number already in use by another user' });
        }
        
        // Check if ID number is taken by another user
        const existingId = await db.get(
            'SELECT id FROM users WHERE id_number = ? AND id != ?',
            [idNumber, userId]
        );
        
        if (existingId) {
            return res.status(409).json({ error: 'ID number already in use by another user' });
        }
        
        // Update user
        await db.run(
            `UPDATE users 
             SET full_name = ?, email = ?, phone_number = ?, id_number = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [fullName, email, phoneNumber, idNumber, userId]
        );
        
        console.log('✅ User updated successfully');
        res.json({ 
            success: true, 
            message: 'User updated successfully' 
        });
        
    } catch (error) {
        console.error('❌ Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Get all transactions with pagination
router.get('/transactions', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, status = '', type = '' } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('💸 Fetching transactions - page:', page);
        
        let query = `
            SELECT 
                t.*,
                fa.account_number as from_account_number,
                ta.account_number as to_account_number,
                fu.full_name as from_user_name,
                tu.full_name as to_user_name
            FROM transactions t
            LEFT JOIN accounts fa ON t.from_account_id = fa.id
            LEFT JOIN accounts ta ON t.to_account_id = ta.id
            LEFT JOIN users fu ON fa.user_id = fu.id
            LEFT JOIN users tu ON ta.user_id = tu.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ` AND t.status = ?`;
            params.push(status);
        }
        
        if (type) {
            query += ` AND t.type = ?`;
            params.push(type);
        }
        
        query += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const transactions = await db.all(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM transactions WHERE 1=1';
        const countParams = [];
        
        if (status) {
            countQuery += ` AND status = ?`;
            countParams.push(status);
        }
        
        if (type) {
            countQuery += ` AND type = ?`;
            countParams.push(type);
        }
        
        const totalCount = await db.get(countQuery, countParams);
        
        console.log(`✅ Found ${transactions.length} transactions`);
        res.json({ 
            success: true, 
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get all accounts
router.get('/accounts', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('🏦 Fetching accounts - page:', page);
        
        const accounts = await db.all(
            `SELECT 
                a.*,
                u.full_name as user_name,
                u.email as user_email,
                u.id as user_id,
                at.name as account_type_name
             FROM accounts a
             JOIN users u ON a.user_id = u.id
             JOIN account_types at ON a.account_type_code = at.code
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );
        
        const totalCount = await db.get('SELECT COUNT(*) as count FROM accounts');
        
        console.log(`✅ Found ${accounts.length} accounts`);
        res.json({ 
            success: true, 
            accounts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount.count,
                totalPages: Math.ceil(totalCount.count / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// Suspend/Activate user
router.patch('/users/:userId/status', authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        
        console.log(`${isActive ? '✅' : '🚫'} ${isActive ? 'Activating' : 'Suspending'} user:`, userId);
        
        await db.run(
            'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [isActive ? 1 : 0, userId]
        );
        
        res.json({ 
            success: true, 
            message: `User ${isActive ? 'activated' : 'suspended'} successfully` 
        });
        
    } catch (error) {
        console.error('❌ Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

module.exports = router;