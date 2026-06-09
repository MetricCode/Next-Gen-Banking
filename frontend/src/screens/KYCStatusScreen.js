// src/screens/KYCStatusScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { kycAPI } from '../services/api';

export default function KYCStatusScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        loadStatus();
        
        // Poll status every 10 seconds if pending
        const interval = setInterval(() => {
            if (status?.status === 'pending') {
                loadStatus();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [status?.status]);

    const loadStatus = async () => {
        try {
            const result = await kycAPI.getStatus();
            setStatus(result);
        } catch (error) {
            console.error('Error loading KYC status:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadStatus();
    };

    const getStatusInfo = () => {
        switch (status?.status) {
            case 'verified':
                return {
                    icon: '✅',
                    title: 'Verification Complete!',
                    message: 'Your identity has been successfully verified.',
                    color: colors.success,
                };
            case 'pending':
                return {
                    icon: '⏳',
                    title: 'Verification in Progress',
                    message: 'We are reviewing your documents. This usually takes 1-2 minutes.',
                    color: colors.warning,
                };
            case 'review':
                return {
                    icon: '🔍',
                    title: 'Under Review',
                    message: 'Your documents require manual review. This may take up to 24 hours.',
                    color: colors.warning,
                };
            case 'rejected':
                return {
                    icon: '❌',
                    title: 'Verification Failed',
                    message: status.message || 'Unable to verify your identity. Please try again.',
                    color: colors.error,
                };
            case 'not_started':
            default:
                return {
                    icon: '📋',
                    title: 'Verification Required',
                    message: 'Complete identity verification to access all banking features.',
                    color: colors.primary,
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

    const statusInfo = getStatusInfo();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>KYC Status</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                <View style={styles.statusCard}>
                    <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                    <Text style={styles.statusTitle}>{statusInfo.title}</Text>
                    <Text style={styles.statusMessage}>{statusInfo.message}</Text>

                    {status?.status === 'pending' && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={styles.loadingText}>
                                Checking status...
                            </Text>
                        </View>
                    )}

                    {status?.submittedAt && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Submitted:</Text>
                            <Text style={styles.infoValue}>
                                {new Date(status.submittedAt).toLocaleString()}
                            </Text>
                        </View>
                    )}

                    {status?.verifiedAt && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Verified:</Text>
                            <Text style={styles.infoValue}>
                                {new Date(status.verifiedAt).toLocaleString()}
                            </Text>
                        </View>
                    )}
                </View>

                {status?.status === 'verified' && (
                    <View style={styles.benefitsCard}>
                        <Text style={styles.benefitsTitle}>✨ You now have access to:</Text>
                        <View style={styles.benefitItem}>
                            <Text style={styles.benefitBullet}>✓</Text>
                            <Text style={styles.benefitText}>Full transfer limits</Text>
                        </View>
                        <View style={styles.benefitItem}>
                            <Text style={styles.benefitBullet}>✓</Text>
                            <Text style={styles.benefitText}>M-Pesa integration</Text>
                        </View>
                        <View style={styles.benefitItem}>
                            <Text style={styles.benefitBullet}>✓</Text>
                            <Text style={styles.benefitText}>International transfers</Text>
                        </View>
                        <View style={styles.benefitItem}>
                            <Text style={styles.benefitBullet}>✓</Text>
                            <Text style={styles.benefitText}>Savings accounts</Text>
                        </View>
                    </View>
                )}

                {(status?.status === 'not_started' || status?.status === 'rejected') && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('KYCVerification')}
                    >
                        <Text style={styles.actionButtonText}>
                            {status?.status === 'rejected' ? 'Try Again' : 'Start Verification'}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.helpCard}>
                    <Text style={styles.helpTitle}>Need Help?</Text>
                    <Text style={styles.helpText}>
                        If you have questions about the verification process, please contact
                        our support team.
                    </Text>
                    <TouchableOpacity style={styles.helpButton}>
                        <Text style={styles.helpButtonText}>Contact Support</Text>
                    </TouchableOpacity>
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
    content: {
        flex: 1,
        padding: 20,
    },
    statusCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    statusMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        marginTop: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    infoValue: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    benefitsCard: {
        backgroundColor: colors.success + '10',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.success + '30',
    },
    benefitsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    benefitBullet: {
        fontSize: 18,
        color: colors.success,
        marginRight: 12,
        fontWeight: 'bold',
    },
    benefitText: {
        fontSize: 14,
        color: colors.text,
    },
    actionButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    helpCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    helpTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    helpText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: 16,
    },
    helpButton: {
        backgroundColor: colors.primary + '20',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    helpButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
});