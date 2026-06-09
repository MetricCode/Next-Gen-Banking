// src/screens/ProfileScreen.js
// UPDATED WITH KYC VERIFICATION CARD

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { authAPI, accountAPI, kycAPI } from '../services/api';

export default function ProfileScreen({ navigation }) {
    const [user, setUser] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [checking2FA, setChecking2FA] = useState(false);
    
    // KYC Status
    const [kycStatus, setKycStatus] = useState(null);
    const [loadingKyc, setLoadingKyc] = useState(true);

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        idNumber: '',
    });

    useEffect(() => {
        loadProfile();
        check2FAStatus();
        loadKycStatus();
    }, []);

    // Add listener to refresh when returning to this screen
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            check2FAStatus();
            loadKycStatus();
        });
        return unsubscribe;
    }, [navigation]);

    const loadProfile = async () => {
        try {
            console.log('Loading profile...');
            const currentUser = await authAPI.getCurrentUser();
            console.log('Current user:', currentUser);
            
            if (currentUser) {
                setUser(currentUser);
                setFormData({
                    fullName: currentUser.fullName || '',
                    email: currentUser.email || '',
                    phoneNumber: currentUser.phoneNumber || '',
                    idNumber: currentUser.idNumber || '',
                });
            }

            const accountsData = await accountAPI.getAccounts();
            setAccounts(accountsData.accounts || []);
        } catch (error) {
            console.error('Error loading profile:', error);
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const check2FAStatus = async () => {
        try {
            setChecking2FA(true);
            const response = await authAPI.get2FAStatus();
            console.log('2FA Status:', response);
            setTwoFactorEnabled(response.enabled || false);
        } catch (error) {
            console.log('Error checking 2FA status:', error);
            setTwoFactorEnabled(false);
        } finally {
            setChecking2FA(false);
        }
    };

    // Load KYC status
    const loadKycStatus = async () => {
        try {
            setLoadingKyc(true);
            const status = await kycAPI.getStatus();
            console.log('KYC Status:', status);
            setKycStatus(status);
        } catch (error) {
            console.log('Error loading KYC status:', error);
            setKycStatus({ status: 'not_started', verified: false });
        } finally {
            setLoadingKyc(false);
        }
    };

    const handle2FAToggle = () => {
        if (twoFactorEnabled) {
            // Disable 2FA
            Alert.alert(
                'Disable Two-Factor Authentication',
                'Are you sure you want to disable 2FA? This will make your account less secure.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: () => navigation.navigate('TwoFactorSetup', { 
                            mode: 'disable' 
                        })
                    }
                ]
            );
        } else {
            // Enable 2FA
            navigation.navigate('TwoFactorSetup', { mode: 'enable' });
        }
    };

    // Handle KYC button press
    const handleKycPress = () => {
        if (kycStatus?.status === 'not_started' || kycStatus?.status === 'rejected') {
            navigation.navigate('KYCVerification');
        } else {
            navigation.navigate('KYCStatus');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadProfile();
        check2FAStatus();
        loadKycStatus();
    };

    const handleSave = async () => {
        // Validation
        if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.idNumber) {
            Alert.alert('Error', 'All fields are required');
            return;
        }

        if (formData.phoneNumber.length !== 10) {
            Alert.alert('Error', 'Phone number must be 10 digits');
            return;
        }

        setSaving(true);
        try {
            const updatedUser = {
                ...user,
                ...formData
            };
            
            await authAPI.updateProfile?.(formData) || Promise.resolve();
            setUser(updatedUser);
            setEditMode(false);
            
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            fullName: user.fullName || '',
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
            idNumber: user.idNumber || '',
        });
        setEditMode(false);
    };

    const handleLogout = () => {
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

    const formatCurrency = (amount) => {
        return `KES ${Number(amount || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const getAccountIcon = (accountType) => {
        switch (accountType?.toUpperCase()) {
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

    const getTotalBalance = () => {
        return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    };

    // Get KYC status info
    const getKycStatusInfo = () => {
        if (loadingKyc) {
            return {
                icon: '⏳',
                title: 'Checking status...',
                subtitle: '',
                color: colors.textSecondary,
                buttonText: '',
                showButton: false,
            };
        }

        switch (kycStatus?.status) {
            case 'verified':
                return {
                    icon: '✅',
                    title: 'Identity Verified',
                    subtitle: 'Your account is fully verified',
                    color: colors.success,
                    buttonText: 'View Details',
                    showButton: true,
                };
            case 'pending':
                return {
                    icon: '⏳',
                    title: 'Verification Pending',
                    subtitle: 'We are reviewing your documents',
                    color: colors.warning,
                    buttonText: 'Check Status',
                    showButton: true,
                };
            case 'review':
                return {
                    icon: '🔍',
                    title: 'Under Review',
                    subtitle: 'Manual review in progress',
                    color: colors.warning,
                    buttonText: 'Check Status',
                    showButton: true,
                };
            case 'rejected':
                return {
                    icon: '❌',
                    title: 'Verification Failed',
                    subtitle: 'Please try again with clear photos',
                    color: colors.error,
                    buttonText: 'Try Again',
                    showButton: true,
                };
            case 'not_started':
            default:
                return {
                    icon: '📋',
                    title: 'Verify Your Identity',
                    subtitle: 'Complete KYC to unlock all features',
                    color: colors.primary,
                    buttonText: 'Start Verification',
                    showButton: true,
                };
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const kycInfo = getKycStatusInfo();

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                {!editMode ? (
                    <TouchableOpacity onPress={() => setEditMode(true)}>
                        <Text style={styles.editButton}>Edit</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 50 }} />
                )}
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    {!editMode && (
                        <Text style={styles.name}>{user?.fullName}</Text>
                    )}
                </View>

                {/* Total Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Total Balance</Text>
                    <Text style={styles.balanceAmount}>{formatCurrency(getTotalBalance())}</Text>
                    <Text style={styles.balanceSubtext}>Across {accounts.length} accounts</Text>
                </View>

                {/* KYC VERIFICATION CARD - NEW */}
                {!editMode && (
                    <TouchableOpacity
                        style={[
                            styles.kycCard,
                            kycStatus?.status === 'verified' && styles.kycCardVerified,
                            kycStatus?.status === 'rejected' && styles.kycCardRejected,
                        ]}
                        onPress={handleKycPress}
                        disabled={loadingKyc}
                    >
                        <View style={styles.kycLeft}>
                            <View style={[
                                styles.kycIconContainer,
                                kycStatus?.status === 'verified' && styles.kycIconVerified,
                                kycStatus?.status === 'rejected' && styles.kycIconRejected,
                            ]}>
                                <Text style={styles.kycIcon}>{kycInfo.icon}</Text>
                            </View>
                            <View style={styles.kycInfo}>
                                <Text style={styles.kycTitle}>{kycInfo.title}</Text>
                                <Text style={styles.kycSubtitle}>{kycInfo.subtitle}</Text>
                            </View>
                        </View>
                        {kycInfo.showButton && (
                            <View style={styles.kycRight}>
                                <Text style={[styles.kycButtonText, { color: kycInfo.color }]}>
                                    {kycInfo.buttonText} →
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {/* Personal Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Full Name</Text>
                            {editMode ? (
                                <TextInput
                                    style={styles.input}
                                    value={formData.fullName}
                                    onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                                    placeholder="Enter full name"
                                    placeholderTextColor={colors.textLight}
                                />
                            ) : (
                                <Text style={styles.infoValue}>{user?.fullName}</Text>
                            )}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Email</Text>
                            {editMode ? (
                                <TextInput
                                    style={styles.input}
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                    placeholder="Enter email"
                                    placeholderTextColor={colors.textLight}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            ) : (
                                <Text style={styles.infoValue}>{user?.email}</Text>
                            )}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Phone Number</Text>
                            {editMode ? (
                                <TextInput
                                    style={styles.input}
                                    value={formData.phoneNumber}
                                    onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                                    placeholder="Enter phone number"
                                    placeholderTextColor={colors.textLight}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                />
                            ) : (
                                <Text style={styles.infoValue}>{user?.phoneNumber}</Text>
                            )}
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>ID Number</Text>
                            <Text style={styles.infoValue}>{user?.idNumber}</Text>
                        </View>

                        {editMode && (
                            <View style={styles.editActions}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.cancelButton]}
                                    onPress={handleCancel}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        styles.saveButton,
                                        saving && styles.buttonDisabled
                                    ]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>Save Changes</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Security Section - 2FA */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Security</Text>
                    
                    <TouchableOpacity
                        style={styles.securityCard}
                        onPress={handle2FAToggle}
                        disabled={checking2FA}
                    >
                        <View style={styles.securityLeft}>
                            <View style={[
                                styles.securityIconContainer,
                                twoFactorEnabled && styles.securityIconActive
                            ]}>
                                <Text style={styles.securityIcon}>🔐</Text>
                            </View>
                            <View style={styles.securityInfo}>
                                <Text style={styles.securityTitle}>Two-Factor Authentication</Text>
                                <Text style={styles.securitySubtext}>
                                    {checking2FA 
                                        ? 'Checking status...'
                                        : twoFactorEnabled 
                                            ? 'Your account is protected with 2FA' 
                                            : 'Add an extra layer of security'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.securityRight}>
                            {checking2FA ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <View style={[
                                    styles.statusBadge,
                                    twoFactorEnabled ? styles.statusEnabled : styles.statusDisabled
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        twoFactorEnabled ? styles.statusTextEnabled : styles.statusTextDisabled
                                    ]}>
                                        {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    {twoFactorEnabled && (
                        <View style={styles.warningBox}>
                            <Text style={styles.warningIcon}>⚠️</Text>
                            <Text style={styles.warningText}>
                                Keep your authenticator app accessible. You'll need it to log in.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Accounts Section */}
                {!editMode && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Accounts</Text>
                        {accounts.map((account) => (
                            <View key={account.id} style={styles.accountCard}>
                                <View style={styles.accountHeader}>
                                    <View style={styles.accountIconContainer}>
                                        <Text style={styles.accountIcon}>
                                            {getAccountIcon(account.account_type_code)}
                                        </Text>
                                    </View>
                                    <View style={styles.accountInfo}>
                                        <Text style={styles.accountType}>
                                            {account.account_type_name}
                                        </Text>
                                        <Text style={styles.accountNumber}>
                                            {account.account_number}
                                        </Text>
                                    </View>
                                    {account.is_default === 1 && (
                                        <View style={styles.defaultBadge}>
                                            <Text style={styles.defaultText}>Default</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.accountBalance}>
                                    {formatCurrency(account.balance)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Quick Actions */}
                {!editMode && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('TransactionHistory')}
                        >
                            <Text style={styles.menuIcon}>📊</Text>
                            <Text style={styles.menuText}>Transaction History</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => navigation.navigate('Beneficiaries')}
                        >
                            <Text style={styles.menuIcon}>📖</Text>
                            <Text style={styles.menuText}>Beneficiaries</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.menuItem, styles.logoutItem]}
                            onPress={handleLogout}
                        >
                            <Text style={styles.menuIcon}>🚪</Text>
                            <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
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
    editButton: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
    },
    balanceCard: {
        backgroundColor: colors.primary,
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    balanceLabel: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    balanceSubtext: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    // KYC CARD STYLES - NEW
    kycCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        marginHorizontal: 20,
        padding: 20,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 2,
        borderColor: colors.primary + '40',
    },
    kycCardVerified: {
        borderColor: colors.success + '40',
        backgroundColor: colors.success + '08',
    },
    kycCardRejected: {
        borderColor: colors.error + '40',
        backgroundColor: colors.error + '08',
    },
    kycLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    kycIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    kycIconVerified: {
        backgroundColor: colors.success + '20',
    },
    kycIconRejected: {
        backgroundColor: colors.error + '20',
    },
    kycIcon: {
        fontSize: 28,
    },
    kycInfo: {
        flex: 1,
    },
    kycTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    kycSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    kycRight: {
        marginLeft: 12,
    },
    kycButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    infoRow: {
        paddingVertical: 12,
    },
    infoLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    input: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
        backgroundColor: colors.background,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
    },
    editActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    saveButton: {
        backgroundColor: colors.primary,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    // Security Section Styles
    securityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
    },
    securityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    securityIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    securityIconActive: {
        backgroundColor: colors.success + '20',
    },
    securityIcon: {
        fontSize: 24,
    },
    securityInfo: {
        flex: 1,
    },
    securityTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    securitySubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    securityRight: {
        marginLeft: 12,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusEnabled: {
        backgroundColor: colors.success + '20',
    },
    statusDisabled: {
        backgroundColor: colors.border,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    statusTextEnabled: {
        color: colors.success,
    },
    statusTextDisabled: {
        color: colors.textSecondary,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.warning + '10',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.warning + '30',
    },
    warningIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    accountCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    accountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    accountIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    accountIcon: {
        fontSize: 24,
    },
    accountInfo: {
        flex: 1,
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
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    menuIcon: {
        fontSize: 24,
        marginRight: 16,
    },
    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    menuArrow: {
        fontSize: 24,
        color: colors.textSecondary,
    },
    logoutItem: {
        borderColor: colors.error + '40',
    },
    logoutText: {
        color: colors.error,
    },
});