// src/screens/MPesaScreen.js
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { mpesaAPI } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MPesaScreen({ navigation }) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    const quickAmounts = [500, 1000, 2000, 5000, 10000];

    useEffect(() => {
        loadUserPhone();
    }, []);

    const loadUserPhone = async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user?.phoneNumber) {
                    setPhoneNumber(user.phoneNumber);
                }
            }
        } catch (error) {
            console.error('Error loading user phone:', error);
        }
    };

    const validateInputs = () => {
        if (!phoneNumber || !amount) {
            Alert.alert('Error', 'Please fill in all fields');
            return false;
        }

        const phoneRegex = /^(\+254|254|0)[17]\d{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            Alert.alert('Error', 'Please enter a valid Safaricom phone number (07XX or 01XX)');
            return false;
        }

        const transactionAmount = parseFloat(amount);
        if (isNaN(transactionAmount) || transactionAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return false;
        }

        const minAmount = 1;
        const maxAmount = 150000;

        if (transactionAmount < minAmount) {
            Alert.alert('Error', `Minimum amount is KES ${minAmount}`);
            return false;
        }

        if (transactionAmount > maxAmount) {
            Alert.alert('Error', `Maximum amount is KES ${maxAmount.toLocaleString()}`);
            return false;
        }

        return true;
    };

    const handleDeposit = async () => {
        if (!validateInputs()) return;

        setLoading(true);
        try {
            const response = await mpesaAPI.deposit(phoneNumber, amount);
            
            console.log('✅ Deposit initiated:', response);
            
            // Show success message based on mode
            if (response.isMock) {
                Alert.alert(
                    'Processing Deposit 💰',
                    'Your deposit is being processed. You will receive a confirmation shortly.',
                    [{ text: 'OK', onPress: () => {
                        setPhoneNumber('');
                        setAmount('');
                        navigation.goBack();
                    }}]
                );
            } else if (response.isReal) {
                Alert.alert(
                    'STK Push Sent! 📱',
                    'Please check your phone and enter your M-Pesa PIN to complete the transaction.\n\nYou will receive a confirmation once the transaction is complete.',
                    [{ text: 'OK', onPress: () => {
                        setPhoneNumber('');
                        setAmount('');
                        // Optionally navigate to transaction status screen
                        // navigation.navigate('TransactionStatus', { checkoutId: response.checkoutRequestID });
                    }}]
                );
            } else {
                Alert.alert(
                    'Success! 🎉',
                    response.message || 'STK Push sent successfully! Check your phone.',
                    [{ text: 'OK', onPress: () => {
                        setPhoneNumber('');
                        setAmount('');
                        navigation.goBack();
                    }}]
                );
            }
            
        } catch (error) {
            console.error('❌ Deposit error:', error);
            Alert.alert(
                'Deposit Failed',
                error.response?.data?.error || 'Failed to initiate deposit. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleTransaction = () => {
        handleDeposit();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>M-Pesa</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* M-Pesa Logo */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logo}>📱</Text>
                    <Text style={styles.logoText}>M-PESA</Text>
                    <Text style={styles.logoSubtext}>Instant Deposits</Text>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                        💰 You will receive an STK Push on your phone. Enter your M-Pesa PIN to complete the deposit.
                    </Text>
                </View>

                {/* Phone Number */}
                <View style={styles.section}>
                    <Text style={styles.label}>M-Pesa Phone Number</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="0712345678 or 0112345678"
                        placeholderTextColor={colors.textLight}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        maxLength={10}
                    />
                </View>

                {/* Amount */}
                <View style={styles.section}>
                    <Text style={styles.label}>Amount (KES)</Text>
                    <TextInput
                        style={styles.amountInput}
                        placeholder="0"
                        placeholderTextColor={colors.textLight}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                    />
                    
                    {/* Quick Amounts */}
                    <View style={styles.quickAmounts}>
                        {quickAmounts.map((quickAmount) => (
                            <TouchableOpacity
                                key={quickAmount}
                                style={styles.quickAmountButton}
                                onPress={() => setAmount(quickAmount.toString())}
                            >
                                <Text style={styles.quickAmountText}>
                                    {quickAmount.toLocaleString()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Transaction Limits */}
                <View style={styles.limitsCard}>
                    <Text style={styles.limitsTitle}>Transaction Limits</Text>
                    <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Minimum</Text>
                        <Text style={styles.limitValue}>KES 1</Text>
                    </View>
                    <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Maximum</Text>
                        <Text style={styles.limitValue}>KES 150,000</Text>
                    </View>
                    <View style={styles.limitRow}>
                        <Text style={styles.limitLabel}>Transaction Fee</Text>
                        <Text style={styles.limitValue}>Free</Text>
                    </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleTransaction}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <ActivityIndicator color="#FFFFFF" />
                            <Text style={styles.buttonText}> Processing...</Text>
                        </>
                    ) : (
                        <Text style={styles.buttonText}>Deposit Money</Text>
                    )}
                </TouchableOpacity>

                {/* How it Works */}
                <View style={styles.howItWorks}>
                    <Text style={styles.howItWorksTitle}>How it works:</Text>
                    <Text style={styles.howItWorksStep}>
                        1. Enter your M-Pesa phone number
                    </Text>
                    <Text style={styles.howItWorksStep}>
                        2. Enter the amount you want to deposit
                    </Text>
                    <Text style={styles.howItWorksStep}>
                        3. Click "Deposit Money"
                    </Text>
                    <Text style={styles.howItWorksStep}>
                        4. Enter your M-Pesa PIN when prompted on your phone
                    </Text>
                    <Text style={styles.howItWorksStep}>
                        5. Money reflects in your account instantly
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    logoContainer: {
        alignItems: 'center',
        marginVertical: 32,
    },
    logo: {
        fontSize: 64,
        marginBottom: 8,
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.success,
        letterSpacing: 2,
    },
    logoSubtext: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: colors.primary,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    infoCard: {
        backgroundColor: colors.primary + '10',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    infoText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
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
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.text,
    },
    amountInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'center',
    },
    quickAmounts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        marginHorizontal: -4,
    },
    quickAmountButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        margin: 4,
    },
    quickAmountText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    limitsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    limitsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    limitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    limitLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    limitValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    button: {
        backgroundColor: colors.success,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    howItWorks: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
    },
    howItWorksTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    howItWorksStep: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
});