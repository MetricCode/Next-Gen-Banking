// backend/services/nowpaymentsService.js
const axios = require('axios');
const crypto = require('crypto');
const { db } = require('../config/db');

class NOWPaymentsService {
    constructor() {
        this.apiKey = process.env.NOWPAYMENTS_API_KEY;
        this.ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
        // NOWPayments has no sandbox — always use production API
        this.baseURL = 'https://api.nowpayments.io/v1';
        
        console.log('💰 NOWPayments Service initialized:', {
            baseURL: this.baseURL
        });
    }

    // Get available cryptocurrencies
    async getAvailableCurrencies() {
        try {
            const response = await axios.get(`${this.baseURL}/currencies`, {
                headers: {
                    'x-api-key': this.apiKey
                }
            });
            
            // Filter to common currencies
            const commonCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX'];
            const currencies = response.data.currencies
                .filter(c => commonCurrencies.includes(c))
                .map(code => ({
                    code,
                    name: this.getCurrencyName(code),
                    icon: this.getCurrencyIcon(code),
                    minAmount: this.getMinAmount(code),
                    confirmations: this.getConfirmations(code)
                }));
            
            return currencies;
        } catch (error) {
            console.error('Error fetching currencies:', error);
            // Return fallback currencies
            return this.getFallbackCurrencies();
        }
    }

    getCurrencyName(code) {
        const names = {
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'USDT': 'Tether (ERC20)',
            'USDC': 'USD Coin',
            'BNB': 'Binance Coin',
            'SOL': 'Solana',
            'XRP': 'Ripple',
            'DOGE': 'Dogecoin',
            'TRX': 'Tron'
        };
        return names[code] || code;
    }

    getCurrencyIcon(code) {
        const icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'USDC': '💵',
            'BNB': '🟡',
            'SOL': '◎',
            'XRP': '✕',
            'DOGE': '🐕',
            'TRX': '🔴'
        };
        return icons[code] || '💰';
    }

    getMinAmount(code) {
        const amounts = {
            'BTC': 0.0001,
            'ETH': 0.01,
            'USDT': 10,
            'USDC': 10,
            'BNB': 0.05,
            'SOL': 0.5,
            'XRP': 10,
            'DOGE': 50,
            'TRX': 100
        };
        return amounts[code] || 10;
    }

    getConfirmations(code) {
        const confirmations = {
            'BTC': 1,
            'ETH': 12,
            'USDT': 12,
            'USDC': 12,
            'BNB': 12,
            'SOL': 1,
            'XRP': 1,
            'DOGE': 10,
            'TRX': 19
        };
        return confirmations[code] || 3;
    }

    getCurrencyRate(code) {
        const rates = {
            'BTC': 60000,    // Approximate KES rate
            'ETH': 3000,
            'USDT': 130,
            'USDC': 130,
            'BNB': 400,
            'SOL': 100,
            'XRP': 0.5,
            'DOGE': 0.15,
            'TRX': 0.02
        };
        return rates[code] || 100;
    }

    // Create a payment
    async createPayment(amount, currencyCode, userId, orderId) {
        try {
            const payload = {
                price_amount: amount,
                price_currency: 'USD',
                pay_currency: currencyCode,
                ipn_callback_url: `${process.env.API_URL || 'http://localhost:5000'}/api/crypto/ipn`,
                order_id: orderId,
                order_description: `Crypto deposit for user ${userId}`
            };

            const response = await axios.post(`${this.baseURL}/payment`, payload, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                paymentId: response.data.payment_id,
                paymentStatus: response.data.payment_status,
                payAddress: response.data.pay_address,
                payCurrency: response.data.pay_currency,
                priceAmount: response.data.price_amount,
                payAmount: response.data.pay_amount,
                qrCode: `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${response.data.pay_address}&choe=UTF-8`,
                expirationTime: response.data.expiration_estimate_date
            };
        } catch (error) {
            console.error('Error creating payment:', error.response?.data || error.message);
            throw new Error('Failed to create payment');
        }
    }

    // Get payment status
    async getPaymentStatus(paymentId) {
        try {
            const response = await axios.get(`${this.baseURL}/payment/${paymentId}`, {
                headers: {
                    'x-api-key': this.apiKey
                }
            });

            return {
                paymentId: response.data.payment_id,
                paymentStatus: response.data.payment_status,
                payAmount: response.data.pay_amount,
                actuallyPaid: response.data.actually_paid,
                payCurrency: response.data.pay_currency,
                createdAt: response.data.created_at,
                updatedAt: response.data.updated_at
            };
        } catch (error) {
            console.error('Error getting payment status:', error);
            throw new Error('Failed to get payment status');
        }
    }

    // Estimate payment amount
    async estimatePayment(amount, currencyFrom, currencyTo = 'USD') {
        try {
            const response = await axios.get(`${this.baseURL}/estimate`, {
                params: {
                    amount: amount,
                    currency_from: currencyFrom,
                    currency_to: currencyTo
                },
                headers: {
                    'x-api-key': this.apiKey
                }
            });

            return {
                estimatedAmount: response.data.estimated_amount,
                currencyFrom: currencyFrom,
                currencyTo: currencyTo
            };
        } catch (error) {
            console.error('Error estimating payment:', error);
            // Return fallback estimate
            const rate = this.getCurrencyRate(currencyFrom);
            return {
                estimatedAmount: amount * rate,
                currencyFrom: currencyFrom,
                currencyTo: currencyTo
            };
        }
    }

    // Verify IPN signature
    verifyIpnSignature(payload, signature) {
        const hmac = crypto.createHmac('sha512', this.ipnSecret);
        const payloadString = JSON.stringify(payload);
        const calculatedSignature = hmac.update(payloadString).digest('hex');
        return calculatedSignature === signature;
    }

    getFallbackCurrencies() {
        return [
            { code: 'BTC', name: 'Bitcoin', icon: '₿', minAmount: 0.0001 },
            { code: 'ETH', name: 'Ethereum', icon: 'Ξ', minAmount: 0.01 },
            { code: 'USDT', name: 'Tether (ERC20)', icon: '💵', minAmount: 10 },
            { code: 'USDC', name: 'USD Coin', icon: '💵', minAmount: 10 },
            { code: 'BNB', name: 'Binance Coin', icon: '🟡', minAmount: 0.05 },
            { code: 'SOL', name: 'Solana', icon: '◎', minAmount: 0.5 },
            { code: 'DOGE', name: 'Dogecoin', icon: '🐕', minAmount: 50 }
        ];
    }
}

module.exports = new NOWPaymentsService();