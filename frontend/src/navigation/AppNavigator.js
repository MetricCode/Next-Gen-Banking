// src/navigation/AppNavigator.js
// COMPLETE VERSION WITH KYC SCREENS

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// 2FA Screens
import TwoFactorSetupScreen from '../screens/TwoFactorSetupScreen';
import TwoFactorVerifyScreen from '../screens/TwoFactorVerifyScreen';

// Main App Screens
import DashboardScreen from '../screens/DashboardScreen';
import TransferScreen from '../screens/TransferScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import TransactionDetailScreen from '../screens/TransactionDetailScreen';
import MPesaScreen from '../screens/MPesaScreen';
import BeneficiariesScreen from '../screens/BeneficiariesScreen';
import ProfileScreen from '../screens/ProfileScreen';

// KYC Screens (NEW)
import KYCVerificationScreen from '../screens/KYCVerificationScreen';
import KYCStatusScreen from '../screens/KYCStatusScreen';

// Add import
import CryptoDepositScreen from '../screens/CryptoDepositScreen';
import CryptoHistoryScreen from '../screens/CryptoHistoryScreen';






const Stack = createStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{
                    headerShown: false,
                    cardStyleInterpolator: ({ current: { progress } }) => ({
                        cardStyle: {
                            opacity: progress,
                        },
                    }),
                }}
            >
                {/* ==================== AUTH SCREENS ==================== */}
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                
                {/* ==================== 2FA SCREENS ==================== */}
                <Stack.Screen name="TwoFactorSetup" component={TwoFactorSetupScreen} />
                <Stack.Screen name="TwoFactorVerify" component={TwoFactorVerifyScreen} />
                
                {/* ==================== CRYPTO SCREENS ==================== */}
                <Stack.Screen name="CryptoDeposit" component={CryptoDepositScreen} />
                <Stack.Screen name="CryptoHistory" component={CryptoHistoryScreen} />
                
                {/* ==================== KYC SCREENS ==================== */}
                <Stack.Screen 
                    name="KYCVerification" 
                    component={KYCVerificationScreen}
                    options={{
                        gestureEnabled: false, // Prevent back swipe during verification
                    }}
                />
                <Stack.Screen 
                    name="KYCStatus" 
                    component={KYCStatusScreen} 
                />
                
                {/* ==================== MAIN APP SCREENS ==================== */}
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="Transfer" component={TransferScreen} />
                <Stack.Screen name="Beneficiaries" component={BeneficiariesScreen} />
                <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
                <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
                <Stack.Screen name="MPesa" component={MPesaScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}