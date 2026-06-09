// src/screens/CryptoHistoryScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    Alert,
    Modal,
    Share,
    Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { cryptoAPI } from '../services/api';

export default function CryptoHistoryScreen({ navigation }) {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDeposit, setSelectedDeposit] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filter, setFilter] = useState('all'); // all, pending, completed, failed
    const [totalDeposited, setTotalDeposited] = useState(0);
    const [pendingTotal, setPendingTotal] = useState(0);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const response = await cryptoAPI.getHistory(100, 0);
            if (response.success) {
                // The API returns camelCase fields; normalize to snake_case
                // so the rest of this component uses consistent field names.
                const normalized = (response.deposits || []).map(d => ({
                    id:              d.id,
                    fiat_amount:     d.fiatAmount     ?? d.fiat_amount,
                    crypto_amount:   d.cryptoAmount   ?? d.crypto_amount,
                    crypto_currency: d.cryptoCurrency ?? d.crypto_currency,
                    wallet_address:  d.walletAddress  ?? d.wallet_address,
                    order_id:        d.orderId        ?? d.order_id,
                    payment_id:      d.paymentId      ?? d.payment_id,
                    status:          d.status,
                    network:         d.network,
                    actually_paid:   d.actuallyPaid   ?? d.actually_paid,
                    created_at:      d.createdAt      ?? d.created_at,
                    completed_at:    d.completedAt    ?? d.completed_at,
                }));
                setDeposits(normalized);
                // Use server-side totals if available, otherwise calculate locally
                if (response.stats) {
                    setTotalDeposited(response.stats.totalCompleted ?? 0);
                    setPendingTotal(response.stats.totalPending ?? 0);
                } else {
                    calculateTotals(normalized);
                }
            }
        } catch (error) {
            console.error('Error loading crypto history:', error);
            Alert.alert('Error', 'Failed to load transaction history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateTotals = (depositsList) => {
        const completed = depositsList
            .filter(d => d.status === 'completed')
            .reduce((sum, d) => sum + (d.fiat_amount || 0), 0);
        
        const pending = depositsList
            .filter(d => d.status === 'pending')
            .reduce((sum, d) => sum + (d.fiat_amount || 0), 0);
        
        setTotalDeposited(completed);
        setPendingTotal(pending);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadHistory();
    };

    const handleDepositPress = (deposit) => {
        setSelectedDeposit(deposit);
        setShowDetailModal(true);
    };

    const copyToClipboard = (text, label) => {
        Clipboard.setString(text);
        Alert.alert('Copied!', `${label} copied to clipboard`);
    };

    const shareTransaction = async () => {
        if (!selectedDeposit) return;
        
        try {
            await Share.share({
                message: `Crypto Deposit Receipt\n\n` +
                    `Amount: $${selectedDeposit.fiat_amount} USD\n` +
                    `Crypto: ${selectedDeposit.crypto_amount} ${selectedDeposit.crypto_currency}\n` +
                    `Status: ${selectedDeposit.status.toUpperCase()}\n` +
                    `Date: ${new Date(selectedDeposit.created_at).toLocaleString()}\n` +
                    `Order ID: ${selectedDeposit.order_id}\n` +
                    `Transaction ID: ${selectedDeposit.payment_id || selectedDeposit.id}`
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share receipt');
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'completed':
                return { text: 'Completed', color: colors.success, icon: '✅', bg: colors.success + '20' };
            case 'pending':
                return { text: 'Pending', color: colors.warning, icon: '⏳', bg: colors.warning + '20' };
            case 'failed':
                return { text: 'Failed', color: colors.error, icon: '❌', bg: colors.error + '20' };
            case 'expired':
                return { text: 'Expired', color: colors.textSecondary, icon: '⌛', bg: colors.border };
            default:
                return { text: status || 'Unknown', color: colors.textSecondary, icon: '❓', bg: colors.border };
        }
    };

    const getCryptoIcon = (currency) => {
        const icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'USDC': '💵',
            'BNB': '🟡',
            'SOL': '◎',
            'XRP': '✕',
            'DOGE': '🐕',
            'TRX': '🔴',
            'LTC': 'Ł',
            'ADA': '₳',
            'MATIC': '💜'
        };
        return icons[currency] || '💰';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatFullDate = (dateString) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const filteredDeposits = deposits.filter(deposit => {
        if (filter === 'all') return true;
        return deposit.status === filter;
    });

    const renderDeposit = ({ item }) => {
        const statusConfig = getStatusConfig(item.status);
        
        return (
            <TouchableOpacity
                style={styles.depositCard}
                onPress={() => handleDepositPress(item)}
            >
                <View style={styles.depositHeader}>
                    <View style={styles.depositIconContainer}>
                        <Text style={styles.depositIcon}>
                            {getCryptoIcon(item.crypto_currency)}
                        </Text>
                    </View>
                    <View style={styles.depositInfo}>
                        <Text style={styles.depositCurrency}>
                            {item.crypto_currency}
                        </Text>
                        <Text style={styles.depositDate}>
                            {formatDate(item.created_at)}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
                        <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.text}
                        </Text>
                    </View>
                </View>

                <View style={styles.depositDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Amount (USD)</Text>
                        <Text style={styles.detailValue}>
                            ${item.fiat_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Crypto Received</Text>
                        <Text style={styles.detailValueCrypto}>
                            {item.crypto_amount?.toLocaleString('en-US', { 
                                minimumFractionDigits: item.crypto_currency === 'BTC' ? 8 : 
                                                      item.crypto_currency === 'ETH' ? 6 : 4 
                            })} {item.crypto_currency}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>₿</Text>
            <Text style={styles.emptyStateTitle}>No Crypto Transactions</Text>
            <Text style={styles.emptyStateText}>
                You haven't made any crypto deposits yet.
            </Text>
            <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => navigation.navigate('CryptoDeposit')}
            >
                <Text style={styles.emptyStateButtonText}>Deposit Crypto</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading && deposits.length === 0) {
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
                <Text style={styles.headerTitle}>Crypto History</Text>
                <TouchableOpacity onPress={loadHistory}>
                    <Text style={styles.refreshButton}>⟳</Text>
                </TouchableOpacity>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Deposited</Text>
                    <Text style={styles.summaryValue}>
                        ${totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                </View>
                {pendingTotal > 0 && (
                    <View style={[styles.summaryCard, styles.pendingCard]}>
                        <Text style={styles.summaryLabel}>Pending</Text>
                        <Text style={[styles.summaryValue, styles.pendingValue]}>
                            ${pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                )}
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {['all', 'pending', 'completed', 'failed'].map((filterType) => (
                    <TouchableOpacity
                        key={filterType}
                        style={[
                            styles.filterTab,
                            filter === filterType && styles.filterTabActive
                        ]}
                        onPress={() => setFilter(filterType)}
                    >
                        <Text style={[
                            styles.filterText,
                            filter === filterType && styles.filterTextActive
                        ]}>
                            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Deposits List */}
            <FlatList
                data={filteredDeposits}
                renderItem={renderDeposit}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={renderEmptyState}
            />

            {/* Detail Modal */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Transaction Details</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedDeposit && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Status */}
                                <View style={styles.modalStatusContainer}>
                                    <View style={[
                                        styles.modalStatusBadge,
                                        { backgroundColor: getStatusConfig(selectedDeposit.status).bg }
                                    ]}>
                                        <Text style={styles.modalStatusIcon}>
                                            {getStatusConfig(selectedDeposit.status).icon}
                                        </Text>
                                        <Text style={[
                                            styles.modalStatusText,
                                            { color: getStatusConfig(selectedDeposit.status).color }
                                        ]}>
                                            {getStatusConfig(selectedDeposit.status).text}
                                        </Text>
                                    </View>
                                </View>

                                {/* Amount Section */}
                                <View style={styles.modalAmountSection}>
                                    <Text style={styles.modalAmountLabel}>Amount Deposited</Text>
                                    <Text style={styles.modalAmount}>
                                        ${selectedDeposit.fiat_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </Text>
                                    <Text style={styles.modalCryptoAmount}>
                                        {selectedDeposit.crypto_amount?.toLocaleString('en-US', { 
                                            minimumFractionDigits: selectedDeposit.crypto_currency === 'BTC' ? 8 : 
                                                                  selectedDeposit.crypto_currency === 'ETH' ? 6 : 4 
                                        })} {selectedDeposit.crypto_currency}
                                    </Text>
                                </View>

                                {/* Details */}
                                <View style={styles.modalDetailsCard}>
                                    <View style={styles.modalDetailRow}>
                                        <Text style={styles.modalDetailLabel}>Order ID</Text>
                                        <TouchableOpacity onPress={() => copyToClipboard(selectedDeposit.order_id, 'Order ID')}>
                                            <Text style={styles.modalDetailValueCode}>
                                                {selectedDeposit.order_id}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.modalDetailRow}>
                                        <Text style={styles.modalDetailLabel}>Payment ID</Text>
                                        <TouchableOpacity onPress={() => copyToClipboard(selectedDeposit.payment_id, 'Payment ID')}>
                                            <Text style={styles.modalDetailValueCode}>
                                                {selectedDeposit.payment_id || 'N/A'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.modalDetailRow}>
                                        <Text style={styles.modalDetailLabel}>Wallet Address</Text>
                                        <TouchableOpacity onPress={() => copyToClipboard(selectedDeposit.wallet_address, 'Wallet Address')}>
                                            <Text style={styles.modalDetailValueCode} numberOfLines={1}>
                                                {selectedDeposit.wallet_address || 'N/A'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.divider} />

                                    <View style={styles.modalDetailRow}>
                                        <Text style={styles.modalDetailLabel}>Created At</Text>
                                        <Text style={styles.modalDetailValue}>
                                            {formatFullDate(selectedDeposit.created_at)}
                                        </Text>
                                    </View>

                                    {selectedDeposit.completed_at && (
                                        <>
                                            <View style={styles.divider} />
                                            <View style={styles.modalDetailRow}>
                                                <Text style={styles.modalDetailLabel}>Completed At</Text>
                                                <Text style={styles.modalDetailValue}>
                                                    {formatFullDate(selectedDeposit.completed_at)}
                                                </Text>
                                            </View>
                                        </>
                                    )}

                                    {selectedDeposit.actually_paid && (
                                        <>
                                            <View style={styles.divider} />
                                            <View style={styles.modalDetailRow}>
                                                <Text style={styles.modalDetailLabel}>Actually Paid</Text>
                                                <Text style={styles.modalDetailValue}>
                                                    ${selectedDeposit.actually_paid?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>

                                {/* Warning for pending deposits */}
                                {selectedDeposit.status === 'pending' && (
                                    <View style={styles.modalWarningBox}>
                                        <Text style={styles.warningIcon}>⚠️</Text>
                                        <Text style={styles.warningText}>
                                            Your deposit is being processed. Once the transaction receives enough confirmations, it will be credited to your account.
                                        </Text>
                                    </View>
                                )}

                                {/* Action Buttons */}
                                <TouchableOpacity
                                    style={styles.modalShareButton}
                                    onPress={shareTransaction}
                                >
                                    <Text style={styles.modalShareButtonText}>Share Receipt</Text>
                                </TouchableOpacity>

                                {selectedDeposit.status === 'pending' && (
                                    <TouchableOpacity
                                        style={styles.modalRefreshButton}
                                        onPress={() => {
                                            setShowDetailModal(false);
                                            loadHistory();
                                        }}
                                    >
                                        <Text style={styles.modalRefreshButtonText}>Check Status</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
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
    refreshButton: {
        fontSize: 20,
        color: colors.primary,
        fontWeight: '600',
    },
    summaryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 4,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    pendingCard: {
        backgroundColor: colors.warning,
    },
    summaryLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 8,
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    pendingValue: {
        color: '#FFFFFF',
    },
    filterContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        paddingVertical: 12,
        gap: 8,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 40,
    },
    depositCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    depositHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    depositIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    depositIcon: {
        fontSize: 24,
    },
    depositInfo: {
        flex: 1,
    },
    depositCurrency: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    depositDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    statusIcon: {
        fontSize: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    depositDetails: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    detailValueCrypto: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.primary,
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
    emptyStateTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    emptyStateText: {
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
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
    },
    modalClose: {
        fontSize: 24,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    modalStatusContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    modalStatusIcon: {
        fontSize: 18,
    },
    modalStatusText: {
        fontSize: 16,
        fontWeight: '600',
    },
    modalAmountSection: {
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 16,
        backgroundColor: colors.background,
        borderRadius: 12,
    },
    modalAmountLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    modalAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    modalCryptoAmount: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    modalDetailsCard: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    modalDetailRow: {
        marginVertical: 8,
    },
    modalDetailLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalDetailValue: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    modalDetailValueCode: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    modalWarningBox: {
        flexDirection: 'row',
        backgroundColor: colors.warning + '10',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        alignItems: 'center',
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
    modalShareButton: {
        backgroundColor: colors.secondary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    modalShareButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    modalRefreshButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    modalRefreshButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});