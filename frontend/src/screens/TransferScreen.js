// src/screens/TransferScreen.js
// COMPLETE VERSION WITH KYC VERIFICATION

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
import { authAPI, accountAPI, kycAPI } from '../services/api';
import KYCGate from '../components/KYCGate';

export default function TransferScreen({ navigation, route }) {
    const [accounts, setAccounts] = useState([]);
    const [fromAccount, setFromAccount] = useState(null);
    const [toAccount, setToAccount] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    
    // KYC state
    const [kycVerified, setKycVerified] = useState(false);
    const [checkingKyc, setCheckingKyc] = useState(true);
    const [showKycGate, setShowKycGate] = useState(false);

    useEffect(() => {
        loadData();
        
        // Handle beneficiary selection from route params
        if (route.params?.selectedBeneficiary) {
            const beneficiary = route.params.selectedBeneficiary;
            setToAccount(beneficiary.accountNumber);
            if (beneficiary.nickname) {
                setDescription(`Transfer to ${beneficiary.nickname}`);
            }
        }
    }, [route.params?.selectedBeneficiary]);

    // Reload KYC status when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            checkKycStatus();
        });
        return unsubscribe;
    }, [navigation]);

    const loadData = async () => {
        try {
            await checkKycStatus();
            
            const accountsData = await authAPI.getAccounts();
            setAccounts(accountsData.accounts || []);
            if (accountsData.accounts?.length > 0) {
                setFromAccount(accountsData.accounts[0]);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const checkKycStatus = async () => {
        try {
            setCheckingKyc(true);
            const status = await kycAPI.getStatus();
            setKycVerified(status.verified === true);
            console.log('KYC Verified:', status.verified);
        } catch (error) {
            console.log('Error checking KYC:', error);
            setKycVerified(false);
        } finally {
            setCheckingKyc(false);
        }
    };

    const quickAmounts = [1000, 5000, 10000, 20000, 50000];

    const handleTransfer = async () => {
        // Check KYC verification first
        if (!kycVerified) {
            setShowKycGate(true);
            return;
        }

        if (!fromAccount || !toAccount || !amount) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const transferAmount = parseFloat(amount);
        if (isNaN(transferAmount) || transferAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (transferAmount > fromAccount.balance) {
            Alert.alert('Error', 'Insufficient funds');
            return;
        }

        Alert.alert(
            'Confirm Transfer',
            `Send KES ${transferAmount.toLocaleString()} from ${fromAccount.account_number} to ${toAccount}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: () => processTransfer(transferAmount),
                },
            ]
        );
    };

    const processTransfer = async (transferAmount) => {
        setLoading(true);
        try {
            const response = await accountAPI.internalTransfer(
                fromAccount.id,           // Use account ID, not account number
                toAccount,                // Destination account number
                transferAmount,           // Amount
                description || 'Transfer' // Description
            );

            if (response.success) {
                Alert.alert(
                    'Success',
                    `Transfer of KES ${transferAmount.toLocaleString()} completed successfully`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                setToAccount('');
                                setAmount('');
                                setDescription('');
                                loadData();
                                navigation.navigate('Dashboard');
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            console.error('Transfer error:', error);
            
            // Check if error is KYC-related
            if (error.response?.data?.kycRequired) {
                setKycVerified(false);
                setShowKycGate(true);
            } else {
                Alert.alert(
                    'Transfer Failed',
                    error.response?.data?.error || 'Failed to complete transfer'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleKycVerify = () => {
        setShowKycGate(false);
        navigation.navigate('KYCVerification');
    };

    const formatCurrency = (amount) => {
        return `KES ${Number(amount || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transfer Money</Text>
                <View style={{ width: 50 }} />
            </View>

            {/* KYC Warning Banner */}
            {!kycVerified && !checkingKyc && (
                <TouchableOpacity 
                    style={styles.kycWarningBanner}
                    onPress={() => setShowKycGate(true)}
                >
                    <Text style={styles.warningIcon}>⚠️</Text>
                    <View style={styles.warningTextContainer}>
                        <Text style={styles.warningTitle}>Verification Required</Text>
                        <Text style={styles.warningText}>
                            Complete KYC to make transfers
                        </Text>
                    </View>
                    <Text style={styles.warningArrow}>→</Text>
                </TouchableOpacity>
            )}

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* From Account */}
                <View style={styles.section}>
                    <Text style={styles.label}>From Account</Text>
                    {fromAccount ? (
                        <View style={styles.accountCard}>
                            <View style={styles.accountInfo}>
                                <Text style={styles.accountType}>
                                    {fromAccount.account_type_name || 'Account'}
                                </Text>
                                <Text style={styles.accountNumber}>
                                    {fromAccount.account_number}
                                </Text>
                            </View>
                            <Text style={styles.accountBalance}>
                                {formatCurrency(fromAccount.balance)}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.noAccount}>No account available</Text>
                    )}
                </View>

                {/* To Account */}
                <View style={styles.section}>
                    <Text style={styles.label}>To Account Number</Text>
                    <TextInput
                        style={[
                            styles.input,
                            !kycVerified && styles.inputDisabled
                        ]}
                        placeholder="Enter account number"
                        placeholderTextColor={colors.textLight}
                        value={toAccount}
                        onChangeText={setToAccount}
                        keyboardType="numeric"
                        maxLength={10}
                        editable={kycVerified}
                    />
                    
                    <TouchableOpacity
                        style={[
                            styles.beneficiariesLink,
                            !kycVerified && styles.buttonDisabled
                        ]}
                        onPress={() => navigation.navigate('Beneficiaries')}
                        disabled={!kycVerified}
                    >
                        <Text style={styles.beneficiariesLinkText}>
                            📖 Choose from Beneficiaries
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Amount */}
                <View style={styles.section}>
                    <Text style={styles.label}>Amount (KES)</Text>
                    <TextInput
                        style={[
                            styles.input,
                            !kycVerified && styles.inputDisabled
                        ]}
                        placeholder="0.00"
                        placeholderTextColor={colors.textLight}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        editable={kycVerified}
                    />

                    {/* Quick Amount Buttons */}
                    <View style={styles.quickAmountsContainer}>
                        {quickAmounts.map((quickAmount) => (
                            <TouchableOpacity
                                key={quickAmount}
                                style={[
                                    styles.quickAmountButton,
                                    !kycVerified && styles.buttonDisabled
                                ]}
                                onPress={() => kycVerified && setAmount(quickAmount.toString())}
                                disabled={!kycVerified}
                            >
                                <Text style={styles.quickAmountText}>
                                    {(quickAmount / 1000).toFixed(0)}K
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={[
                            styles.input,
                            styles.textArea,
                            !kycVerified && styles.inputDisabled
                        ]}
                        placeholder="What's this for?"
                        placeholderTextColor={colors.textLight}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        editable={kycVerified}
                    />
                </View>

                {/* Transfer Button */}
                <TouchableOpacity
                    style={[
                        styles.transferButton,
                        (loading || !kycVerified) && styles.buttonDisabled,
                    ]}
                    onPress={handleTransfer}
                    disabled={loading || !kycVerified}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.transferButtonText}>
                            {kycVerified ? 'Transfer Now' : 'Verify Identity First'}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* KYC Gate Modal */}
            <KYCGate
                visible={showKycGate}
                onClose={() => setShowKycGate(false)}
                onVerify={handleKycVerify}
                feature="transfers"
            />
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
    kycWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '20',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.warning + '40',
    },
    warningIcon: {
        fontSize: 24,
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
        fontSize: 20,
        color: colors.warning,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
    },
    accountCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    accountInfo: {
        marginBottom: 8,
    },
    accountType: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    accountNumber: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    accountBalance: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    noAccount: {
        fontSize: 14,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputDisabled: {
        opacity: 0.5,
        backgroundColor: colors.border,
    },
    textArea: {
        height: 80,
    },
    beneficiariesLink: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    beneficiariesLinkText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    quickAmountsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    quickAmountButton: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickAmountText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    transferButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginVertical: 20,
    },
    transferButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});