// src/screens/DashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { authAPI, accountAPI, kycAPI } from '../services/api';
import KYCGate from '../components/KYCGate';

export default function DashboardScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [accountTypes, setAccountTypes] = useState([]);
    
    // KYC state
    const [kycVerified, setKycVerified] = useState(false);
    const [checkingKyc, setCheckingKyc] = useState(true);
    const [showKycGate, setShowKycGate] = useState(false);
    const [kycStatus, setKycStatus] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    // Reload KYC status when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            checkKycStatus();
            loadAccounts();
        });
        return unsubscribe;
    }, [navigation]);

    const loadData = async () => {
        try {
            await checkKycStatus();
            await loadAccounts();
            await loadAccountTypes();
            await loadCurrentUser();
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const checkKycStatus = async () => {
        try {
            setCheckingKyc(true);
            const status = await kycAPI.getStatus();
            setKycVerified(status.verified === true);
            setKycStatus(status);
            console.log('KYC Verified:', status.verified);
        } catch (error) {
            console.log('Error checking KYC:', error);
            setKycVerified(false);
            setKycStatus({ status: 'not_started', verified: false });
        } finally {
            setCheckingKyc(false);
        }
    };

    const loadAccounts = async () => {
        try {
            console.log('Loading accounts...');
            const accountsData = await authAPI.getAccounts();
            console.log('Accounts data:', accountsData);
            setAccounts(accountsData.accounts || []);
            
            // Set default selected account
            const defaultAccount = accountsData.accounts?.find(acc => acc.is_default === 1);
            if (defaultAccount) {
                setSelectedAccount(defaultAccount);
            } else if (accountsData.accounts?.length > 0) {
                setSelectedAccount(accountsData.accounts[0]);
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };

    const loadAccountTypes = async () => {
        try {
            const types = await accountAPI.getAccountTypes();
            setAccountTypes(types.types || []);
        } catch (error) {
            console.error('Error loading account types:', error);
        }
    };

    const loadCurrentUser = async () => {
        try {
            const currentUser = await authAPI.getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.error('Error loading user:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await authAPI.logout();
                        navigation.replace('Login');
                    },
                },
            ]
        );
    };

    const handleCreateAccount = async (accountTypeCode) => {
        // Check KYC verification first
        if (!kycVerified) {
            setShowAccountModal(false);
            setShowKycGate(true);
            return;
        }

        try {
            const result = await accountAPI.createAccount(accountTypeCode, false);
            if (result.success) {
                setShowAccountModal(false);
                Alert.alert(
                    'Success', 
                    `${result.account.account_type_name} created successfully!`,
                    [{ text: 'OK', onPress: () => loadData() }]
                );
            }
        } catch (error) {
            setShowAccountModal(false);
            
            let errorMessage = 'Failed to create account';
            if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            }
            
            // Check if error is KYC-related
            if (error.response?.status === 403 && error.response?.data?.kycRequired) {
                setKycVerified(false);
                setShowKycGate(true);
            } else {
                Alert.alert('Cannot Create Account', errorMessage);
            }
            
            // Only log if it's not a validation error (400)
            if (error.response?.status !== 400) {
                console.error('Error creating account:', error);
            } else {
                console.log('⚠️ Account creation failed (expected):', errorMessage);
            }
        }
    };

    const handleSetDefaultAccount = async (accountId) => {
        if (!kycVerified) {
            setShowKycGate(true);
            return;
        }
        
        try {
            await accountAPI.setDefaultAccount(accountId);
            Alert.alert('Success', 'Default account updated successfully');
            loadData(); // Refresh accounts
        } catch (error) {
            if (error.response?.status === 403 && error.response?.data?.kycRequired) {
                setShowKycGate(true);
            } else {
                Alert.alert('Error', 'Failed to set default account');
            }
        }
    };

    const handleKycVerify = () => {
        setShowKycGate(false);
        navigation.navigate('KYCVerification');
    };

    const formatCurrency = (amount) => {
        const numAmount = Number(amount || 0);
        return `KES ${numAmount.toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const getTotalBalance = () => {
        if (!accounts || accounts.length === 0) return 0;
        return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    };

    const getUserName = () => {
        if (user && user.fullName) {
            const firstName = user.fullName.split(' ')[0];
            return `${firstName} 👋`;
        }
        return 'User 👋';
    };

    const getAccountIcon = (accountType) => {
        switch(accountType?.toUpperCase()) {
            case 'SAVINGS':
                return '🏦';
            case 'CHECKING':
                return '💳';
            case 'CRYPTO':
                return '₿';
            default:
                return '💰';
        }
    };

    const getAccountColor = (accountType) => {
        switch(accountType?.toUpperCase()) {
            case 'SAVINGS':
                return '#10B981';
            case 'CHECKING':
                return '#3B82F6';
            case 'CRYPTO':
                return '#F59E0B';
            default:
                return colors.primary;
        }
    };

    const getKycStatusDisplay = () => {
        if (checkingKyc) {
            return { text: 'Checking...', color: colors.textSecondary, showButton: false };
        }
        
        if (kycVerified) {
            return { text: 'Verified ✓', color: colors.success, showButton: false };
        }
        
        if (kycStatus?.status === 'pending') {
            return { text: 'Pending', color: colors.warning, showButton: true };
        }
        
        if (kycStatus?.status === 'rejected') {
            return { text: 'Failed - Retry', color: colors.error, showButton: true };
        }
        
        return { text: 'Verify Identity', color: colors.warning, showButton: true };
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const kycDisplay = getKycStatusDisplay();

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Hello,</Text>
                        <Text style={styles.userName}>{getUserName()}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        {/* KYC Status Indicator */}
                        {kycDisplay.showButton && (
                            <TouchableOpacity 
                                style={styles.kycStatusButton}
                                onPress={() => navigation.navigate('KYCVerification')}
                            >
                                <Text style={[styles.kycStatusText, { color: kycDisplay.color }]}>
                                    {kycDisplay.text}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {kycVerified && (
                            <View style={styles.kycVerifiedBadge}>
                                <Text style={styles.kycVerifiedText}>✓</Text>
                            </View>
                        )}
                        <TouchableOpacity 
                            style={styles.profileButton} 
                            onPress={() => navigation.navigate('Profile')}
                        >
                            <Text style={styles.profileIcon}>👤</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* KYC Warning Banner (if not verified) */}
                {!kycVerified && !checkingKyc && (
                    <TouchableOpacity 
                        style={styles.kycWarningBanner}
                        onPress={() => setShowKycGate(true)}
                    >
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <View style={styles.warningTextContainer}>
                            <Text style={styles.warningTitle}>Verification Required</Text>
                            <Text style={styles.warningText}>
                                Complete KYC to create accounts and make transfers
                            </Text>
                        </View>
                        <Text style={styles.warningArrow}>→</Text>
                    </TouchableOpacity>
                )}

                {/* Total Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Total Balance</Text>
                    <Text style={styles.balanceAmount}>{formatCurrency(getTotalBalance())}</Text>
                    <View style={styles.balanceFooter}>
                        <View style={styles.balanceInfo}>
                            <Text style={styles.balanceInfoLabel}>Accounts</Text>
                            <Text style={styles.balanceInfoValue}>
                                {accounts ? accounts.length : 0}
                            </Text>
                        </View>
                        <View style={styles.balanceDivider} />
                        <View style={styles.balanceInfo}>
                            <Text style={styles.balanceInfoLabel}>Currency</Text>
                            <Text style={styles.balanceInfoValue}>KES</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity 
                            style={[styles.actionCard, !kycVerified && styles.actionCardDisabled]}
                            onPress={() => {
                                if (!kycVerified) {
                                    setShowKycGate(true);
                                } else {
                                    navigation.navigate('Transfer', { accounts, selectedAccount });
                                }
                            }}
                        >
                            <View style={styles.actionIcon}>
                                <Text style={styles.actionIconText}>💸</Text>
                            </View>
                            <Text style={styles.actionText}>Send Money</Text>
                            {!kycVerified && <Text style={styles.lockIcon}>🔒</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.actionCard, !kycVerified && styles.actionCardDisabled]}
                            onPress={() => {
                                if (!kycVerified) {
                                    setShowKycGate(true);
                                } else {
                                    navigation.navigate('MPesa');
                                }
                            }}
                        >
                            <View style={styles.actionIcon}>
                                <Text style={styles.actionIconText}>📱</Text>
                            </View>
                            <Text style={styles.actionText}>M-Pesa</Text>
                            {!kycVerified && <Text style={styles.lockIcon}>🔒</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.actionCard, !kycVerified && styles.actionCardDisabled]}
                            onPress={() => {
                                if (!kycVerified) {
                                    setShowKycGate(true);
                                } else {
                                    navigation.navigate('CryptoDeposit');
                                }
                            }}
                        >
                            <View style={styles.actionIcon}>
                                <Text style={styles.actionIconText}>₿</Text>
                            </View>
                            <Text style={styles.actionText}>Crypto</Text>
                            {!kycVerified && <Text style={styles.lockIcon}>🔒</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.actionCard, !kycVerified && styles.actionCardDisabled]}
                            onPress={() => {
                                if (!kycVerified) {
                                    setShowKycGate(true);
                                } else {
                                    setShowAccountModal(true);
                                }
                            }}
                        >                        
                            <View style={styles.actionIcon}>
                                <Text style={styles.actionIconText}>➕</Text>
                            </View>
                            <Text style={styles.actionText}>New Account</Text>
                            {!kycVerified && <Text style={styles.lockIcon}>🔒</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.actionCard}
                            onPress={() => navigation.navigate('TransactionHistory')}
                        >
                            <View style={styles.actionIcon}>
                                <Text style={styles.actionIconText}>📊</Text>
                            </View>
                            <Text style={styles.actionText}>History</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Selected Account Card */}
                {selectedAccount && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Selected Account</Text>
                            <TouchableOpacity onPress={() => {/* Navigate to account details */}}>
                                <Text style={styles.seeAllText}>View Details</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity 
                            style={[styles.selectedAccountCard, { borderLeftColor: getAccountColor(selectedAccount.account_type_code) }]}
                            onPress={() => {/* Show account options */}}
                        >
                            <View style={styles.selectedAccountHeader}>
                                <Text style={styles.selectedAccountIcon}>
                                    {getAccountIcon(selectedAccount.account_type_code)}
                                </Text>
                                <View style={styles.selectedAccountInfo}>
                                    <Text style={styles.selectedAccountType}>
                                        {selectedAccount.account_type_name || selectedAccount.account_type_code}
                                    </Text>
                                    <Text style={styles.selectedAccountNumber}>
                                        {selectedAccount.account_number}
                                    </Text>
                                </View>
                                {selectedAccount.is_default === 1 && (
                                    <View style={styles.defaultBadge}>
                                        <Text style={styles.defaultBadgeText}>Default</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.selectedAccountBalance}>
                                {formatCurrency(selectedAccount.balance)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* All Accounts */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>All Accounts</Text>
                    {!accounts || accounts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No accounts found</Text>
                            <TouchableOpacity 
                                style={[styles.createAccountButton, !kycVerified && styles.buttonDisabled]}
                                onPress={() => {
                                    if (!kycVerified) {
                                        setShowKycGate(true);
                                    } else {
                                        setShowAccountModal(true);
                                    }
                                }}
                                disabled={!kycVerified}
                            >
                                <Text style={styles.createAccountText}>
                                    {kycVerified ? 'Create your first account' : 'Verify Identity First'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        accounts.map((account, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[
                                    styles.accountCard,
                                    selectedAccount?.id === account.id && styles.selectedAccountCardHighlight
                                ]}
                                onPress={() => setSelectedAccount(account)}
                                onLongPress={() => {
                                    if (account.is_default !== 1 && kycVerified) {
                                        Alert.alert(
                                            'Set as Default',
                                            `Make ${account.account_type_name} your default account?`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Yes', onPress: () => handleSetDefaultAccount(account.id) }
                                            ]
                                        );
                                    } else if (account.is_default !== 1 && !kycVerified) {
                                        setShowKycGate(true);
                                    }
                                }}
                            >
                                <View style={styles.accountHeader}>
                                    <View style={styles.accountTitleContainer}>
                                        <Text style={styles.accountIcon}>
                                            {getAccountIcon(account.account_type_code)}
                                        </Text>
                                        <View>
                                            <Text style={styles.accountType}>
                                                {account.account_type_name || account.account_type_code}
                                            </Text>
                                            <Text style={styles.accountNumber}>
                                                {account.account_number}
                                            </Text>
                                        </View>
                                    </View>
                                    {account.is_default === 1 && (
                                        <View style={styles.defaultBadge}>
                                            <Text style={styles.defaultText}>Default</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.accountBalance}>
                                    {formatCurrency(account.balance || 0)}
                                </Text>
                                {account.account_type_code === 'CRYPTO' && (
                                    <View style={styles.cryptoHintContainer}>
                                        <Text style={styles.cryptoHint}>
                                            💎 Crypto wallet ready
                                        </Text>
                                    </View>
                                )}
                                {account.interest_rate > 0 && (
                                    <Text style={styles.interestRate}>
                                        Interest: {account.interest_rate}% p.a.
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Recent Transactions Preview */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No transactions yet</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Your transactions will appear here
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Create Account Modal */}
            <Modal
                visible={showAccountModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAccountModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create New Account</Text>
                        <Text style={styles.modalSubtitle}>Choose account type</Text>
                        
                        {accountTypes.map((type) => (
                            <TouchableOpacity
                                key={type.code}
                                style={styles.accountTypeOption}
                                onPress={() => handleCreateAccount(type.code)}
                            >
                                <View style={styles.accountTypeIcon}>
                                    <Text style={styles.accountTypeIconText}>
                                        {type.code === 'SAVINGS' ? '🏦' : 
                                         type.code === 'CHECKING' ? '💳' : '₿'}
                                    </Text>
                                </View>
                                <View style={styles.accountTypeInfo}>
                                    <Text style={styles.accountTypeName}>{type.name}</Text>
                                    <Text style={styles.accountTypeDescription}>
                                        {type.description}
                                    </Text>
                                    {type.min_balance > 0 && (
                                        <Text style={styles.accountTypeDetail}>
                                            Min Balance: {formatCurrency(type.min_balance)}
                                        </Text>
                                    )}
                                    {type.interest_rate > 0 && (
                                        <Text style={styles.accountTypeDetail}>
                                            Interest: {type.interest_rate}% p.a.
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                        
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowAccountModal(false)}
                        >
                            <Text style={styles.modalCloseText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* KYC Gate Modal */}
            <KYCGate
                visible={showKycGate}
                onClose={() => setShowKycGate(false)}
                onVerify={handleKycVerify}
                feature="using banking features"
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
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    greeting: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    kycStatusButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    kycStatusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    kycVerifiedBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kycVerifiedText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileIcon: {
        fontSize: 20,
    },
    logoutButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    logoutText: {
        color: colors.error,
        fontWeight: '600',
    },
    kycWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '20',
        marginHorizontal: 24,
        marginBottom: 20,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.warning + '40',
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
    balanceCard: {
        backgroundColor: colors.primary,
        marginHorizontal: 24,
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    balanceLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
        marginBottom: 8,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    balanceFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    balanceInfo: {
        flex: 1,
    },
    balanceInfoLabel: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        marginBottom: 4,
    },
    balanceInfoValue: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    balanceDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        marginHorizontal: 16,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    seeAllText: {
        color: colors.primary,
        fontWeight: '600',
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    actionCard: {
        width: '25%',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 16,
        position: 'relative',
    },
    actionCardDisabled: {
        opacity: 0.5,
    },
    actionIcon: {
        width: 60,
        height: 60,
        borderRadius: 15,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    actionIconText: {
        fontSize: 28,
    },
    actionText: {
        fontSize: 12,
        color: colors.text,
        textAlign: 'center',
    },
    lockIcon: {
        fontSize: 10,
        position: 'absolute',
        top: 2,
        right: 12,
        color: colors.warning,
    },
    selectedAccountCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderLeftWidth: 6,
        borderColor: colors.border,
    },
    selectedAccountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    selectedAccountIcon: {
        fontSize: 32,
        marginRight: 12,
    },
    selectedAccountInfo: {
        flex: 1,
    },
    selectedAccountType: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
    },
    selectedAccountNumber: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    selectedAccountBalance: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
    },
    selectedAccountCardHighlight: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    accountCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    accountHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    accountTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    accountIcon: {
        fontSize: 24,
        marginRight: 12,
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
        marginBottom: 8,
    },
    defaultBadge: {
        backgroundColor: colors.success + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    defaultText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.success,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.success,
    },
    cryptoHintContainer: {
        marginTop: 8,
    },
    cryptoHint: {
        fontSize: 12,
        color: colors.textLight,
        fontStyle: 'italic',
    },
    interestRate: {
        fontSize: 12,
        color: colors.primary,
        marginTop: 4,
    },
    emptyState: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyStateText: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: colors.textLight,
        marginTop: 4,
    },
    createAccountButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    createAccountText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.5,
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
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    accountTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: colors.background,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    accountTypeIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    accountTypeIconText: {
        fontSize: 24,
    },
    accountTypeInfo: {
        flex: 1,
    },
    accountTypeName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 2,
    },
    accountTypeDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    accountTypeDetail: {
        fontSize: 11,
        color: colors.primary,
    },
    modalCloseButton: {
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingVertical: 16,
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
});