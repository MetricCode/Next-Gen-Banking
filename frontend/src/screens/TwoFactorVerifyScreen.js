import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { authAPI } from '../services/api';

export default function TwoFactorVerifyScreen({ navigation, route }) {
    const { userId } = route.params;
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCode, setBackupCode] = useState('');
    const [useBackupCode, setUseBackupCode] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        const code = useBackupCode ? backupCode : verificationCode;
        
        if (!code) {
            Alert.alert('Error', `Please enter your ${useBackupCode ? 'backup code' : '6-digit code'}`);
            return;
        }

        if (!useBackupCode && code.length !== 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit code');
            return;
        }

        setLoading(true);
        try {
            const response = await authAPI.verify2FALogin(
                userId, 
                useBackupCode ? null : verificationCode, 
                useBackupCode ? backupCode : null
            );
            
            if (response.token) {
                // Token and user are already saved by the API function
                console.log('✅ 2FA verified, navigating to Dashboard');
                navigation.replace('Dashboard');
            }
        } catch (error) {
            // Use console.log instead of console.error (no red error box)
            console.log('⚠️ 2FA verification failed:', error.response?.data?.error || 'Invalid code');
            
            // Still show Alert dialog to user
            Alert.alert(
                'Verification Failed', 
                error.response?.data?.error || 'Invalid code. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.icon}>🔐</Text>
                        <Text style={styles.title}>Two-Factor Authentication</Text>
                        <Text style={styles.subtitle}>
                            {useBackupCode 
                                ? 'Enter your backup code to continue'
                                : 'Enter the 6-digit code from your authenticator app'}
                        </Text>
                    </View>

                    {!useBackupCode ? (
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.codeInput}
                                placeholder="000000"
                                placeholderTextColor={colors.textLight}
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                keyboardType="number-pad"
                                maxLength={6}
                                textAlign="center"
                                autoFocus
                            />
                        </View>
                    ) : (
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.backupInput}
                                placeholder="A1B2C3D4"
                                placeholderTextColor={colors.textLight}
                                value={backupCode}
                                onChangeText={(text) => setBackupCode(text.toUpperCase())}
                                keyboardType="default"  // ✅ FIXED: Full alphanumeric keyboard
                                autoCapitalize="characters"
                                autoCorrect={false}
                                autoComplete="off"
                                spellCheck={false}
                                maxLength={8}
                                autoFocus
                            />
                            <Text style={styles.helperText}>
                                Backup codes are 8 characters (letters and numbers)
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleVerify}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Verify & Login</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => {
                            setUseBackupCode(!useBackupCode);
                            setVerificationCode('');
                            setBackupCode('');
                        }}
                    >
                        <Text style={styles.switchText}>
                            {useBackupCode 
                                ? '← Use authenticator app instead'
                                : 'Use a backup code instead →'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    icon: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    codeInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        letterSpacing: 8,
    },
    backupInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        textAlign: 'center',
        letterSpacing: 2,
    },
    helperText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    switchButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    switchText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    cancelText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
});