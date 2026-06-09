// src/screens/TransactionDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Share,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { transactionAPI } from '../services/api';

export default function TransactionDetailScreen({ navigation, route }) {
    const [transaction, setTransaction] = useState(route.params?.transaction || null);
    const [loading, setLoading] = useState(!route.params?.transaction);
    const [transactionId] = useState(route.params?.transaction?.id || route.params?.transactionId);

    useEffect(() => {
        if (!transaction && transactionId) {
            loadTransactionDetails();
        }
    }, [transactionId]);

    const loadTransactionDetails = async () => {
        try {
            const response = await transactionAPI.getDetails(transactionId);
            if (response.success) {
                setTransaction(response.transaction);
            }
        } catch (error) {
            console.error('Error loading transaction details:', error);
            Alert.alert('Error', 'Failed to load transaction details');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return `KES ${Number(amount || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const handleShare = async () => {
        if (!transaction) return;
        
        try {
            await Share.share({
                message: `Transaction Receipt\n\nReference: ${transaction.reference}\nAmount: ${formatCurrency(transaction.amount)}\nDate: ${formatDate(transaction.date)}\nStatus: ${transaction.status}\nType: ${transaction.type.toUpperCase()}`,
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share receipt');
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!transaction) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Transaction not found</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transaction Details</Text>
                <TouchableOpacity onPress={handleShare}>
                    <Text style={styles.shareButton}>Share</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Status Badge */}
                <View style={styles.statusContainer}>
                    <View style={[
                        styles.statusBadge,
                        transaction.status === 'completed' && styles.statusSuccess,
                        transaction.status === 'pending' && styles.statusPending,
                        transaction.status === 'failed' && styles.statusFailed,
                    ]}>
                        <Text style={styles.statusIcon}>
                            {transaction.status === 'completed' ? '✓' : 
                             transaction.status === 'pending' ? '⏳' : '✗'}
                        </Text>
                        <Text style={styles.statusText}>
                            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </Text>
                    </View>
                </View>

                {/* Amount */}
                <View style={styles.amountContainer}>
                    <Text style={[
                        styles.amount,
                        { color: transaction.type === 'sent' ? colors.error : colors.success }
                    ]}>
                        {transaction.type === 'sent' ? '-' : '+'}
                        {formatCurrency(transaction.amount)}
                    </Text>
                    <Text style={styles.amountLabel}>
                        {transaction.type === 'sent' ? 'Sent' : 'Received'}
                    </Text>
                </View>

                {/* Details Card */}
                <View style={styles.detailsCard}>
                    <DetailRow
                        label="Reference Number"
                        value={transaction.reference}
                        copyable
                    />
                    <DetailRow
                        label={transaction.type === 'sent' ? 'Recipient' : 'Sender'}
                        value={transaction.counterparty || 'N/A'}
                    />
                    {transaction.counterpartyAccount && (
                        <DetailRow
                            label="Counterparty Account"
                            value={transaction.counterpartyAccount}
                            copyable
                        />
                    )}
                    <DetailRow
                        label="From Account"
                        value={transaction.fromAccount || 'N/A'}
                    />
                    <DetailRow
                        label="To Account"
                        value={transaction.toAccount || 'N/A'}
                    />
                    <DetailRow
                        label="Date & Time"
                        value={formatDate(transaction.date)}
                    />
                    {transaction.description && (
                        <DetailRow
                            label="Description"
                            value={transaction.description}
                        />
                    )}
                    <DetailRow
                        label="Transaction Fee"
                        value="KES 0.00"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const DetailRow = ({ label, value, copyable }) => (
    <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <View style={styles.detailValueContainer}>
            <Text style={styles.detailValue}>{value}</Text>
            {copyable && (
                <TouchableOpacity onPress={() => {
                    require('react-native').Clipboard.setString(value);
                    Alert.alert('Copied!', `${label} copied to clipboard`);
                }}>
                    <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
            )}
        </View>
    </View>
);

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
        gap: 16,
    },
    errorText: {
        fontSize: 16,
        color: colors.error,
    },
    backButtonText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
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
    shareButton: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: 32,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 8,
    },
    statusSuccess: {
        backgroundColor: colors.success + '20',
    },
    statusPending: {
        backgroundColor: colors.warning + '20',
    },
    statusFailed: {
        backgroundColor: colors.error + '20',
    },
    statusIcon: {
        fontSize: 18,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    amountContainer: {
        alignItems: 'center',
        marginVertical: 32,
    },
    amount: {
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    amountLabel: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    detailsCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    detailRow: {
        marginBottom: 20,
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    detailValueContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailValue: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
        flex: 1,
    },
    copyButtonText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
        marginLeft: 12,
    },
});