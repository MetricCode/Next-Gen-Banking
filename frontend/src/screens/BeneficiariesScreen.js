// src/screens/BeneficiariesScreen.js
// COMPLETE VERSION WITH KYC VERIFICATION

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
    RefreshControl,
    TouchableWithoutFeedback,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { accountAPI, kycAPI } from '../services/api';
import KYCGate from '../components/KYCGate';

export default function BeneficiariesScreen({ navigation, route }) {
    const [beneficiaries, setBeneficiaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [newNickname, setNewNickname] = useState('');
    const [addingBeneficiary, setAddingBeneficiary] = useState(false);
    
    // KYC state
    const [kycVerified, setKycVerified] = useState(false);
    const [checkingKyc, setCheckingKyc] = useState(true);
    const [showKycGate, setShowKycGate] = useState(false);

    // Check if we're in "select mode" (coming from TransferScreen)
    const isSelectMode = route.params?.selectMode || false;
    const onSelectBeneficiary = route.params?.onSelect;

    useEffect(() => {
        loadData();
    }, []);

    // Reload when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            checkKycStatus();
        });
        return unsubscribe;
    }, [navigation]);

    const loadData = async () => {
        try {
            await checkKycStatus();
            await loadBeneficiaries();
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

    const loadBeneficiaries = async () => {
        try {
            console.log('Loading beneficiaries...');
            const response = await accountAPI.getBeneficiaries();
            console.log('Beneficiaries response:', response);
            setBeneficiaries(response.beneficiaries || []);
        } catch (error) {
            console.error('Error loading beneficiaries:', error);
            Alert.alert('Error', 'Failed to load beneficiaries');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleAddBeneficiaryPress = () => {
        // Check KYC verification first
        if (!kycVerified) {
            setShowKycGate(true);
            return;
        }
        
        setShowAddModal(true);
    };

    const handleAddBeneficiary = async () => {
        if (!newAccountNumber) {
            Alert.alert('Error', 'Please enter an account number');
            return;
        }

        if (newAccountNumber.length < 10) {
            Alert.alert('Error', 'Please enter a valid account number');
            return;
        }

        setAddingBeneficiary(true);
        try {
            const response = await accountAPI.addBeneficiary(
                newAccountNumber,
                newNickname || null
            );

            if (response.success) {
                Alert.alert('Success', 'Beneficiary added successfully');
                setShowAddModal(false);
                setNewAccountNumber('');
                setNewNickname('');
                loadBeneficiaries();
            }
        } catch (error) {
            console.error('Error adding beneficiary:', error);
            
            // Check if error is KYC-related
            if (error.response?.data?.kycRequired) {
                setKycVerified(false);
                setShowAddModal(false);
                setShowKycGate(true);
            } else {
                Alert.alert(
                    'Error',
                    error.response?.data?.error || 'Failed to add beneficiary'
                );
            }
        } finally {
            setAddingBeneficiary(false);
        }
    };

    const handleDeleteBeneficiary = (beneficiary) => {
        Alert.alert(
            'Delete Beneficiary',
            `Remove ${beneficiary.name || beneficiary.accountNumber} from your beneficiaries?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await accountAPI.deleteBeneficiary(beneficiary.id);
                            Alert.alert('Success', 'Beneficiary deleted');
                            loadBeneficiaries();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete beneficiary');
                        }
                    },
                },
            ]
        );
    };

    const handleSelectBeneficiary = (beneficiary) => {
        if (isSelectMode && onSelectBeneficiary) {
            onSelectBeneficiary(beneficiary);
            navigation.goBack();
        } else {
            // Show beneficiary details or options
            Alert.alert(
                beneficiary.nickname || beneficiary.name,
                `Account: ${beneficiary.accountNumber}\nType: ${beneficiary.accountTypeName || 'N/A'}`,
                [
                    {
                        text: 'Send Money',
                        onPress: () => {
                            navigation.navigate('Transfer', {
                                selectedBeneficiary: beneficiary,
                            });
                        },
                    },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => handleDeleteBeneficiary(beneficiary),
                    },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        }
    };

    const handleKycVerify = () => {
        setShowKycGate(false);
        navigation.navigate('KYCVerification');
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

    const renderBeneficiary = ({ item }) => (
        <TouchableOpacity
            style={styles.beneficiaryCard}
            onPress={() => handleSelectBeneficiary(item)}
            onLongPress={() => handleDeleteBeneficiary(item)}
        >
            <View style={styles.iconContainer}>
                <Text style={styles.icon}>
                    {getAccountIcon(item.accountType)}
                </Text>
            </View>

            <View style={styles.beneficiaryInfo}>
                <Text style={styles.beneficiaryName}>
                    {item.nickname || item.name || 'Unknown'}
                </Text>
                <Text style={styles.accountNumber}>{item.accountNumber}</Text>
                {item.accountTypeName && (
                    <Text style={styles.accountType}>{item.accountTypeName}</Text>
                )}
            </View>

            {item.isFavorite === 1 && (
                <View style={styles.favoriteIcon}>
                    <Text style={styles.favoriteText}>⭐</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.flex}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {isSelectMode ? 'Select Beneficiary' : 'Beneficiaries'}
                        </Text>
                        <TouchableOpacity onPress={handleAddBeneficiaryPress}>
                            <Text style={[
                                styles.addButton,
                                !kycVerified && styles.addButtonDisabled
                            ]}>
                                + Add
                            </Text>
                        </TouchableOpacity>
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
                                    Complete KYC to add beneficiaries
                                </Text>
                            </View>
                            <Text style={styles.warningArrow}>→</Text>
                        </TouchableOpacity>
                    )}

                    {/* Beneficiaries List */}
                    <FlatList
                        data={beneficiaries}
                        renderItem={renderBeneficiary}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateIcon}>📖</Text>
                                <Text style={styles.emptyStateText}>No beneficiaries yet</Text>
                                <Text style={styles.emptyStateSubtext}>
                                    Add beneficiaries for quick transfers
                                </Text>
                                <TouchableOpacity
                                    style={[
                                        styles.emptyStateButton,
                                        !kycVerified && styles.buttonDisabled
                                    ]}
                                    onPress={handleAddBeneficiaryPress}
                                    disabled={!kycVerified}
                                >
                                    <Text style={styles.emptyStateButtonText}>
                                        {kycVerified ? 'Add Beneficiary' : 'Verify Identity First'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />
                </View>
            </TouchableWithoutFeedback>

            {/* Add Beneficiary Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>Add Beneficiary</Text>
                                    <Text style={styles.modalSubtitle}>
                                        Enter beneficiary details for quick transfers
                                    </Text>

                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>
                                            Account Number *
                                        </Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter account number"
                                            placeholderTextColor={colors.textLight}
                                            value={newAccountNumber}
                                            onChangeText={setNewAccountNumber}
                                            keyboardType="numeric"
                                            maxLength={10}
                                            autoFocus
                                        />
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>
                                            Nickname (Optional)
                                        </Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., Mom, John, Business Partner"
                                            placeholderTextColor={colors.textLight}
                                            value={newNickname}
                                            onChangeText={setNewNickname}
                                            returnKeyType="done"
                                            onSubmitEditing={Keyboard.dismiss}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.addBeneficiaryButton,
                                            addingBeneficiary && styles.buttonDisabled,
                                        ]}
                                        onPress={handleAddBeneficiary}
                                        disabled={addingBeneficiary}
                                    >
                                        {addingBeneficiary ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.addBeneficiaryButtonText}>
                                                Add Beneficiary
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.modalCloseButton}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setShowAddModal(false);
                                            setNewAccountNumber('');
                                            setNewNickname('');
                                        }}
                                    >
                                        <Text style={styles.modalCloseText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* KYC Gate Modal */}
            <KYCGate
                visible={showKycGate}
                onClose={() => setShowKycGate(false)}
                onVerify={handleKycVerify}
                feature="adding beneficiaries"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    flex: {
        flex: 1,
    },
    keyboardAvoidingView: {
        flex: 1,
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
    addButton: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    addButtonDisabled: {
        opacity: 0.4,
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
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    beneficiaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
    },
    beneficiaryInfo: {
        flex: 1,
    },
    beneficiaryName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    accountNumber: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    accountType: {
        fontSize: 12,
        color: colors.textLight,
    },
    favoriteIcon: {
        marginLeft: 8,
    },
    favoriteText: {
        fontSize: 20,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 80,
        paddingHorizontal: 40,
    },
    emptyStateIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    emptyStateButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    emptyStateButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
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
        marginBottom: 24,
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addBeneficiaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    addBeneficiaryButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalCloseButton: {
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalCloseText: {
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '600',
    },
});