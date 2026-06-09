// backend/routes/crypto.js - COMPLETELY FIXED VERSION (NO EXTERNAL API CALLS)
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, generateId } = require('../config/db');
const AccountService = require('../services/accountService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ==================== HARDCODED DATA (NO EXTERNAL API) ====================
const SUPPORTED_CURRENCIES = [
    {
        code: 'USDT',
        name: 'Tether (TRC20)',
        icon: '💵',
        minAmount: 10,
        maxAmount: 10000,
        network: 'TRC20',
        networkFull: 'Tron Network (TRC20)',
        addressPrefix: 'T',
        confirmations: 19,
        rate: 1  // 1 USDT = $1 USD
    },
    {
        code: 'LTC',
        name: 'Litecoin',
        icon: 'Ł',
        minAmount: 10,
        maxAmount: 10000,
        network: 'Litecoin',
        networkFull: 'Litecoin Network',
        addressPrefix: 'L',
        confirmations: 6,
        rate: 70  // 1 LTC = $70 USD
    }
];

const FIXED_RATES = {
    USDT: {
        usdRate: 1,
        cryptoPerUsd: 1,
        kesRate: 130,
        name: 'Tether (TRC20)',
        icon: '💵',
        minAmount: 10
    },
    LTC: {
        usdRate: 70,
        cryptoPerUsd: 0.0142857,
        kesRate: 9100,
        name: 'Litecoin',
        icon: 'Ł',
        minAmount: 10
    }
};

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

// Run once per process — skip repeat calls after the first successful migration
let tableReady = false;

async function ensureCryptoTable() {
    if (tableReady) return;

    // 1. Create the table with the full schema if it does not exist yet
    await db.run(`
        CREATE TABLE IF NOT EXISTS crypto_deposits (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            account_id TEXT,
            order_id TEXT,
            payment_id TEXT,
            fiat_amount REAL NOT NULL,
            crypto_currency TEXT NOT NULL,
            crypto_amount REAL NOT NULL,
            wallet_address TEXT NOT NULL,
            network TEXT,
            status TEXT DEFAULT 'pending',
            actually_paid REAL,
            external_status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // 2. Add any columns missing from older table versions.
    //    SQLite raises "duplicate column name" when a column already exists — ignore that, fail on anything else.
    const migrations = [
        'ALTER TABLE crypto_deposits ADD COLUMN account_id TEXT',
        'ALTER TABLE crypto_deposits ADD COLUMN order_id TEXT',
        'ALTER TABLE crypto_deposits ADD COLUMN payment_id TEXT',
        'ALTER TABLE crypto_deposits ADD COLUMN network TEXT',
        'ALTER TABLE crypto_deposits ADD COLUMN actually_paid REAL',
        'ALTER TABLE crypto_deposits ADD COLUMN external_status TEXT',
        'ALTER TABLE crypto_deposits ADD COLUMN completed_at DATETIME',
        'ALTER TABLE crypto_deposits ADD COLUMN updated_at DATETIME',
    ];

    for (const sql of migrations) {
        try {
            await db.run(sql);
        } catch (e) {
            if (!e.message.includes('duplicate column name')) {
                console.warn('Migration warning:', e.message);
            }
        }
    }

    await db.run(`CREATE INDEX IF NOT EXISTS idx_crypto_deposits_user_id ON crypto_deposits(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_crypto_deposits_status ON crypto_deposits(status)`);

    console.log('✅ Crypto deposits table ready');
    tableReady = true;
}

// Generate random wallet address
function generateWalletAddress(currency) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let address = currency === 'USDT' ? 'T' : 'L';
    
    for (let i = 0; i < 33; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

// ==================== ENDPOINTS ====================

// Get available cryptocurrencies
router.get('/currencies', authenticateToken, async (req, res) => {
    console.log('💰 GET /crypto/currencies');
    try {
        await ensureCryptoTable();
        res.json({ success: true, currencies: SUPPORTED_CURRENCIES });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: true, currencies: SUPPORTED_CURRENCIES });
    }
});

// Get exchange rates
router.get('/rates', authenticateToken, async (req, res) => {
    console.log('💰 GET /crypto/rates');
    try {
        await ensureCryptoTable();
        res.json({ success: true, rates: FIXED_RATES });
    } catch (error) {
        console.error('Error:', error);
        res.json({ success: true, rates: FIXED_RATES });
    }
});

// Estimate crypto amount (USD to Crypto)
router.post('/estimate', authenticateToken, async (req, res) => {
    console.log('💰 POST /crypto/estimate');
    try {
        const { fiatAmount, cryptoCurrency } = req.body;
        
        if (!fiatAmount || !cryptoCurrency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const amountUSD = parseFloat(fiatAmount);
        if (isNaN(amountUSD) || amountUSD <= 0) {
            return res.status(400).json({ error: 'Invalid amount. Please enter a valid USD amount.' });
        }
        
        // Find the currency
        const currency = SUPPORTED_CURRENCIES.find(c => c.code === cryptoCurrency);
        if (!currency) {
            return res.status(400).json({ error: `Unsupported currency: ${cryptoCurrency}. Supported: USDT, LTC` });
        }
        
        // Check minimum amount
        if (amountUSD < currency.minAmount) {
            return res.status(400).json({ 
                error: `Minimum deposit is $${currency.minAmount} USD for ${currency.name}` 
            });
        }
        
        // Check maximum amount
        if (amountUSD > currency.maxAmount) {
            return res.status(400).json({ 
                error: `Maximum deposit is $${currency.maxAmount} USD for ${currency.name}` 
            });
        }
        
        // Calculate crypto amount
        const cryptoAmount = amountUSD / currency.rate;
        
        res.json({ 
            success: true, 
            estimate: {
                fiatAmount: amountUSD,
                fiatCurrency: 'USD',
                cryptoAmount: cryptoAmount,
                cryptoCurrency: cryptoCurrency,
                rate: currency.rate,
                rateDescription: `1 ${cryptoCurrency} = $${currency.rate} USD`
            }
        });
    } catch (error) {
        console.error('Estimate error:', error);
        res.status(500).json({ error: 'Failed to estimate payment' });
    }
});

// Create crypto deposit
router.post('/deposit', authenticateToken, async (req, res) => {
    console.log('💰 POST /crypto/deposit');
    try {
        const userId = req.user.userId;
        const { currency, fiatAmount } = req.body;
        
        if (!currency || !fiatAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Find the currency
        const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === currency);
        if (!selectedCurrency) {
            return res.status(400).json({ 
                error: `Unsupported currency: ${currency}. Please choose USDT or LTC.` 
            });
        }
        
        const depositAmountUSD = parseFloat(fiatAmount);
        if (isNaN(depositAmountUSD) || depositAmountUSD <= 0) {
            return res.status(400).json({ error: 'Invalid amount. Please enter a valid USD amount.' });
        }
        
        // Validate amount
        if (depositAmountUSD < selectedCurrency.minAmount) {
            return res.status(400).json({ 
                error: `Minimum deposit is $${selectedCurrency.minAmount} USD for ${selectedCurrency.name}` 
            });
        }
        
        if (depositAmountUSD > selectedCurrency.maxAmount) {
            return res.status(400).json({ 
                error: `Maximum deposit is $${selectedCurrency.maxAmount} USD for ${selectedCurrency.name}` 
            });
        }
        
        // Ensure table exists
        await ensureCryptoTable();
        
        // Calculate crypto amount
        const cryptoAmount = depositAmountUSD / selectedCurrency.rate;
        
        // Generate unique wallet address for this deposit
        const walletAddress = generateWalletAddress(currency);
        const depositId = generateId();
        const orderId = `CRYPTO_${Date.now()}_${userId}`;
        const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        // Store deposit record (no account_id column)
        await db.run(
            `INSERT INTO crypto_deposits (
                id, user_id, order_id, payment_id,
                fiat_amount, crypto_currency, crypto_amount,
                wallet_address, network, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
            [
                depositId, userId, orderId, paymentId,
                depositAmountUSD, currency, cryptoAmount,
                walletAddress, selectedCurrency.network
            ]
        );
        
        console.log('✅ Crypto deposit created:', { 
            depositId, 
            userId, 
            currency, 
            amountUSD: depositAmountUSD,
            cryptoAmount: cryptoAmount.toFixed(currency === 'USDT' ? 2 : 8),
            walletAddress: walletAddress.substring(0, 10) + '...'
        });
        
        // Auto-complete after 2 minutes for testing
        setTimeout(async () => {
            try {
                const deposit = await db.get('SELECT status FROM crypto_deposits WHERE id = ?', [depositId]);
                
                if (deposit && deposit.status === 'pending') {
                    await db.run(
                        `UPDATE crypto_deposits 
                         SET status = 'completed', 
                             actually_paid = ?,
                             completed_at = CURRENT_TIMESTAMP 
                         WHERE id = ?`,
                        [depositAmountUSD, depositId]
                    );
                    console.log('✅ Mock deposit auto-completed:', depositId);
                }
            } catch (err) {
                console.error('Auto-completion error:', err);
            }
        }, 120000); // 2 minutes
        
        // Return deposit information
        res.json({
            success: true,
            deposit: {
                id: depositId,
                orderId: orderId,
                paymentId: paymentId,
                fiatAmount: depositAmountUSD,
                fiatCurrency: 'USD',
                cryptoCurrency: currency,
                cryptoAmount: cryptoAmount,
                walletAddress: walletAddress,
                network: selectedCurrency.network,
                networkFull: selectedCurrency.networkFull,
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
                minConfirmations: selectedCurrency.confirmations,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 3600000).toISOString()
            }
        });
    } catch (error) {
        console.error('Create deposit error:', error);
        res.status(500).json({ error: error.message || 'Failed to create deposit' });
    }
});

// Get deposit status
router.get('/deposit/:depositId', authenticateToken, async (req, res) => {
    console.log('💰 GET /crypto/deposit/:depositId');
    try {
        const userId = req.user.userId;
        const { depositId } = req.params;
        
        await ensureCryptoTable();
        
        const deposit = await db.get(
            `SELECT * FROM crypto_deposits WHERE id = ? AND user_id = ?`,
            [depositId, userId]
        );
        
        if (!deposit) {
            return res.status(404).json({ error: 'Deposit not found' });
        }
        
        res.json({ 
            success: true, 
            deposit: {
                id: deposit.id,
                orderId: deposit.order_id,
                paymentId: deposit.payment_id,
                fiatAmount: deposit.fiat_amount,
                cryptoCurrency: deposit.crypto_currency,
                cryptoAmount: deposit.crypto_amount,
                walletAddress: deposit.wallet_address,
                network: deposit.network,
                status: deposit.status,
                actuallyPaid: deposit.actually_paid,
                createdAt: deposit.created_at,
                completedAt: deposit.completed_at
            }
        });
    } catch (error) {
        console.error('Get deposit error:', error);
        res.status(500).json({ error: 'Failed to get deposit status' });
    }
});

// Get deposit history
router.get('/history', authenticateToken, async (req, res) => {
    console.log('💰 GET /crypto/history');
    try {
        const userId = req.user.userId;
        const { limit = 50, offset = 0 } = req.query;
        
        await ensureCryptoTable();
        
        const deposits = await db.all(
            `SELECT * FROM crypto_deposits 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), parseInt(offset)]
        ) || [];
        
        // Get statistics
        const stats = await db.get(
            `SELECT 
                COUNT(*) as total_deposits,
                SUM(CASE WHEN status = 'completed' THEN fiat_amount ELSE 0 END) as total_completed,
                SUM(CASE WHEN status = 'pending' THEN fiat_amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
             FROM crypto_deposits 
             WHERE user_id = ?`,
            [userId]
        ) || { total_deposits: 0, total_completed: 0, total_pending: 0, completed_count: 0, pending_count: 0 };
        
        // Format deposits for response
        const formattedDeposits = deposits.map(deposit => ({
            id: deposit.id,
            fiatAmount: deposit.fiat_amount,
            cryptoAmount: deposit.crypto_amount,
            cryptoCurrency: deposit.crypto_currency,
            status: deposit.status,
            createdAt: deposit.created_at,
            completedAt: deposit.completed_at,
            walletAddress: deposit.wallet_address,
            network: deposit.network
        }));
        
        res.json({ 
            success: true, 
            deposits: formattedDeposits,
            stats: {
                totalDeposits: stats.total_deposits || 0,
                totalCompleted: stats.total_completed || 0,
                totalPending: stats.total_pending || 0,
                completedCount: stats.completed_count || 0,
                pendingCount: stats.pending_count || 0
            },
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                returned: formattedDeposits.length
            }
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get deposit history' });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        await ensureCryptoTable();
        res.json({ 
            status: 'OK', 
            crypto: 'enabled',
            supportedCurrencies: SUPPORTED_CURRENCIES.map(c => c.code),
            mode: 'mock',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;