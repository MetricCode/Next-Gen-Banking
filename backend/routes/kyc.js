const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db, generateId } = require('../config/db');
const smileIdentityService = require('../services/smileIdentityService');

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

// Submit KYC verification
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const {
            firstName,
            lastName,
            idType,
            idNumber,
            idFrontBase64,
            idBackBase64,
            selfieBase64,
        } = req.body;

        console.log('📝 KYC verification request for user:', userId);

        // Validation
        if (!firstName || !lastName || !idType || !idNumber) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!idFrontBase64 || !selfieBase64) {
            return res.status(400).json({ error: 'ID front and selfie are required' });
        }

        // Generate unique job ID
        const jobId = `JOB_${Date.now()}_${userId}`;

        // Create KYC record in database
        const kycId = generateId();
        await db.run(
            `INSERT INTO kyc_verifications (
                id, user_id, job_id, first_name, last_name, 
                id_type, id_number, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
            [kycId, userId, jobId, firstName, lastName, idType, idNumber]
        );

        // Submit to Smile Identity
        const result = await smileIdentityService.submitIdVerification({
            userId,
            jobId,
            firstName,
            lastName,
            idType,
            idNumber,
            idFrontBase64,
            idBackBase64,
            selfieBase64,
        });

        // Update database with Smile job ID
        await db.run(
            'UPDATE kyc_verifications SET smile_job_id = ? WHERE id = ?',
            [result.smileJobId, kycId]
        );

        console.log('✅ KYC verification submitted');

        res.json({
            success: true,
            jobId: result.jobId,
            message: 'Verification submitted. Results will be available shortly.',
        });
    } catch (error) {
        console.error('❌ KYC verification error:', error);
        res.status(500).json({
            error: error.message || 'KYC verification failed',
        });
    }
});

// Get KYC status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const kyc = await db.get(
            `SELECT * FROM kyc_verifications 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [userId]
        );

        if (!kyc) {
            return res.json({
                verified: false,
                status: 'not_started',
                message: 'No KYC verification found',
            });
        }

        res.json({
            verified: kyc.status === 'verified',
            status: kyc.status,
            submittedAt: kyc.created_at,
            verifiedAt: kyc.verified_at,
            message: kyc.rejection_reason || null,
        });
    } catch (error) {
        console.error('❌ Error getting KYC status:', error);
        res.status(500).json({ error: 'Failed to get KYC status' });
    }
});

// Webhook callback from Smile Identity
router.post('/callback', async (req, res) => {
    try {
        console.log('📥 Received Smile Identity callback');
        
        const payload = req.body;
        const signature = req.headers['x-signature'];

        // Verify webhook signature (optional but recommended)
        // const isValid = smileIdentityService.verifyWebhookSignature(payload, signature);
        // if (!isValid) {
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        const jobId = payload.job_id;
        const resultCode = payload.result?.ResultCode;
        const resultText = payload.result?.ResultText;
        const confidence = payload.result?.ConfidenceValue;

        console.log('📊 Verification result:', {
            jobId,
            resultCode,
            resultText,
            confidence,
        });

        // Determine status based on result code
        let status = 'pending';
        let rejectionReason = null;

        if (resultCode === '0810') {
            // Verification successful
            status = 'verified';
        } else if (resultCode === '0820') {
            // Verification failed
            status = 'rejected';
            rejectionReason = resultText || 'Verification failed';
        } else if (resultCode === '0830') {
            // Review required
            status = 'review';
            rejectionReason = 'Manual review required';
        }

        // Update KYC record
        await db.run(
            `UPDATE kyc_verifications 
             SET status = ?, 
                 result_code = ?,
                 confidence_score = ?,
                 rejection_reason = ?,
                 verified_at = CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE job_id = ?`,
            [status, resultCode, confidence, rejectionReason, status, jobId]
        );

        // Update user verification status if verified
        if (status === 'verified') {
            const kyc = await db.get('SELECT user_id FROM kyc_verifications WHERE job_id = ?', [jobId]);
            if (kyc) {
                await db.run(
                    'UPDATE users SET is_verified = 1 WHERE id = ?',
                    [kyc.user_id]
                );
                console.log('✅ User verified:', kyc.user_id);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Callback processing error:', error);
        res.status(500).json({ error: 'Callback processing failed' });
    }
});

module.exports = router;