// backend/services/mpesa.js
// Make sure dotenv is loaded
require('dotenv').config();

const RealMPesaService = require('./mpesa-real');


// Check if the value is 'true' (case-insensitive)
const USE_REAL_MPESA = process.env.USE_REAL_MPESA?.toLowerCase() === 'true';

let mpesaService;

if (USE_REAL_MPESA) {
    console.log('🔧 ✅ Using REAL M-Pesa Daraja API');
    mpesaService = RealMPesaService;
} else {
    console.log('   To use REAL M-Pesa, set USE_REAL_MPESA=true in .env');
}

module.exports = mpesaService;