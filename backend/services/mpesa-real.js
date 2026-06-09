// backend/services/mpesa-real.js
const axios = require('axios');
const moment = require('moment');
const { db } = require('../config/db');

class RealMPesaService {
    constructor() {
        // M-Pesa Daraja API Configuration
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
        this.shortcode = process.env.MPESA_SHORTCODE || '174379'; // Default test shortcode
        
        // API URLs
        this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
        this.baseURL = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        
        // Callback URL - MUST be publicly accessible (use ngrok for testing)
        this.callbackURL = process.env.MPESA_CALLBACK_URL || 'https://your-ngrok-url.ngrok-free.app/api/mpesa/callback';
        
        console.log('🔧 Real M-Pesa Service initialized:', {
            environment: this.environment,
            shortcode: this.shortcode,
            callbackURL: this.callbackURL
        });
    }

    // Get OAuth Access Token
    async getAccessToken() {
        try {
            const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
            
            const response = await axios.get(
                `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                    },
                }
            );

            console.log('✅ M-Pesa Access Token generated');
            return response.data.access_token;
        } catch (error) {
            console.error('❌ M-Pesa Access Token Error:', error.response?.data || error.message);
            throw new Error('Failed to get M-Pesa access token');
        }
    }

    // Format phone number to 254XXXXXXXXX
    formatPhoneNumber(phoneNumber) {
        let cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
        
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        }
        
        if (!cleaned.startsWith('254')) {
            cleaned = '254' + cleaned;
        }
        
        return cleaned;
    }

    // Generate Password for STK Push
    generatePassword(timestamp) {
        const password = Buffer.from(
            `${this.shortcode}${this.passkey}${timestamp}`
        ).toString('base64');
        return password;
    }

    // STK Push (Lipa na M-Pesa Online) - For Deposits
    async stkPush(phoneNumber, amount, accountReference, userId) {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = moment().format('YYYYMMDDHHmmss');
            const password = this.generatePassword(timestamp);
            const formattedPhone = this.formatPhoneNumber(phoneNumber);

            console.log('📱 [REAL] Initiating STK Push:', {
                phone: formattedPhone,
                amount,
                reference: accountReference,
                timestamp
            });

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
                {
                    BusinessShortCode: this.shortcode,
                    Password: password,
                    Timestamp: timestamp,
                    TransactionType: 'CustomerPayBillOnline',
                    Amount: Math.floor(amount),
                    PartyA: formattedPhone,
                    PartyB: this.shortcode,
                    PhoneNumber: formattedPhone,
                    CallBackURL: `${this.callbackURL}/stkpush`,
                    AccountReference: accountReference.substring(0, 12),
                    TransactionDesc: 'Deposit to NextGen Bank',
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            console.log('✅ [REAL] STK Push Response:', response.data);

            const { CheckoutRequestID, MerchantRequestID, ResponseCode, ResponseDescription } = response.data;

            if (ResponseCode !== '0') {
                throw new Error(ResponseDescription || 'STK Push failed');
            }

            // Store transaction in database
            await db.run(
                `INSERT INTO mpesa_transactions (
                    user_id, phone_number, amount, transaction_type,
                    checkout_request_id, merchant_request_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    formattedPhone,
                    amount,
                    'deposit',
                    CheckoutRequestID,
                    MerchantRequestID,
                    'pending'
                ]
            );

            return {
                success: true,
                message: 'STK Push sent. Please check your phone and enter PIN.',
                checkoutRequestID: CheckoutRequestID,
                merchantRequestID: MerchantRequestID,
                requiresPin: false, // Real M-Pesa uses phone PIN, not app PIN
                isReal: true
            };
        } catch (error) {
            console.error('❌ [REAL] STK Push Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.errorMessage || error.message || 'M-Pesa STK Push failed');
        }
    }

    // Query STK Push Status
    async queryStkPushStatus(checkoutRequestID) {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = moment().format('YYYYMMDDHHmmss');
            const password = this.generatePassword(timestamp);

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: this.shortcode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestID,
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            console.log('✅ [REAL] STK Push Query:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ [REAL] STK Push Query Error:', error.response?.data || error.message);
            throw new Error('Failed to query STK Push status');
        }
    }

    // Handle STK Push Callback
    async handleStkPushCallback(callbackData) {
        try {
            console.log('📥 [REAL] STK Push Callback received');
            
            const { Body } = callbackData;
            const { stkCallback } = Body;
            const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

            let status = 'failed';
            let mpesaReceiptNumber = null;
            let transactionDate = null;
            let amount = null;

            if (ResultCode === 0) {
                status = 'completed';
                
                const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
                
                callbackMetadata.forEach(item => {
                    if (item.Name === 'MpesaReceiptNumber') {
                        mpesaReceiptNumber = item.Value;
                    }
                    if (item.Name === 'TransactionDate') {
                        transactionDate = item.Value;
                    }
                    if (item.Name === 'Amount') {
                        amount = item.Value;
                    }
                });

                console.log('✅ [REAL] Payment Successful:', {
                    receipt: mpesaReceiptNumber,
                    amount,
                    checkoutID: CheckoutRequestID
                });

                // Update transaction in database
                await db.run(
                    `UPDATE mpesa_transactions 
                     SET status = ?, mpesa_receipt_number = ?, 
                         transaction_date = ?, completed_at = CURRENT_TIMESTAMP
                     WHERE checkout_request_id = ?`,
                    [status, mpesaReceiptNumber, transactionDate, CheckoutRequestID]
                );

                // Get transaction details
                const transaction = await db.get(
                    'SELECT user_id, amount FROM mpesa_transactions WHERE checkout_request_id = ?',
                    [CheckoutRequestID]
                );

                if (transaction) {
                    // Get user's primary account
                    const account = await db.get(
                        'SELECT id, balance FROM accounts WHERE user_id = ? AND account_type = ? LIMIT 1',
                        [transaction.user_id, 'savings']
                    );

                    if (account) {
                        // Credit account
                        await db.run(
                            'UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [transaction.amount, account.id]
                        );

                        // Create transaction record
                        const reference = `MPESA-${mpesaReceiptNumber}`;
                        await db.run(
                            `INSERT INTO transactions (
                                to_account_id, amount, type, status, reference,
                                description, mpesa_code, completed_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [
                                account.id,
                                transaction.amount,
                                'deposit',
                                'completed',
                                reference,
                                'M-Pesa Deposit',
                                mpesaReceiptNumber
                            ]
                        );

                        console.log('✅ [REAL] Account credited:', {
                            userId: transaction.user_id,
                            amount: transaction.amount
                        });
                    }
                }
            } else {
                console.log('❌ [REAL] Payment Failed:', ResultDesc);
                
                await db.run(
                    `UPDATE mpesa_transactions 
                     SET status = ?, error_message = ?
                     WHERE checkout_request_id = ?`,
                    [status, ResultDesc, CheckoutRequestID]
                );
            }

            return { success: true, status, receiptNumber: mpesaReceiptNumber };
        } catch (error) {
            console.error('❌ [REAL] Callback Handler Error:', error);
            throw error;
        }
    }
}

module.exports = new RealMPesaService();