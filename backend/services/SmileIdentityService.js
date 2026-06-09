// backend/services/smileIdentityService_MOCK.js
// MOCK VERSION with AUTO-APPROVAL after 2 minutes

const { db } = require('../config/db');

class SmileIdentityService {
    constructor() {
        console.log('⚠️  WARNING: Using MOCK Smile Identity Service');
        console.log('📝 This is for TESTING ONLY - not for production!');
        console.log('✨ AUTO-APPROVAL: Verifications will be approved after 2 minutes');
        console.log('');
    }

    async submitIdVerification(userData) {
        console.log('📤 MOCK: Submitting ID verification...');
        console.log('   User ID:', userData.userId);
        console.log('   Job ID:', userData.jobId);
        console.log('   Name:', userData.firstName, userData.lastName);
        console.log('   ID Type:', userData.idType);
        console.log('   ID Number:', userData.idNumber);
        
        // Simulate API delay (2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ MOCK: Verification submitted successfully');
        console.log('⏰ Auto-approval will trigger in 2 minutes...');
        console.log('');
        
        // Schedule auto-approval after 2 minutes (120 seconds)
        this.scheduleAutoApproval(userData.jobId, userData.userId, 120000);
        
        // Return mock successful response
        return {
            success: true,
            jobId: userData.jobId,
            smileJobId: `MOCK_SMILE_${Date.now()}`,
            message: 'Verification submitted successfully (MOCK MODE)',
        };
    }

    // Auto-approve verification after delay
    scheduleAutoApproval(jobId, userId, delayMs) {
        setTimeout(async () => {
            try {
                console.log('');
                console.log('⏰ AUTO-APPROVAL TRIGGERED for job:', jobId);
                console.log('   Approving verification...');
                
                // Update KYC record to verified
                await db.run(
                    `UPDATE kyc_verifications 
                     SET status = 'verified', 
                         result_code = '0810',
                         confidence_score = 99.5,
                         verified_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE job_id = ?`,
                    [jobId]
                );
                
                // Update user verification status
                await db.run(
                    'UPDATE users SET is_verified = 1 WHERE id = ?',
                    [userId]
                );
                
                console.log('✅ MOCK: Verification approved successfully!');
                console.log('   User', userId, 'is now verified');
                console.log('');
            } catch (error) {
                console.error('❌ MOCK: Auto-approval error:', error);
            }
        }, delayMs);
    }

    async getJobStatus(jobId) {
        console.log('📊 MOCK: Getting job status for:', jobId);
        
        // Check actual status from database
        try {
            const kyc = await db.get(
                'SELECT status, result_code FROM kyc_verifications WHERE job_id = ?',
                [jobId]
            );
            
            if (kyc && kyc.status === 'verified') {
                return {
                    job_id: jobId,
                    result: {
                        ResultCode: '0810',
                        ResultText: 'Verified (MOCK - Auto-approved)',
                        ConfidenceValue: '99.5',
                    },
                };
            }
        } catch (error) {
            console.log('Could not check database status:', error.message);
        }
        
        // Return pending status if not yet approved
        return {
            job_id: jobId,
            result: {
                ResultCode: '0830', // Under review
                ResultText: 'Pending (MOCK - Waiting for auto-approval)',
                ConfidenceValue: null,
            },
        };
    }

    verifyWebhookSignature(payload, receivedSignature) {
        console.log('🔐 MOCK: Webhook signature check (always valid)');
        return true;
    }

    generateSignature(timestamp) {
        return 'mock_signature_' + timestamp;
    }
}

module.exports = new SmileIdentityService();