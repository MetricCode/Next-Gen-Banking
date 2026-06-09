// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, generateId } = require('../config/db');
const AccountService = require('../services/accountService');
const twoFactorService = require('../services/twoFactorService');

const router = express.Router();
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

// Register (keeping existing code)
router.post('/register', async (req, res) => {
    const { fullName, email, phoneNumber, idNumber, password } = req.body;
    
    if (!fullName || !email || !phoneNumber || !idNumber || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    try {
        const existingUser = await db.get(
            'SELECT email, phone_number, id_number FROM users WHERE email = ? OR phone_number = ? OR id_number = ?',
            [email, phoneNumber, idNumber]
        );
        
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(409).json({ error: 'Email already registered' });
            }
            if (existingUser.phone_number === phoneNumber) {
                return res.status(409).json({ error: 'Phone number already registered' });
            }
            if (existingUser.id_number === idNumber) {
                return res.status(409).json({ error: 'ID number already registered' });
            }
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId();
        
        await db.run(
            `INSERT INTO users (id, full_name, email, phone_number, id_number, password_hash, is_verified)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [userId, fullName, email, phoneNumber, idNumber, hashedPassword]
        );
        
        const accountTypes = ['SAVINGS', 'CHECKING', 'CRYPTO'];
        const createdAccounts = [];
        let defaultSet = false;

        for (const accountType of accountTypes) {
            const isDefault = !defaultSet && accountType === 'SAVINGS';
            const account = await AccountService.createAccount(userId, accountType, isDefault);
            createdAccounts.push(account);
            if (isDefault) defaultSet = true;
        }
        
        const defaultAccount = createdAccounts.find(acc => acc.account_type_code === 'SAVINGS');
        
        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            success: true, 
            token, 
            user: { 
                id: userId, 
                email, 
                fullName, 
                phoneNumber,
                idNumber,
                accounts: createdAccounts,
                defaultAccount: defaultAccount?.account_number
            }
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
});

// Login with 2FA support - FIXED VERSION
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Login attempt:', email);
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('✅ User found:', user.full_name, '| 2FA enabled:', user.two_factor_enabled === 1);
        
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            console.log('❌ Invalid password');
            await db.run('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?', [user.id]);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('✅ Password valid');
        
        // CHECK IF 2FA IS ENABLED - THIS IS THE KEY PART
        if (user.two_factor_enabled === 1) {
            console.log('🔐 2FA is enabled - requiring verification');
            return res.status(200).json({
                requiresTwoFactor: true,
                userId: user.id,
                message: '2FA verification required'
            });
        }
        
        // If no 2FA, proceed with normal login
        await db.run(
            'UPDATE users SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );
        
        const accounts = await AccountService.getUserAccounts(user.id);
        const defaultAccount = accounts.find(acc => acc.is_default === 1);
        
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        await db.run(
            'INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)',
            [user.id, token, req.headers['user-agent'] || 'unknown', req.ip || 'unknown', expiresAt.toISOString()]
        );
        
        console.log('✅ Login successful (no 2FA)');
        
        res.json({ 
            success: true, 
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                idNumber: user.id_number,
                accounts: accounts,
                defaultAccount: defaultAccount?.account_number,
                twoFactorEnabled: false
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Verify 2FA during login - NEW ENDPOINT
router.post('/verify-2fa-login', async (req, res) => {
    try {
        const { userId, twoFactorCode, backupCode } = req.body;
        
        console.log('🔐 Verifying 2FA:', { userId, hasCode: !!twoFactorCode, hasBackup: !!backupCode });
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (!user || user.two_factor_enabled !== 1) {
            return res.status(400).json({ error: 'Invalid request' });
        }
        
        let isTwoFactorValid = false;
        
        // Check backup code first
        if (backupCode) {
            const { valid, remainingCodes } = twoFactorService.verifyBackupCode(
                user.two_factor_backup_codes,
                backupCode
            );
            
            if (valid) {
                isTwoFactorValid = true;
                await db.run(
                    'UPDATE users SET two_factor_backup_codes = ? WHERE id = ?',
                    [JSON.stringify(remainingCodes), user.id]
                );
            }
        }
        
        // Check TOTP code
        if (!isTwoFactorValid && twoFactorCode) {
            isTwoFactorValid = twoFactorService.verifyToken(
                user.two_factor_secret,
                twoFactorCode
            );
        }
        
        if (!isTwoFactorValid) {
            console.log('❌ Invalid 2FA code');
            return res.status(401).json({ error: 'Invalid 2FA code or backup code' });
        }
        
        // 2FA verification successful - complete login
        const accounts = await AccountService.getUserAccounts(user.id);
        const defaultAccount = accounts.find(acc => acc.is_default === 1);
        
        const token = jwt.sign(
            { userId: user.id, email: user.email, twoFactorVerified: true },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        await db.run(
            'INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)',
            [user.id, token, 'mobile', 'mobile-app', expiresAt.toISOString()]
        );
        
        console.log('✅ 2FA verification successful');
        
        res.json({ 
            success: true,
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                fullName: user.full_name,
                phoneNumber: user.phone_number,
                idNumber: user.id_number,
                accounts: accounts,
                defaultAccount: defaultAccount?.account_number,
                twoFactorEnabled: true
            }
        });
        
    } catch (error) {
        console.error('❌ 2FA verification error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

// Enable 2FA
router.post('/enable-2fa', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await db.get('SELECT email FROM users WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const { secret, qrCode } = await twoFactorService.generateSecret(user.email);
        
        await db.run('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, userId]);
        
        res.json({ success: true, secret, qrCode });
        
    } catch (error) {
        console.error('Error enabling 2FA:', error);
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

// Verify 2FA Setup
router.post('/verify-2fa-setup', authenticateToken, async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.user.userId;
        
        if (!token) {
            return res.status(400).json({ error: 'Verification token is required' });
        }
        
        const user = await db.get('SELECT two_factor_secret FROM users WHERE id = ?', [userId]);
        
        if (!user || !user.two_factor_secret) {
            return res.status(400).json({ error: '2FA not initialized' });
        }
        
        const isValid = twoFactorService.verifyToken(user.two_factor_secret, token);
        
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }
        
        const backupCodes = twoFactorService.generateBackupCodes();
        
        await db.run(
            `UPDATE users SET two_factor_enabled = 1, two_factor_backup_codes = ? WHERE id = ?`,
            [JSON.stringify(backupCodes), userId]
        );
        
        console.log('✅ 2FA enabled for user:', userId);
        
        res.json({ success: true, message: '2FA enabled successfully', backupCodes });
        
    } catch (error) {
        console.error('Error verifying 2FA setup:', error);
        res.status(500).json({ error: 'Failed to verify 2FA setup' });
    }
});

// Disable 2FA
router.post('/disable-2fa', authenticateToken, async (req, res) => {
    try {
        const { password, token } = req.body;
        const userId = req.user.userId;
        
        const user = await db.get('SELECT password_hash, two_factor_secret FROM users WHERE id = ?', [userId]);
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        if (token) {
            const isValidToken = twoFactorService.verifyToken(user.two_factor_secret, token);
            if (!isValidToken) {
                return res.status(401).json({ error: 'Invalid 2FA code' });
            }
        }
        
        await db.run(
            `UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0, two_factor_backup_codes = NULL WHERE id = ?`,
            [userId]
        );
        
        res.json({ success: true, message: '2FA disabled successfully' });
        
    } catch (error) {
        console.error('Error disabling 2FA:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

// Get 2FA status
router.get('/2fa-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await db.get('SELECT two_factor_enabled FROM users WHERE id = ?', [userId]);
        
        res.json({ success: true, enabled: user?.two_factor_enabled === 1 });
        
    } catch (error) {
        console.error('Error getting 2FA status:', error);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

// Get user accounts
router.get('/accounts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const accounts = await AccountService.getUserAccounts(userId);
        res.json({ success: true, accounts });
    } catch (error) {
        console.error('Error getting accounts:', error);
        res.status(500).json({ error: 'Failed to get accounts' });
    }
});

module.exports = router;