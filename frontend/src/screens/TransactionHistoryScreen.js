// src/screens/TransactionHistoryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { transactionAPI } from '../services/api';

export default function TransactionHistoryScreen({ navigation }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('all'); // all, sent, received
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const loadTransactions = async (reset = true, type = filter) => {
        try {
            const currentPage = reset ? 0 : page;
            const limit = 20;
            const offset = currentPage * limit;
            
            const response = await transactionAPI.getHistory(limit, offset, type);
            
            if (response.success) {
                const newTransactions = response.transactions || [];
                
                if (reset) {
                    setTransactions(newTransactions);
                    setPage(1);
                } else {
                    setTransactions(prev => [...prev, ...newTransactions]);
                    setPage(currentPage + 1);
                }
                
                setHasMore(response.pagination?.hasMore || false);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        loadTransactions();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        setPage(0);
        loadTransactions(true, filter);
    };

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setLoading(true);
        setPage(0);
        loadTransactions(true, newFilter);
    };

    const loadMore = () => {
        if (!loadingMore && hasMore && !loading) {
            setLoadingMore(true);
            loadTransactions(false, filter);
        }
    };

    const formatCurrency = (amount) => {
        return `KES ${Number(amount || 0).toLocaleString('en-KE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDate = (dateString) => {
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
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getTransactionIcon = (type) => {
        return type === 'sent' ? '↑' : '↓';
    };

    const getTransactionColor = (type) => {
        return type === 'sent' ? colors.error : colors.success;
    };

    const getTransactionName = (transaction) => {
        if (transaction.type === 'sent') {
            return transaction.counterparty || `To ${transaction.toAccount || 'Unknown'}`;
        } else {
            return transaction.counterparty || `From ${transaction.fromAccount || 'Unknown'}`;
        }
    };

    const renderTransaction = ({ item }) => (
        <TouchableOpacity
            style={styles.transactionCard}
            onPress={() => navigation.navigate('TransactionDetail', { transaction: item })}
        >
            <View style={[
                styles.iconContainer,
                { backgroundColor: getTransactionColor(item.type) + '20' }
            ]}>
                <Text style={[
                    styles.icon,
                    { color: getTransactionColor(item.type) }
                ]}>
                    {getTransactionIcon(item.type)}
                </Text>
            </View>
            
            <View style={styles.transactionInfo}>
                <Text style={styles.transactionName} numberOfLines={1}>
                    {getTransactionName(item)}
                </Text>
                <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
                {item.description && (
                    <Text style={styles.transactionDescription} numberOfLines={1}>
                        {item.description}
                    </Text>
                )}
            </View>
            
            <View style={styles.transactionRight}>
                <Text style={[
                    styles.transactionAmount,
                    { color: getTransactionColor(item.type) }
                ]}>
                    {item.type === 'sent' ? '-' : '+'}{formatCurrency(item.amount)}
                </Text>
                <View style={[
                    styles.statusBadge,
                    item.status === 'completed' && styles.statusSuccess,
                    item.status === 'pending' && styles.statusPending,
                    item.status === 'failed' && styles.statusFailed,
                ]}>
                    <Text style={styles.statusText}>
                        {item.status === 'completed' ? '✓' : 
                         item.status === 'pending' ? '⏳' : '✗'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.footerText}>Loading more...</Text>
            </View>
        );
    };

    if (loading && transactions.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transactions</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Text style={styles.refreshButton}>⟳</Text>
                </TouchableOpacity>
            </View>

            {/* Summary Stats */}
            {transactions.length > 0 && (
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Total Spent</Text>
                        <Text style={[styles.summaryValue, { color: colors.error }]}>
                            {formatCurrency(
                                transactions
                                    .filter(t => t.type === 'sent' && t.status === 'completed')
                                    .reduce((sum, t) => sum + t.amount, 0)
                            )}
                        </Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Total Received</Text>
                        <Text style={[styles.summaryValue, { color: colors.success }]}>
                            {formatCurrency(
                                transactions
                                    .filter(t => t.type === 'received' && t.status === 'completed')
                                    .reduce((sum, t) => sum + t.amount, 0)
                            )}
                        </Text>
                    </View>
                </View>
            )}

            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
                {['all', 'sent', 'received'].map((filterType) => (
                    <TouchableOpacity
                        key={filterType}
                        style={[
                            styles.filterTab,
                            filter === filterType && styles.filterTabActive
                        ]}
                        onPress={() => handleFilterChange(filterType)}
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

            <FlatList
                data={transactions}
                renderItem={renderTransaction}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateIcon}>📊</Text>
                        <Text style={styles.emptyStateText}>No transactions found</Text>
                        <Text style={styles.emptyStateSubtext}>
                            Your transaction history will appear here when you make transfers
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyStateButton}
                            onPress={() => navigation.navigate('Transfer')}
                        >
                            <Text style={styles.emptyStateButtonText}>Make a Transfer</Text>
                        </TouchableOpacity>
                    </View>
                }
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
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    filterTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
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
        paddingBottom: 20,
    },
    transactionCard: {
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
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    transactionInfo: {
        flex: 1,
    },
    transactionName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    transactionDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    transactionDescription: {
        fontSize: 12,
        color: colors.textLight,
        marginTop: 2,
    },
    transactionRight: {
        alignItems: 'flex-end',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statusBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
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
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    footerLoader: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    footerText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
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
});