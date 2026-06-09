// src/components/KYCGate.js
// Component that blocks access to features requiring KYC verification

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
} from 'react-native';
import { colors } from '../utils/colors';

export default function KYCGate({ visible, onClose, onVerify, feature = 'this feature' }) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>🔐</Text>
                    </View>

                    <Text style={styles.title}>Verification Required</Text>
                    
                    <Text style={styles.message}>
                        You need to verify your identity to access {feature}.
                    </Text>

                    <View style={styles.benefitsContainer}>
                        <Text style={styles.benefitsTitle}>After verification, you can:</Text>
                        <View style={styles.benefit}>
                            <Text style={styles.benefitIcon}>✓</Text>
                            <Text style={styles.benefitText}>Make transfers</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Text style={styles.benefitIcon}>✓</Text>
                            <Text style={styles.benefitText}>Create multiple accounts</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Text style={styles.benefitIcon}>✓</Text>
                            <Text style={styles.benefitText}>Add beneficiaries</Text>
                        </View>
                        <View style={styles.benefit}>
                            <Text style={styles.benefitIcon}>✓</Text>
                            <Text style={styles.benefitText}>Use M-Pesa integration</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={onVerify}
                    >
                        <Text style={styles.verifyButtonText}>Verify Identity</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    icon: {
        fontSize: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    benefitsContainer: {
        width: '100%',
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    benefitsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
    },
    benefit: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    benefitIcon: {
        fontSize: 16,
        color: colors.success,
        marginRight: 12,
        fontWeight: 'bold',
    },
    benefitText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    verifyButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    verifyButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    cancelButton: {
        paddingVertical: 12,
    },
    cancelButtonText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
});