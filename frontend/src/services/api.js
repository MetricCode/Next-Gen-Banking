// src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ==================== IMPORTANT: CONFIGURE YOUR IP ADDRESS ====================
const YOUR_COMPUTER_IP = '192.168.100.184'; // 🔴 CHANGE THIS TO YOUR IP!

// ==================== API Configuration ====================
const getApiUrl = () => {
    if (__DEV__) {
        if (Platform.OS === 'android') {
            return `http://${YOUR_COMPUTER_IP}:5000/api`;
        } else if (Platform.OS === 'ios') {
            return `http://${YOUR_COMPUTER_IP}:5000/api`;
        } else {
            return `http://${YOUR_COMPUTER_IP}:5000/api`;
        }
    }
    return 'https://your-production-api.com/api';
};

const API_BASE_URL = getApiUrl();
console.log('🌐 API URL:', API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// Add token to requests automatically
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('📤 Request:', config.method.toUpperCase(), config.url);
        if (config.data) console.log('📦 Request data:', config.data);
        return config;
    },
    (error) => {
        console.error('❌ Request error:', error);
        return Promise.reject(error);
    }
);

// Handle response errors
api.interceptors.response.use(
    (response) => {
        console.log('✅ Response:', response.config.url, response.status);
        return response;
    },
    async (error) => {
        const status = error.response?.status;
        const isUserError = status === 400 || status === 401 || status === 404;

        if (isUserError) {
            console.log('⚠️ User error:', error.message);
            if (error.response?.data) {
                console.log('   Details:', error.response.data.error || error.response.data);
            }
        } else {
            console.error('❌ System error:', error.message);
            if (error.response) {
                console.error('   Error details:', error.response.data);
                console.error('   Status code:', error.response.status);
            }
        }

        if (status === 401) {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
        }

        return Promise.reject(error);
    }
);

// ==================== AUTH API ====================
export const authAPI = {
    register: async (userData) => {
        console.log('📝 Registering user:', userData.email);
        const response = await api.post('/auth/register', userData);
        if (response.data.token) {
            await AsyncStorage.setItem('token', response.data.token);
            await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
            console.log('✅ Registration successful, token saved');
        }
        return response.data;
    },

    // FIX: Only ONE login function — the 2FA-aware version
    login: async (credentials) => {
        console.log('🔐 Logging in:', credentials.email);
        try {
            const response = await api.post('/auth/login', credentials);
            console.log('📦 Login response:', response.data);

            // Handle 2FA required
            if (response.data.requiresTwoFactor) {
                return {
                    requiresTwoFactor: true,
                    userId: response.data.userId,
                    message: response.data.message
                };
            }

            if (response.data.token) {
                await AsyncStorage.setItem('token', response.data.token);
                await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
                console.log('✅ Login successful, token saved');
                console.log('📝 User saved:', response.data.user);
            } else {
                console.log('⚠️ No token in response');
            }
            return response.data;
        } catch (error) {
            console.error('❌ Login error:', error.response?.data || error.message);
            throw error;
        }
    },

    logout: async () => {
        console.log('👋 Logging out');
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
    },

    getAccounts: async () => {
        console.log('💳 Fetching accounts');
        const response = await api.get('/auth/accounts');
        return response.data;
    },

    getCurrentUser: async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            console.log('Retrieved user from storage:', userStr);
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    transfer: async (transferData) => {
        console.log('💸 Sending transfer:', transferData);
        const response = await api.post('/transfers', transferData);
        return response.data;
    },

    getBeneficiaries: async () => {
        console.log('📖 Fetching beneficiaries');
        const response = await api.get('/transfers/beneficiaries');
        return response.data;
    },

    addBeneficiary: async (beneficiaryData) => {
        console.log('➕ Adding beneficiary:', beneficiaryData);
        const response = await api.post('/transfers/beneficiaries', beneficiaryData);
        return response.data;
    },

    deleteBeneficiary: async (beneficiaryId) => {
        console.log('🗑️ Deleting beneficiary:', beneficiaryId);
        const response = await api.delete(`/transfers/beneficiaries/${beneficiaryId}`);
        return response.data;
    },

    // 2FA Methods
    enable2FA: async () => {
        const response = await api.post('/auth/enable-2fa');
        return response.data;
    },

    verify2FASetup: async (token) => {
        const response = await api.post('/auth/verify-2fa-setup', { token });
        return response.data;
    },

    disable2FA: async (password, token) => {
        const response = await api.post('/auth/disable-2fa', { password, token });
        return response.data;
    },

    get2FAStatus: async () => {
        const response = await api.get('/auth/2fa-status');
        return response.data;
    },

    verify2FALogin: async (userId, twoFactorCode = null, backupCode = null) => {
        console.log('🔐 Verifying 2FA for login:', {
            userId,
            hasCode: !!twoFactorCode,
            hasBackup: !!backupCode
        });
        const response = await api.post('/auth/verify-2fa-login', {
            userId,
            twoFactorCode,
            backupCode
        });
        if (response.data.token) {
            await AsyncStorage.setItem('token', response.data.token);
            await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
            console.log('✅ 2FA verification successful, token saved');
        }
        return response.data;
    }
};

// ==================== M-PESA API ====================
export const mpesaAPI = {
    deposit: async (phoneNumber, amount) => {
        console.log('💰 Initiating M-Pesa deposit:', { phoneNumber, amount });
        try {
            const response = await api.post('/mpesa/deposit', {
                phoneNumber,
                amount: parseFloat(amount)
            });
            console.log('✅ Deposit response:', response.data);
            return response.data;
        } catch (error) {
            console.error('❌ Deposit error:', error.response?.data || error.message);
            throw error;
        }
    },

    verifyDepositPin: async (checkoutRequestID, pin, amount) => {
        console.log('🔐 Verifying deposit PIN:', { checkoutRequestID, pinLength: pin?.length, amount });
        try {
            const response = await api.post('/mpesa/verify-deposit-pin', {
                checkoutRequestID, pin, amount
            });
            return response.data;
        } catch (error) {
            console.error('❌ PIN verification error:', error.response?.data || error.message);
            throw error;
        }
    },

    withdraw: async (phoneNumber, amount) => {
        console.log('💸 Initiating M-Pesa withdrawal:', { phoneNumber, amount });
        try {
            const response = await api.post('/mpesa/withdraw', {
                phoneNumber,
                amount: parseFloat(amount)
            });
            return response.data;
        } catch (error) {
            console.error('❌ Withdrawal error:', error.response?.data || error.message);
            throw error;
        }
    },

    verifyWithdrawalPin: async (checkoutRequestID, pin, amount) => {
        const response = await api.post('/mpesa/verify-withdrawal-pin', {
            checkoutRequestID, pin, amount
        });
        return response.data;
    },

    checkStatus: async (checkoutRequestID) => {
        const response = await api.get(`/mpesa/status/${checkoutRequestID}`);
        return response.data;
    },

    getHistory: async (limit = 20, offset = 0) => {
        const response = await api.get('/mpesa/history', { params: { limit, offset } });
        return response.data;
    }
};

// ==================== TRANSACTION API ====================
// FIX: Only ONE transactionAPI declaration with all methods merged
export const transactionAPI = {
    // Get transaction history — type: 'all' | 'sent' | 'received'
    getHistory: async (limit = 50, offset = 0, type = 'all') => {
        console.log('📜 Fetching transaction history');
        try {
            const response = await api.get('/transactions/history', {
                params: { limit, offset, type }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Get history error:', error);
            throw error;
        }
    },

    // Get single transaction details
    getDetails: async (transactionId) => {
        console.log('🔍 Fetching transaction details:', transactionId);
        try {
            const response = await api.get(`/transactions/${transactionId}`);
            return response.data;
        } catch (error) {
            console.error('❌ Get details error:', error);
            throw error;
        }
    },

    // Download receipt
    downloadReceipt: async (transactionId) => {
        console.log('📄 Downloading receipt:', transactionId);
        try {
            const response = await api.get(`/transactions/${transactionId}/receipt`, {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error('❌ Download receipt error:', error);
            throw error;
        }
    },

    // Report dispute
    reportDispute: async (transactionId, reason) => {
        console.log('⚠️ Reporting dispute:', { transactionId, reason });
        try {
            const response = await api.post(`/transactions/${transactionId}/dispute`, { reason });
            return response.data;
        } catch (error) {
            console.error('❌ Report dispute error:', error);
            throw error;
        }
    }
};

// ==================== BENEFICIARY API ====================
export const beneficiaryAPI = {
    getAll: async () => {
        const response = await api.get('/transfers/beneficiaries');
        return response.data;
    },
    add: async (beneficiaryData) => {
        const response = await api.post('/transfers/beneficiaries', beneficiaryData);
        return response.data;
    },
    delete: async (beneficiaryId) => {
        const response = await api.delete(`/transfers/beneficiaries/${beneficiaryId}`);
        return response.data;
    },
    update: async (beneficiaryId, beneficiaryData) => {
        const response = await api.put(`/transfers/beneficiaries/${beneficiaryId}`, beneficiaryData);
        return response.data;
    }
};

// ==================== CRYPTO API ====================
export const cryptoAPI = {
    getCurrencies: async () => {
        const response = await api.get('/crypto/currencies');
        return response.data;
    },
    getRates: async () => {
        const response = await api.get('/crypto/rates');
        return response.data;
    },
    estimate: async (fiatAmount, cryptoCurrency) => {
        const response = await api.post('/crypto/estimate', { fiatAmount, cryptoCurrency });
        return response.data;
    },
    createDeposit: async (fiatAmount, currency) => {
        const response = await api.post('/crypto/deposit', { fiatAmount, currency });
        return response.data;
    },
    getDepositStatus: async (depositId) => {
        const response = await api.get(`/crypto/deposit/${depositId}`);
        return response.data;
    },
    getHistory: async (limit = 50, offset = 0) => {
        const response = await api.get('/crypto/history', { params: { limit, offset } });
        return response.data;
    }
};

// ==================== ACCOUNT API ====================
export const accountAPI = {
    getAccounts: async () => {
        const response = await api.get('/transfers/accounts');
        return response.data;
    },
    getAccountTypes: async () => {
        const response = await api.get('/transfers/account-types');
        return response.data;
    },
    createAccount: async (accountType, setAsDefault = false) => {
        const response = await api.post('/transfers/accounts', { accountType, setAsDefault });
        return response.data;
    },
    setDefaultAccount: async (accountId) => {
        const response = await api.put(`/transfers/accounts/${accountId}/default`);
        return response.data;
    },
    internalTransfer: async (fromAccountId, toAccountNumber, amount, description = '') => {
        const response = await api.post('/transfers/internal-transfer', {
            fromAccountId, toAccountNumber, amount, description
        });
        return response.data;
    },
    getTransferHistory: async (limit = 50, offset = 0) => {
        const response = await api.get('/transfers/history', { params: { limit, offset } });
        return response.data;
    },
    getBeneficiaries: async () => {
        const response = await api.get('/transfers/beneficiaries');
        return response.data;
    },
    addBeneficiary: async (accountNumber, nickname = null) => {
        const response = await api.post('/transfers/beneficiaries', { accountNumber, nickname });
        return response.data;
    },
    deleteBeneficiary: async (beneficiaryId) => {
        const response = await api.delete(`/transfers/beneficiaries/${beneficiaryId}`);
        return response.data;
    },
    getBalance: async (accountId) => {
        const response = await api.get(`/transfers/balance/${accountId}`);
        return response.data;
    }
};

// ==================== KYC API ====================
export const kycAPI = {
    submitVerification: async (data) => {
        console.log('📤 Submitting KYC verification...');
        try {
            const response = await api.post('/kyc/verify', {
                firstName: data.firstName,
                lastName: data.lastName,
                idType: data.idType,
                idNumber: data.idNumber,
                idFrontBase64: data.idFrontBase64,
                idBackBase64: data.idBackBase64,
                selfieBase64: data.selfieBase64,
            });
            console.log('✅ KYC submitted successfully');
            return response.data;
        } catch (error) {
            console.error('❌ KYC submission error:', error);
            throw error;
        }
    },
    getStatus: async () => {
        console.log('📊 Checking KYC status...');
        try {
            const response = await api.get('/kyc/status');
            return response.data;
        } catch (error) {
            console.error('❌ KYC status error:', error);
            throw error;
        }
    },
};

// ==================== UTILITY FUNCTIONS ====================
export const formatCurrency = (amount) => {
    const numAmount = Number(amount || 0);
    return `KES ${numAmount.toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

export const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-KE', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
};

export const formatPhoneNumber = (phoneNumber) => {
    let cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
    if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
    return cleaned;
};

export const validateMpesaPhoneNumber = (phoneNumber) => {
    const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');
    const phoneRegex = /^(254|0)[17]\d{8}$/;
    return phoneRegex.test(cleaned);
};

export const getTransactionStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'completed': return '#10B981';
        case 'pending':   return '#F59E0B';
        case 'failed':    return '#EF4444';
        default:          return '#6B7280';
    }
};

export const getTransactionTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
        case 'deposit':    return '💰';
        case 'withdrawal': return '💸';
        case 'sent':       return '📤';
        case 'received':   return '📥';
        case 'transfer':   return '🔄';
        default:           return '💳';
    }
};

export const checkNetworkConnectivity = async () => {
    try {
        const response = await api.get('/health', { timeout: 5000 });
        return response.data.status === 'OK';
    } catch (error) {
        console.error('Network check failed:', error.message);
        return false;
    }
};

export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await requestFn();
        } catch (error) {
            lastError = error;
            console.log(`Retry ${i + 1}/${maxRetries} failed:`, error.message);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }
    throw lastError;
};

export default api;