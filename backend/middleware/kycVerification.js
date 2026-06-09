// backend/middleware/kycVerification.js
const { db } = require('../config/db');

// Check if user is KYC verified
async function requireKYCVerification(req, res, next) {
    try {
        const userId = req.user.userId;
        
        console.log('🔍 Checking KYC verification for user:', userId);
        
        // Get user's verification status
        const user = await db.get(
            'SELECT is_verified FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found',
                kycRequired: true 
            });
        }
        
        // Check if user is verified
        if (user.is_verified !== 1) {
            console.log('❌ KYC verification required for user:', userId);
            return res.status(403).json({ 
                error: 'KYC verification required',
                message: 'Please complete identity verification to access this feature',
                kycRequired: true,
                action: 'verify_kyc'
            });
        }
        
        console.log('✅ User is KYC verified');
        next();
    } catch (error) {
        console.error('❌ KYC check error:', error);
        res.status(500).json({ error: 'Failed to verify KYC status' });
    }
}

// Check KYC status and return status info (doesn't block request)
async function checkKYCStatus(req, res, next) {
    try {
        const userId = req.user.userId;
        
        const user = await db.get(
            'SELECT is_verified FROM users WHERE id = ?',
            [userId]
        );
        
        // Add KYC status to request object
        req.kycVerified = user?.is_verified === 1;
        req.kycRequired = !req.kycVerified;
        
        next();
    } catch (error) {
        console.error('❌ KYC status check error:', error);
        req.kycVerified = false;
        req.kycRequired = true;
        next();
    }
}

module.exports = {
    requireKYCVerification,
    checkKYCStatus
};