const axios = require('axios');
const crypto = require('crypto');

class SmileIdentityService {
    constructor() {
        this.partnerId = process.env.SMILE_PARTNER_ID;
        this.apiKey = process.env.SMILE_API_KEY;
        this.environment = process.env.SMILE_ENVIRONMENT || 'sandbox';
        
        // API endpoints
        this.baseURL = this.environment === 'production'
            ? 'https://api.usesmileid.com'
            : 'https://testapi.usesmileid.com';
        
        console.log('✅ Smile Identity initialized:', {
            environment: this.environment,
            partnerId: this.partnerId
        });
    }

    // Generate signature for API calls
    generateSignature(timestamp) {
        const data = `${this.partnerId}${timestamp}`;
        return crypto
            .createHmac('sha256', this.apiKey)
            .update(data)
            .digest('hex');
    }

    // Submit ID verification job
    async submitIdVerification(userData) {
        try {
            const timestamp = Date.now().toString();
            const signature = this.generateSignature(timestamp);

            const payload = {
                partner_id: this.partnerId,
                timestamp: timestamp,
                signature: signature,
                partner_params: {
                    user_id: userData.userId,
                    job_id: userData.jobId,
                    job_type: 6, // Enhanced Document Verification
                },
                id_info: {
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    id_type: userData.idType, // 'NATIONAL_ID', 'PASSPORT', etc.
                    id_number: userData.idNumber,
                    country: 'KE', // Kenya
                },
                images: [
                    {
                        image_type_id: 1, // ID Document Front
                        image: userData.idFrontBase64,
                    },
                    {
                        image_type_id: 2, // ID Document Back
                        image: userData.idBackBase64,
                    },
                    {
                        image_type_id: 5, // Selfie
                        image: userData.selfieBase64,
                    },
                ],
                callback_url: process.env.SMILE_CALLBACK_URL,
            };

            console.log('📤 Submitting ID verification to Smile Identity...');
            
            const response = await axios.post(
                `${this.baseURL}/v1/upload`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000, // 30 second timeout
                }
            );

            console.log('✅ Smile Identity response:', response.data);

            return {
                success: true,
                jobId: userData.jobId,
                smileJobId: response.data.smile_job_id,
                message: 'Verification submitted successfully',
            };
        } catch (error) {
            console.error('❌ Smile Identity error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'ID verification failed');
        }
    }

    // Get job status
    async getJobStatus(jobId) {
        try {
            const timestamp = Date.now().toString();
            const signature = this.generateSignature(timestamp);

            const response = await axios.post(
                `${this.baseURL}/v1/job_status`,
                {
                    partner_id: this.partnerId,
                    timestamp: timestamp,
                    signature: signature,
                    job_id: jobId,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            return response.data;
        } catch (error) {
            console.error('❌ Error getting job status:', error.response?.data || error.message);
            throw error;
        }
    }

    // Verify webhook signature (for callback security)
    verifyWebhookSignature(payload, receivedSignature) {
        const timestamp = payload.timestamp;
        const expectedSignature = this.generateSignature(timestamp);
        return expectedSignature === receivedSignature;
    }
}

module.exports = new SmileIdentityService();