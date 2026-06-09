// src/screens/CryptoDepositScreen.js (FIXED - with currency selection modal)
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    Modal,
    Image,
    Clipboard,
    Share,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { cryptoAPI, kycAPI } from '../services/api';
import KYCGate from '../components/KYCGate';

const SUPPORTED_CURRENCIES = [
    {
        code: 'USDT',
        name: 'Tether (TRC20)',
        icon: '💵',
        minAmount: 10,
        network: 'TRC20',
        networkFull: 'Tron Network (TRC20)',
        addressPrefix: 'T',
        confirmations: 19,
    },
    {
        code: 'LTC',
        name: 'Litecoin',
        icon: 'Ł',
        minAmount: 0.1,
        network: 'Litecoin',
        networkFull: 'Litecoin Network',
        addressPrefix: 'L',
        confirmations: 6,
    },
];

export default function CryptoDepositScreen({ navigation }) {
    const [currencies, setCurrencies] = useState(SUPPORTED_CURRENCIES);
    const [selectedCurrency, setSelectedCurrency] = useState(SUPPORTED_CURRENCIES[0]);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [exchangeRates, setExchangeRates] = useState({});
    const [estimatedCrypto, setEstimatedCrypto] = useState(null);
    const [activeDeposit, setActiveDeposit] = useState(null);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showCurrencyModal, setShowCurrencyModal] = useState(false); // ADD THIS BACK
    
    // KYC state
    const [kycVerified, setKycVerified] = useState(false);
    const [checkingKyc, setCheckingKyc] = useState(true);
    const [showKycGate, setShowKycGate] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await checkKycStatus();
            await Promise.all([
                loadCurrencies(),
                loadExchangeRates()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkKycStatus = async () => {
        try {
            setCheckingKyc(true);
            const status = await kycAPI.getStatus();
            setKycVerified(status.verified === true);
        } catch (error) {
            console.log('Error checking KYC:', error);
            setKycVerified(false);
        } finally {
            setCheckingKyc(false);
        }
    };

    const loadCurrencies = async () => {
        try {
            const response = await cryptoAPI.getCurrencies();
            if (response.success && response.currencies?.length > 0) {
                setCurrencies(response.currencies);
                setSelectedCurrency(response.currencies[0]);
            }
        } catch (error) {
            console.log('Could not fetch currencies from API, using defaults:', error.message);
            // Keep using SUPPORTED_CURRENCIES
        }
    };

    const loadExchangeRates = async () => {
        try {
            const response = await cryptoAPI.getRates();
            if (response.success) {
                setExchangeRates(response.rates);
            }
        } catch (error) {
            console.error('Error loading rates:', error);
            // Fallback rates
            setExchangeRates({
                USDT: { usdRate: 1, kesRate: 130, name: 'Tether (TRC20)', icon: '💵', minAmount: 10 },
                LTC: { usdRate: 70, kesRate: 9100, name: 'Litecoin', icon: 'Ł', minAmount: 0.1 }
            });
        }
    };

    const handleAmountChange = async (value) => {
        setAmount(value);
        
        if (value && selectedCurrency && parseFloat(value) >= selectedCurrency.minAmount) {
            try {
                const response = await cryptoAPI.estimate(
                    parseFloat(value),
                    selectedCurrency.code
                );
                if (response.success) {
                    setEstimatedCrypto(response.estimate.estimatedAmount);
                }
            } catch (error) {
                console.error('Estimate error:', error);
                // Fallback: multiply USD amount by cryptoPerUsd rate
                // e.g. $100 * 0.0143 = 1.43 LTC
                const rate = exchangeRates[selectedCurrency.code];
                const cryptoPerUsd = rate?.cryptoPerUsd ?? (selectedCurrency.code === 'LTC' ? 0.0143 : 1);
                setEstimatedCrypto(parseFloat(value) * cryptoPerUsd);
            }
        } else {
            setEstimatedCrypto(null);
        }
    };

    const handleSelectCurrency = (currency) => {
        setSelectedCurrency(currency);
        setShowCurrencyModal(false);
        if (amount) {
            handleAmountChange(amount);
        }
    };

    const handleDeposit = async () => {
        if (!kycVerified) {
            setShowKycGate(true);
            return;
        }

        const depositAmount = parseFloat(amount);
        
        if (!selectedCurrency) {
            Alert.alert('Error', 'Please select a cryptocurrency');
            return;
        }
        
        if (!amount || isNaN(depositAmount) || depositAmount < selectedCurrency.minAmount) {
            Alert.alert('Error', `Minimum deposit is $${selectedCurrency.minAmount} USD for ${selectedCurrency.name}`);
            return;
        }
        
        if (depositAmount > 10000) {
            Alert.alert('Error', 'Maximum deposit is $10,000 USD');
            return;
        }

        // Special warning for USDT TRC20
        if (selectedCurrency.code === 'USDT') {
            Alert.alert(
                '⚠️ Important: USDT (TRC20)',
                `You are about to deposit USDT on the TRC20 network.\n\n` +
                `⚠️ IMPORTANT NOTES:\n` +
                `• Send ONLY USDT on TRC20 network\n` +
                `• Send ONLY to the provided TRC20 address\n` +
                `• Minimum: $${selectedCurrency.minAmount} USDT\n` +
                `• Requires 19 confirmations\n\n` +
                `Sending other cryptocurrencies or using wrong network will result in permanent loss of funds.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'I Understand, Continue', onPress: processDeposit }
                ]
            );
        } else {
            Alert.alert(
                'Confirm Crypto Deposit',
                `Deposit $${depositAmount.toLocaleString()} USD using ${selectedCurrency.name}\n\n` +
                `You will receive approximately ${estimatedCrypto?.toFixed(selectedCurrency.code === 'LTC' ? 8 : 2)} ${selectedCurrency.code}\n\n` +
                `Network: ${selectedCurrency.networkFull}\n` +
                `Minimum Confirmations: ${selectedCurrency.code === 'USDT' ? 19 : 6}`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Confirm', onPress: processDeposit }
                ]
            );
        }
    };

    const processDeposit = async () => {
        setCreating(true);
        try {
            const response = await cryptoAPI.createDeposit(
                parseFloat(amount),
                selectedCurrency.code
            );
            
            if (response.success) {
                setActiveDeposit(response.deposit);
                setShowDepositModal(true);
            }
        } catch (error) {
            Alert.alert(
                'Deposit Failed',
                error.response?.data?.error || 'Failed to create deposit. Please try again.'
            );
        } finally {
            setCreating(false);
        }
    };

    const copyToClipboard = (text, label) => {
        Clipboard.setString(text);
        Alert.alert('Copied!', `${label} copied to clipboard`);
    };

    const shareAddress = async () => {
        try {
            await Share.share({
                message: `${activeDeposit?.cryptoCurrency} Deposit Address\n\n` +
                    `Network: ${activeDeposit?.networkFull}\n` +
                    `Address: ${activeDeposit?.walletAddress}\n\n` +
                    `Amount: ${activeDeposit?.cryptoAmount} ${activeDeposit?.cryptoCurrency}\n` +
                    `Value: $${activeDeposit?.fiatAmount} USD\n\n` +
                    `Order ID: ${activeDeposit?.orderId}`
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share address');
        }
    };

    const openExplorer = () => {
        let url;
        if (activeDeposit?.cryptoCurrency === 'USDT') {
            url = `https://tronscan.org/#/address/${activeDeposit?.walletAddress}`;
        } else {
            url = `https://litecoinspace.org/address/${activeDeposit?.walletAddress}`;
        }
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Cannot open blockchain explorer');
        });
    };

    const handleKycVerify = () => {
        setShowKycGate(false);
        navigation.navigate('KYCVerification');
    };

    const formatFiat = (amount) => {
        return `$${Number(amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };

    const formatCrypto = (amount, currency) => {
        const decimals = currency === 'LTC' ? 8 : 2;
        return `${Number(amount || 0).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })} ${currency}`;
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Crypto Deposit</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CryptoHistory')}>
                    <Text style={styles.historyButton}>History</Text>
                </TouchableOpacity>
            </View>

            {/* KYC Warning */}
            {!kycVerified && !checkingKyc && (
                <TouchableOpacity 
                    style={styles.kycWarningBanner}
                    onPress={() => setShowKycGate(true)}
                >
                    <Text style={styles.warningIcon}>⚠️</Text>
                    <View style={styles.warningTextContainer}>
                        <Text style={styles.warningTitle}>Verification Required</Text>
                        <Text style={styles.warningText}>
                            Complete KYC to deposit crypto
                        </Text>
                    </View>
                    <Text style={styles.warningArrow}>→</Text>
                </TouchableOpacity>
            )}

            <ScrollView style={styles.content}>
                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoIcon}>💰</Text>
                    <Text style={styles.infoTitle}>Deposit with Crypto</Text>
                    <Text style={styles.infoText}>
                        Deposit using USDT (TRC20) or Litecoin (LTC). Funds will be credited to your crypto wallet.
                    </Text>
                </View>

                {/* Amount Input */}
                <View style={styles.section}>
                    <Text style={styles.label}>Amount (USD)</Text>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0.00"
                        placeholderTextColor={colors.textLight}
                        value={amount}
                        onChangeText={handleAmountChange}
                        keyboardType="decimal-pad"
                        editable={kycVerified}
                    />
                    
                    <View style={styles.quickAmounts}>
                        {[50, 100, 500, 1000, 5000].map((quickAmount) => (
                            <TouchableOpacity
                                key={quickAmount}
                                style={[styles.quickAmountButton, !kycVerified && styles.buttonDisabled]}
                                onPress={() => kycVerified && handleAmountChange(quickAmount.toString())}
                                disabled={!kycVerified}
                            >
                                <Text style={styles.quickAmountText}>${quickAmount}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Currency Selection - Tap to open modal */}
                <View style={styles.section}>
                    <Text style={styles.label}>Select Cryptocurrency</Text>
                    <TouchableOpacity
                        style={[styles.currencySelector, !kycVerified && styles.buttonDisabled]}
                        onPress={() => kycVerified && setShowCurrencyModal(true)}
                        disabled={!kycVerified}
                    >
                        {selectedCurrency && (
                            <>
                                <Text style={styles.currencySelectorIcon}>{selectedCurrency.icon}</Text>
                                <View style={styles.currencySelectorInfo}>
                                    <Text style={styles.currencySelectorName}>{selectedCurrency.name}</Text>
                                    <Text style={styles.currencySelectorNetwork}>{selectedCurrency.networkFull}</Text>
                                </View>
                                <Text style={styles.currencySelectorChevron}>▼</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Estimated Output */}
                {estimatedCrypto && selectedCurrency && (
                    <View style={styles.estimateCard}>
                        <Text style={styles.estimateLabel}>You'll receive approximately</Text>
                        <Text style={styles.estimateAmount}>
                            {formatCrypto(estimatedCrypto, selectedCurrency.code)}
                        </Text>
                        <Text style={styles.estimateRate}>
                            1 {selectedCurrency.code} ≈ ${exchangeRates[selectedCurrency.code]?.usdRate?.toLocaleString() || '?'} USD
                        </Text>
                        <Text style={styles.estimateNetwork}>
                            Network: {selectedCurrency.networkFull}
                        </Text>
                    </View>
                )}

                {/* Deposit Button */}
                <TouchableOpacity
                    style={[
                        styles.depositButton,
                        (!kycVerified || !amount || creating) && styles.buttonDisabled
                    ]}
                    onPress={handleDeposit}
                    disabled={!kycVerified || !amount || creating}
                >
                    {creating ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.depositButtonText}>
                            {kycVerified ? 'Deposit Crypto' : 'Verify Identity First'}
                        </Text>
                    )}
                </TouchableOpacity>

                {/* Important Notes */}
                <View style={styles.notesCard}>
                    <Text style={styles.notesTitle}>⚠️ Important Notes</Text>
                    <Text style={styles.noteItem}>• Send ONLY {selectedCurrency?.code} to the provided address</Text>
                    <Text style={styles.noteItem}>• Use correct network: {selectedCurrency?.networkFull}</Text>
                    {selectedCurrency?.code === 'USDT' && (
                        <Text style={styles.noteItem}>• USDT deposits require 19 confirmations</Text>
                    )}
                    {selectedCurrency?.code === 'LTC' && (
                        <Text style={styles.noteItem}>• LTC deposits require 6 confirmations</Text>
                    )}
                    <Text style={styles.noteItem}>• Sending wrong currency = permanent loss</Text>
                </View>
            </ScrollView>

            {/* Currency Selection Modal - ADD THIS BACK */}
            <Modal
                visible={showCurrencyModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCurrencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Cryptocurrency</Text>
                        {currencies.map((currency) => (
                            <TouchableOpacity
                                key={currency.code}
                                style={styles.currencyOption}
                                onPress={() => handleSelectCurrency(currency)}
                            >
                                <Text style={styles.currencyOptionIcon}>{currency.icon}</Text>
                                <View style={styles.currencyOptionInfo}>
                                    <Text style={styles.currencyOptionName}>{currency.name}</Text>
                                    <Text style={styles.currencyOptionNetwork}>{currency.networkFull}</Text>
                                </View>
                                {selectedCurrency?.code === currency.code && (
                                    <Text style={styles.checkmark}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowCurrencyModal(false)}
                        >
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Deposit Info Modal */}
            <Modal
                visible={showDepositModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDepositModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.depositModalContent}>
                        <Text style={styles.depositModalTitle}>Send {activeDeposit?.cryptoCurrency}</Text>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >

                        <View style={styles.qrContainer}>
                            <Image 
                                source={{ uri: activeDeposit?.qrCode }} 
                                style={styles.qrImage}
                            />
                        </View>

                        <View style={styles.networkWarning}>
                            <Text style={styles.networkWarningIcon}>⚠️</Text>
                            <Text style={styles.networkWarningText}>
                                Send ONLY on {activeDeposit?.networkFull}
                            </Text>
                        </View>

                        <View style={styles.addressContainer}>
                            <Text style={styles.addressLabel}>Wallet Address</Text>
                            <View style={styles.addressRow}>
                                <Text style={styles.addressText} numberOfLines={1}>
                                    {activeDeposit?.walletAddress}
                                </Text>
                                <TouchableOpacity 
                                    onPress={() => copyToClipboard(activeDeposit?.walletAddress, 'Address')}
                                >
                                    <Text style={styles.copyButton}>Copy</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.depositDetails}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Amount to send:</Text>
                                <Text style={styles.detailValue}>
                                    {formatCrypto(activeDeposit?.cryptoAmount, activeDeposit?.cryptoCurrency)}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Network:</Text>
                                <Text style={styles.detailValueNetwork}>
                                    {activeDeposit?.networkFull}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Value (USD):</Text>
                                <Text style={styles.detailValue}>
                                    {formatFiat(activeDeposit?.fiatAmount)}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Min Confirmations:</Text>
                                <Text style={styles.detailValue}>
                                    {activeDeposit?.minConfirmations}
                                </Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Order ID:</Text>
                                <Text style={styles.detailValueCode}>{activeDeposit?.orderId}</Text>
                            </View>
                        </View>

                        <View style={styles.warningBox}>
                            <Text style={styles.warningBoxIcon}>⚠️</Text>
                            <Text style={styles.warningBoxText}>
                                Send only {activeDeposit?.cryptoCurrency} on the {activeDeposit?.networkFull}. 
                                Sending other cryptocurrencies or using wrong network will result in permanent loss of funds.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.explorerButton}
                            onPress={openExplorer}
                        >
                            <Text style={styles.explorerButtonText}>View on Blockchain Explorer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.shareButton}
                            onPress={shareAddress}
                        >
                            <Text style={styles.shareButtonText}>Share Address</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.viewHistoryButton}
                            onPress={() => {
                                setShowDepositModal(false);
                                setActiveDeposit(null);
                                setAmount('');
                                setEstimatedCrypto(null);
                                navigation.navigate('CryptoHistory');
                            }}
                        >
                            <Text style={styles.viewHistoryButtonText}>📋 View Deposit History</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => {
                                setShowDepositModal(false);
                                setActiveDeposit(null);
                                setAmount('');
                                setEstimatedCrypto(null);
                            }}
                        >
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>

                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* KYC Gate */}
            <KYCGate
                visible={showKycGate}
                onClose={() => setShowKycGate(false)}
                onVerify={handleKycVerify}
                feature="crypto deposits"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    historyButton: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    kycWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '20',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.warning + '40',
    },
    warningIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    warningTextContainer: {
        flex: 1,
    },
    warningTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    warningText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    warningArrow: {
        fontSize: 18,
        color: colors.warning,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    infoCard: {
        backgroundColor: colors.primary + '10',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        alignItems: 'center',
    },
    infoIcon: {
        fontSize: 40,
        marginBottom: 8,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    amountInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickAmounts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    quickAmountButton: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickAmountText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    currencySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    currencySelectorIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    currencySelectorInfo: {
        flex: 1,
    },
    currencySelectorName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    currencySelectorNetwork: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    currencySelectorChevron: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    estimateCard: {
        backgroundColor: colors.success + '10',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.success + '30',
    },
    estimateLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    estimateAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.success,
        marginBottom: 4,
    },
    estimateRate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    estimateNetwork: {
        fontSize: 12,
        color: colors.primary,
        marginTop: 4,
    },
    depositButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    depositButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    notesCard: {
        backgroundColor: colors.warning + '10',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.warning + '30',
    },
    notesTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    noteItem: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    currencyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    currencyOptionIcon: {
        fontSize: 28,
        marginRight: 12,
    },
    currencyOptionInfo: {
        flex: 1,
    },
    currencyOptionName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    currencyOptionNetwork: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    checkmark: {
        fontSize: 20,
        color: colors.success,
    },
    modalCloseButton: {
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalCloseText: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    depositModalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '90%',
    },
    depositModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    qrImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
    },
    networkWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.error + '10',
        borderRadius: 8,
        padding: 8,
        marginBottom: 16,
    },
    networkWarningIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    networkWarningText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.error,
    },
    addressContainer: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    addressLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addressText: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        fontFamily: 'monospace',
        marginRight: 12,
    },
    copyButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    depositDetails: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    detailValueNetwork: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    detailValueCode: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.primary,
        fontFamily: 'monospace',
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: colors.error + '10',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    warningBoxIcon: {
        fontSize: 18,
        marginRight: 10,
        marginTop: 1,
    },
    warningBoxText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    explorerButton: {
        backgroundColor: colors.info + '20',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    explorerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.info,
    },
    shareButton: {
        backgroundColor: colors.secondary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    viewHistoryButton: {
        backgroundColor: colors.primary + '15',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.primary + '40',
    },
    viewHistoryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.primary,
    },
});