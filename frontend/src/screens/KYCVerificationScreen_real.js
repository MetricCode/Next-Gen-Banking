// src/screens/KYCVerificationScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../utils/colors';
import { kycAPI } from '../services/api';

export default function KYCVerificationScreen({ navigation }) {
    const [step, setStep] = useState(1); // 1: Info, 2: ID Front, 3: ID Back, 4: Selfie
    const [loading, setLoading] = useState(false);
    
    const [idFront, setIdFront] = useState(null);
    const [idBack, setIdBack] = useState(null);
    const [selfie, setSelfie] = useState(null);

    // Request camera permissions
    const requestPermissions = async () => {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
            Alert.alert(
                'Permissions Required',
                'Please grant camera and photo library permissions to continue with verification.'
            );
            return false;
        }
        return true;
    };

    const takePhoto = async (type) => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const options = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'selfie' ? [1, 1] : [4, 3],
            quality: 0.8,
            base64: true,
        };

        Alert.alert(
            'Choose Option',
            'How would you like to provide the image?',
            [
                {
                    text: 'Take Photo',
                    onPress: async () => {
                        const result = await ImagePicker.launchCameraAsync(options);
                        if (!result.canceled) {
                            handleImageSelected(result.assets[0], type);
                        }
                    },
                },
                {
                    text: 'Choose from Gallery',
                    onPress: async () => {
                        const result = await ImagePicker.launchImageLibraryAsync(options);
                        if (!result.canceled) {
                            handleImageSelected(result.assets[0], type);
                        }
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleImageSelected = (asset, type) => {
        const imageData = {
            uri: asset.uri,
            base64: asset.base64,
        };

        if (type === 'front') {
            setIdFront(imageData);
            setStep(3);
        } else if (type === 'back') {
            setIdBack(imageData);
            setStep(4);
        } else if (type === 'selfie') {
            setSelfie(imageData);
        }
    };

    const handleSubmit = async () => {
        if (!idFront || !selfie) {
            Alert.alert('Error', 'Please capture all required images');
            return;
        }

        setLoading(true);
        try {
            const result = await kycAPI.submitVerification({
                firstName: 'John', // Get from user profile
                lastName: 'Doe',
                idType: 'NATIONAL_ID',
                idNumber: '12345678',
                idFrontBase64: idFront.base64,
                idBackBase64: idBack?.base64 || '',
                selfieBase64: selfie.base64,
            });

            Alert.alert(
                'Success!',
                'Your verification has been submitted. Results will be available in 1-2 minutes.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.replace('KYCStatus'),
                    },
                ]
            );
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepIcon}>📋</Text>
                        <Text style={styles.stepTitle}>Identity Verification</Text>
                        <Text style={styles.stepText}>
                            To comply with banking regulations, we need to verify your identity.
                            This process takes 2-3 minutes.
                        </Text>

                        <View style={styles.requirementCard}>
                            <Text style={styles.requirementTitle}>You'll need:</Text>
                            <View style={styles.requirementItem}>
                                <Text style={styles.bulletPoint}>✓</Text>
                                <Text style={styles.requirementText}>
                                    Kenyan National ID or Passport
                                </Text>
                            </View>
                            <View style={styles.requirementItem}>
                                <Text style={styles.bulletPoint}>✓</Text>
                                <Text style={styles.requirementText}>
                                    Good lighting (natural light works best)
                                </Text>
                            </View>
                            <View style={styles.requirementItem}>
                                <Text style={styles.bulletPoint}>✓</Text>
                                <Text style={styles.requirementText}>
                                    2-3 minutes of your time
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => setStep(2)}
                        >
                            <Text style={styles.primaryButtonText}>Start Verification</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepIcon}>🪪</Text>
                        <Text style={styles.stepTitle}>ID Document - Front</Text>
                        <Text style={styles.stepText}>
                            Take a clear photo of the front of your National ID or Passport
                        </Text>

                        <View style={styles.tipsCard}>
                            <Text style={styles.tipsTitle}>Tips for best results:</Text>
                            <Text style={styles.tipText}>• Place ID on a dark surface</Text>
                            <Text style={styles.tipText}>• Ensure all corners are visible</Text>
                            <Text style={styles.tipText}>• Avoid glare or shadows</Text>
                            <Text style={styles.tipText}>• Keep image clear and focused</Text>
                        </View>

                        {idFront && (
                            <Image source={{ uri: idFront.uri }} style={styles.preview} />
                        )}

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => takePhoto('front')}
                        >
                            <Text style={styles.primaryButtonText}>
                                {idFront ? 'Retake Photo' : 'Take Photo'}
                            </Text>
                        </TouchableOpacity>

                        {idFront && (
                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => setStep(3)}
                            >
                                <Text style={styles.secondaryButtonText}>Continue →</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );

            case 3:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepIcon}>🪪</Text>
                        <Text style={styles.stepTitle}>ID Document - Back</Text>
                        <Text style={styles.stepText}>
                            Now take a photo of the back of your ID
                        </Text>

                        {idBack && (
                            <Image source={{ uri: idBack.uri }} style={styles.preview} />
                        )}

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => takePhoto('back')}
                        >
                            <Text style={styles.primaryButtonText}>
                                {idBack ? 'Retake Photo' : 'Take Photo'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => setStep(4)}
                        >
                            <Text style={styles.secondaryButtonText}>
                                {idBack ? 'Continue →' : 'Skip (Optional)'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                );

            case 4:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepIcon}>🤳</Text>
                        <Text style={styles.stepTitle}>Take a Selfie</Text>
                        <Text style={styles.stepText}>
                            Take a clear selfie for identity verification
                        </Text>

                        <View style={styles.tipsCard}>
                            <Text style={styles.tipsTitle}>Selfie Guidelines:</Text>
                            <Text style={styles.tipText}>• Face the camera directly</Text>
                            <Text style={styles.tipText}>• Remove glasses and hat</Text>
                            <Text style={styles.tipText}>• Ensure good lighting</Text>
                            <Text style={styles.tipText}>• Keep a neutral expression</Text>
                        </View>

                        {selfie && (
                            <Image source={{ uri: selfie.uri }} style={styles.preview} />
                        )}

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => takePhoto('selfie')}
                        >
                            <Text style={styles.primaryButtonText}>
                                {selfie ? 'Retake Selfie' : 'Take Selfie'}
                            </Text>
                        </TouchableOpacity>

                        {selfie && (
                            <TouchableOpacity
                                style={[styles.submitButton, loading && styles.buttonDisabled]}
                                onPress={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.submitButtonText}>
                                        Submit Verification
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>KYC Verification</Text>
                <View style={{ width: 50 }} />
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressContainer}>
                {[1, 2, 3, 4].map((s) => (
                    <View
                        key={s}
                        style={[
                            styles.progressDot,
                            s <= step && styles.progressDotActive,
                        ]}
                    />
                ))}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {renderStep()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 12,
    },
    progressDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.border,
    },
    progressDotActive: {
        backgroundColor: colors.primary,
        width: 32,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    stepContainer: {
        alignItems: 'center',
    },
    stepIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    stepText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    requirementCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 20,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    requirementTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 12,
    },
    requirementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    bulletPoint: {
        fontSize: 18,
        color: colors.success,
        marginRight: 12,
        fontWeight: 'bold',
    },
    requirementText: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },
    tipsCard: {
        backgroundColor: colors.primary + '10',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    tipsTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
    },
    tipText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    preview: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 20,
        backgroundColor: colors.border,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    secondaryButton: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary,
    },
    submitButton: {
        backgroundColor: colors.success,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});