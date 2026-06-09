// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// ==================== ROUTES ====================

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Account & Transfer routes
const accountsRoutes = require('./routes/accounts');
const transfersRoutes = require('./routes/transfers');
app.use('/api/transfers', accountsRoutes);
app.use('/api/transfers', transfersRoutes);

// M-Pesa routes
const mpesaRoutes = require('./routes/mpesa');
app.use('/api/mpesa', mpesaRoutes);

// KYC routes
const kycRoutes = require('./routes/kyc');
app.use('/api/kyc', kycRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Add after other route imports
const cryptoRoutes = require('./routes/crypto');
app.use('/api/crypto', cryptoRoutes);

// Add after other route imports
const transactionsRoutes = require('./routes/transactions');
app.use('/api/transactions', transactionsRoutes);

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ==================== ERROR HANDLING ====================

// 404 handler for undefined routes
app.use((req, res) => {
    console.log(`❌ Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
        error: 'Route not found',
        path: req.url,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🏦 NextGen Bank API Server                            ║
║   📡 Running on: http://localhost:${PORT}                 ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
    
    // Log available routes
    console.log('\n📋 Available API Endpoints:');
    console.log('   POST   /api/auth/register');
    console.log('   POST   /api/auth/login');
    console.log('   POST   /api/auth/verify-2fa-login');
    console.log('   GET    /api/auth/accounts');
    console.log('   GET    /api/transfers/account-types');
    console.log('   GET    /api/transfers/accounts');
    console.log('   POST   /api/transfers/accounts (KYC Required)');
    console.log('   POST   /api/transfers/internal-transfer (KYC Required)');
    console.log('   GET    /api/transfers/beneficiaries');
    console.log('   POST   /api/transfers/beneficiaries (KYC Required)');
    console.log('   POST   /api/mpesa/deposit');
    console.log('   POST   /api/mpesa/withdraw');
    console.log('   POST   /api/kyc/verify');
    console.log('   GET    /api/kyc/status');
    console.log('');
});