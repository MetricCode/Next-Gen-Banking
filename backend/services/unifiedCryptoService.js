// backend/services/unifiedCryptoService.js
const axios = require('axios');
const crypto = require('crypto');
const { db } = require('../config/db');

class UnifiedCryptoService {
    constructor() {
        this.nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY;
        this.nowpaymentsApiUrl = 'https://api.nowpayments.io/v1';
        
        console.log('💰 Unified Crypto Service initialized');
    }

    // Get available cryptocurrencies - ONLY USDT (TRC20) and LTC
    async getAvailableCurrencies() {
        try {
            const response = await axios.get(`${this.nowpaymentsApiUrl}/currencies`, {
                headers: { 'x-api-key': this.nowpaymentsApiKey }
            });
            
            // Filter to ONLY USDT (TRC20) and LTC
            const supportedCurrencies = ['USDT', 'LTC'];
            const currencies = (response.data.currencies || [])
                .filter(c => supportedCurrencies.includes(c))
                .map(code => ({
                    code: code,
                    name: code === 'USDT' ? 'Tether (TRC20)' : 'Litecoin',
                    icon: code === 'USDT' ? '💵' : 'Ł',
                    minAmount: code === 'USDT' ? 10 : 0.1,
                    network: code === 'USDT' ? 'TRC20' : 'Litecoin',
                    networkFull: code === 'USDT' ? 'Tron Network (TRC20)' : 'Litecoin Network',
                    addressPrefix: code === 'USDT' ? 'T' : 'L',
                    confirmations: code === 'USDT' ? 19 : 6
                }));
            
            return currencies;
        } catch (error) {
            console.error('Error fetching currencies:', error);
            // Return fallback currencies
            return [
                { 
                    code: 'USDT', 
                    name: 'Tether (TRC20)', 
                    icon: '💵', 
                    minAmount: 10, 
                    network: 'TRC20',
                    networkFull: 'Tron Network (TRC20)',
                    addressPrefix: 'T',
                    confirmations: 19
                },
                { 
                    code: 'LTC', 
                    name: 'Litecoin', 
                    icon: 'Ł', 
                    minAmount: 0.1, 
                    network: 'Litecoin',
                    networkFull: 'Litecoin Network',
                    addressPrefix: 'L',
                    confirmations: 6
                }
            ];
        }
    }

    getCurrencyName(code) {
        return code === 'USDT' ? 'Tether (TRC20)' : 'Litecoin';
    }

    getCurrencyIcon(code) {
        return code === 'USDT' ? '💵' : 'Ł';
    }

    getMinAmount(code) {
        return code === 'USDT' ? 10 : 0.1;
    }

    getNetwork(code) {
        return code === 'USDT' ? 'TRC20' : 'Litecoin';
    }

    // Get exchange rates
    async getExchangeRate(currencyCode) {
        try {
            const response = await axios.get(
                `${this.nowpaymentsApiUrl}/rate`,
                {
                    params: {
                        from: currencyCode.toLowerCase(),
                        to: 'usd'
                    },
                    headers: { 'x-api-key': this.nowpaymentsApiKey }
                }
            );
            return response.data.rate;
        } catch (error) {
            // Fallback rates
            const fallbackRates = {
                'USDT': 1,
                'LTC': 70
            };
            return fallbackRates[currencyCode] || 100;
        }
    }

    // Create crypto deposit payment
    async createDeposit(userId, fiatAmount, currencyCode) {
        try {
            // Get exchange rate
            const rate = await this.getExchangeRate(currencyCode);
            const cryptoAmount = fiatAmount / rate;
            
            // Generate unique order ID
            const orderId = `DEP_${Date.now()}_${userId}_${crypto.randomBytes(4).toString('hex')}`;
            
            // Determine currency for API (USDT needs specific handling)
            let payCurrency = currencyCode.toLowerCase();
            if (currencyCode === 'USDT') {
                payCurrency = 'usdttrc20'; // USDT on TRC20 network
            }
            
            // Create payment with NOWPayments
            const response = await axios.post(
                `${this.nowpaymentsApiUrl}/payment`,
                {
                    price_amount: fiatAmount,
                    price_currency: 'USD',
                    pay_currency: payCurrency,
                    order_id: orderId,
                    order_description: `Crypto deposit for user ${userId}`,
                    ipn_callback_url: process.env.NOWPAYMENTS_CALLBACK_URL || 
                        `${process.env.API_URL || 'https://matchbook-borough-quartet.ngrok-free.dev'}/api/crypto/ipn`
                },
                {
                    headers: {
                        'x-api-key': this.nowpaymentsApiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const payment = response.data;
            
            // Validate TRC20 address for USDT
            if (currencyCode === 'USDT' && payment.pay_address && !payment.pay_address.startsWith('T')) {
                console.warn('⚠️ Warning: Received non-TRC20 address for USDT:', payment.pay_address);
            }
            
            // Store deposit record
            const depositId = crypto.randomBytes(16).toString('hex');
            await db.run(
                `INSERT INTO crypto_deposits (
                    id, user_id, order_id, payment_id, fiat_amount, 
                    crypto_currency, crypto_amount, wallet_address, network, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
                [
                    depositId, userId, orderId, payment.payment_id,
                    fiatAmount, currencyCode, cryptoAmount,
                    payment.pay_address,
                    currencyCode === 'USDT' ? 'TRC20' : 'Litecoin'
                ]
            );
            
            return {
                success: true,
                depositId: depositId,
                orderId: orderId,
                paymentId: payment.payment_id,
                fiatAmount: fiatAmount,
                cryptoAmount: cryptoAmount,
                cryptoCurrency: currencyCode,
                walletAddress: payment.pay_address,
                network: currencyCode === 'USDT' ? 'TRC20' : 'Litecoin',
                networkFull: currencyCode === 'USDT' ? 'Tron Network (TRC20)' : 'Litecoin Network',
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${payment.pay_address}`,
                minConfirmations: currencyCode === 'USDT' ? 19 : 6
            };
        } catch (error) {
            console.error('Create deposit error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create deposit');
        }
    }

    // Check deposit status
    async checkDepositStatus(paymentId) {
        try {
            const response = await axios.get(
                `${this.nowpaymentsApiUrl}/payment/${paymentId}`,
                { headers: { 'x-api-key': this.nowpaymentsApiKey } }
            );
            
            return {
                status: response.data.payment_status,
                actuallyPaid: response.data.actually_paid,
                payAmount: response.data.pay_amount
            };
        } catch (error) {
            console.error('Status check error:', error);
            return { status: 'unknown' };
        }
    }

    // Get deposit history for user
    async getUserDeposits(userId, limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM crypto_deposits 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ? OFFSET ?`,
                [userId, limit, offset],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    // Get deposit total stats
    async getUserDepositStats(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as total_deposits,
                    SUM(CASE WHEN status = 'completed' THEN fiat_amount ELSE 0 END) as total_completed,
                    SUM(CASE WHEN status = 'pending' THEN fiat_amount ELSE 0 END) as total_pending,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
                 FROM crypto_deposits 
                 WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total_deposits: 0, total_completed: 0, total_pending: 0 });
                }
            );
        });
    }

    // Add this method to the UnifiedCryptoService class
    async getRates() {
        try {
            const currencies = await this.getAvailableCurrencies();
            const rates = {};
            
            for (const currency of currencies) {
                const rate = await this.getExchangeRate(currency.code);
                rates[currency.code] = {
                    usdRate: rate,
                    kesRate: rate * 130,
                    minAmount: currency.minAmount,
                    name: currency.name,
                    icon: currency.icon,
                    network: currency.network
                };
            }
            
            return { success: true, rates };
        } catch (error) {
            console.error('Error getting rates:', error);
            return { 
                success: true, 
                rates: {
                    USDT: { usdRate: 1, kesRate: 130, name: 'Tether (TRC20)', icon: '💵', minAmount: 10, network: 'TRC20' },
                    LTC: { usdRate: 70, kesRate: 9100, name: 'Litecoin', icon: 'Ł', minAmount: 0.1, network: 'Litecoin' }
                }
            };
        }
    }
}

module.exports = new UnifiedCryptoService();