import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    TextInput,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../utils/colors';
import { authAPI } from '../services/api';

export default function TwoFactorSetupScreen({ navigation, route }) {
    const mode = route.params?.mode || 'enable'; // 'enable' or 'disable'
    
    const [loading, setLoading] = useState(mode === 'enable');
    const [setupLoading, setSetupLoading] = useState(false);
    const [qrCode, setQrCode] = useState(null);
    const [secret, setSecret] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [step, setStep] = useState(1); // 1: QR Code, 2: Verify, 3: Backup Codes
    
    // For disable mode
    const [password, setPassword] = useState('');
    const [disableCode, setDisableCode] = useState('');

    useEffect(() => {
        if (mode === 'enable') {
            setup2FA();
        } else {
            setLoading(false);
        }
    }, []);

    const setup2FA = async () => {
        try {
            const response = await authAPI.enable2FA();
            if (response.success) {
                setQrCode(response.qrCode);
                setSecret(response.secret);
                setStep(1);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to setup 2FA');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            Alert.alert('Error', 'Please enter a valid 6-digit code');
            return;
        }

        setSetupLoading(true);
        try {
            const response = await authAPI.verify2FASetup(verificationCode);
            if (response.success) {
                setBackupCodes(response.backupCodes);
                setStep(3);
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Invalid verification code');
        } finally {
            setSetupLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        if (!password) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setSetupLoading(true);
        try {
            await authAPI.disable2FA(password, disableCode);
            Alert.alert(
                'Success',
                'Two-factor authentication has been disabled.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to disable 2FA');
        } finally {
            setSetupLoading(false);
        }
    };

    const handleComplete = () => {
        Alert.alert(
            'Success!',
            'Two-factor authentication has been enabled for your account.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Disable Mode UI
    if (mode === 'disable') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Disable 2FA</Text>
                    <View style={{ width: 50 }} />
                </View>

                <ScrollView style={styles.content}>
                    <View style={styles.warningCard}>
                        <Text style={styles.warningIcon}>⚠️</Text>
                        <Text style={styles.warningTitle}>Security Warning</Text>
                        <Text style={styles.warningText}>
                            Disabling 2FA will make your account less secure. 
                            You'll only need your password to log in.
                        </Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor={colors.textLight}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>2FA Code (Optional)</Text>
                        <TextInput
                            style={styles.codeInput}
                            placeholder="000000"
                            placeholderTextColor={colors.textLight}
                            value={disableCode}
                            onChangeText={setDisableCode}
                            keyboardType="number-pad"
                            maxLength={6}
                            textAlign="center"
                        />
                        <Text style={styles.helperText}>
                            Enter code from your authenticator app or leave blank
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, styles.dangerButton, setupLoading && styles.buttonDisabled]}
                        onPress={handleDisable2FA}
                        disabled={setupLoading}
                    >
                        {setupLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Disable 2FA</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Enable Mode UI
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Setup 2FA</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.content}>
                {step === 1 && (
                    <View>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoIcon}>🔐</Text>
                            <Text style={styles.infoTitle}>Two-Factor Authentication</Text>
                            <Text style={styles.infoText}>
                                Enhance your account security by enabling 2FA. 
                                Use an authenticator app like Google Authenticator, 
                                Microsoft Authenticator, or Authy.
                            </Text>
                        </View>

                        {qrCode && (
                            <View style={styles.qrContainer}>
                                <Image 
                                    source={{ uri: qrCode }}
                                    style={styles.qrImage}
                                />
                                <Text style={styles.secretText}>
                                    Or enter this code manually:
                                </Text>
                                <Text style={styles.secretCode}>{secret}</Text>
                            </View>
                        )}

                        <View style={styles.stepsCard}>
                            <Text style={styles.stepsTitle}>How to setup:</Text>
                            <Text style={styles.step}>1. Install Google Authenticator or similar app</Text>
                            <Text style={styles.step}>2. Scan the QR code above</Text>
                            <Text style={styles.step}>3. Enter the 6-digit code from the app</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => setStep(2)}
                        >
                            <Text style={styles.buttonText}>I've Scanned the QR Code →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoIcon}>📱</Text>
                            <Text style={styles.infoTitle}>Verify Your Authenticator App</Text>
                            <Text style={styles.infoText}>
                                Enter the 6-digit code from your authenticator app to confirm setup.
                            </Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Verification Code</Text>
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

                        <TouchableOpacity
                            style={[styles.button, setupLoading && styles.buttonDisabled]}
                            onPress={handleVerify}
                            disabled={setupLoading}
                        >
                            {setupLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Verify & Enable 2FA</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setStep(1)}
                        >
                            <Text style={styles.secondaryButtonText}>← Back to QR Code</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 3 && (
                    <View>
                        <View style={styles.successCard}>
                            <Text style={styles.successIcon}>✅</Text>
                            <Text style={styles.successTitle}>2FA Enabled Successfully!</Text>
                            <Text style={styles.successText}>
                                Save these backup codes in a secure place. 
                                You can use them to access your account if you lose your phone.
                            </Text>
                        </View>

                        <View style={styles.backupCodesContainer}>
                            <Text style={styles.backupTitle}>Backup Codes</Text>
                            {backupCodes.map((code, index) => (
                                <View key={index} style={styles.backupCodeRow}>
                                    <Text style={styles.backupCodeIndex}>{index + 1}.</Text>
                                    <Text style={styles.backupCode}>{code}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleComplete}
                        >
                            <Text style={styles.buttonText}>Complete Setup</Text>
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
    infoCard: {
        backgroundColor: colors.primary + '10',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        alignItems: 'center',
    },
    infoIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    qrContainer: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    qrImage: {
        width: 200,
        height: 200,
        marginBottom: 16,
    },
    secretText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    secretCode: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
        fontFamily: 'monospace',
    },
    stepsCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    stepsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    step: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
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
    codeInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        letterSpacing: 4,
    },
    helperText: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    dangerButton: {
        backgroundColor: colors.error,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    secondaryButtonText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    successCard: {
        alignItems: 'center',
        marginBottom: 24,
    },
    successIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.success,
        marginBottom: 8,
        textAlign: 'center',
    },
    successText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    backupCodesContainer: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    backupTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    backupCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    backupCodeIndex: {
        fontSize: 14,
        color: colors.textSecondary,
        width: 30,
    },
    backupCode: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
        fontFamily: 'monospace',
        letterSpacing: 1,
    },
    warningCard: {
        backgroundColor: colors.error + '10',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.error + '30',
    },
    warningIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.error,
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});