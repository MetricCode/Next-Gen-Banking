// backend/services/twoFactorService.js
// COMPLETE FIXED VERSION

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

class TwoFactorService {
    // Generate 2FA secret and QR code
    async generateSecret(email) {
        const secret = speakeasy.generateSecret({
            name: `NextGenBank:${email}`,
            length: 20
        });
        
        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);
        
        return {
            secret: secret.base32,
            qrCode: qrCodeDataURL,
            otpauthUrl: secret.otpauth_url
        };
    }
    
    // Verify TOTP token
    verifyToken(secret, token) {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 1 // Allow 1 step window for time drift
        });
    }
    
    // Generate backup codes
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            // Generate 8-character backup code
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            codes.push(code);
        }
        console.log('✅ Generated', codes.length, 'backup codes');
        return codes;
    }
    
    // Verify backup code - FIXED VERSION with case-insensitive comparison
    verifyBackupCode(backupCodes, code) {
        try {
            // Parse stored codes from JSON
            const codes = JSON.parse(backupCodes || '[]');
            
            // Validate we have codes
            if (!Array.isArray(codes) || codes.length === 0) {
                console.log('❌ No backup codes stored or invalid format');
                return { valid: false, remainingCodes: null };
            }
            
            // Normalize input: remove whitespace and convert to uppercase
            const normalizedInput = code.trim().toUpperCase();
            
            console.log('🔍 Verifying backup code:');
            console.log('   Input (normalized):', normalizedInput);
            console.log('   Stored codes count:', codes.length);
            console.log('   Stored codes:', codes);
            
            // Find the code with case-insensitive comparison
            const index = codes.findIndex(storedCode => 
                storedCode.trim().toUpperCase() === normalizedInput
            );
            
            if (index !== -1) {
                console.log('✅ Backup code found at index:', index);
                // Remove the used backup code
                codes.splice(index, 1);
                console.log('💾 Remaining backup codes:', codes.length);
                return { valid: true, remainingCodes: codes };
            }
            
            console.log('❌ Backup code not found in stored codes');
            return { valid: false, remainingCodes: null };
            
        } catch (error) {
            console.error('❌ Error parsing/verifying backup codes:', error);
            return { valid: false, remainingCodes: null };
        }
    }
}

module.exports = new TwoFactorService();