# 🏦 NextGen Bank

An AI-powered mobile banking application built for the Kenyan market. NextGen Bank combines traditional banking, M-Pesa mobile money, cryptocurrency deposits, two-factor authentication, and KYC identity verification in a single platform.

---

## 📱 What the System Does

Users can register and log in securely, create Savings, Checking, or Crypto Wallet accounts, deposit and withdraw money via M-Pesa, deposit cryptocurrency (USDT TRC20 or Litecoin), transfer funds between accounts, and view full transaction history. An admin web portal gives bank staff oversight of all users, accounts, transactions, and crypto deposits.

---

## 🗂 Project Structure

```
NextGen-Bank/
├── backend/          # Node.js + Express REST API
│   ├── config/       # Database setup (SQLite)
│   ├── routes/       # API route handlers
│   └── services/     # M-Pesa, NOWPayments, Smile Identity, 2FA logic
│
└── frontend/         # React Native mobile app (Expo)
    └── src/
        ├── screens/  # All app screens
        ├── services/ # API calls (api.js)
        └── utils/    # Colors, helpers
```

---

## ⚙️ Technologies & Integrations

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) — iOS & Android |
| Backend API | Node.js + Express |
| Database | SQLite (via sqlite3) |
| Authentication | JWT (JSON Web Tokens) + bcrypt |
| Two-Factor Auth | TOTP via `speakeasy` + `qrcode` (Google Authenticator compatible) |
| M-Pesa | Safaricom Daraja API — STK Push for deposits |
| Cryptocurrency | NOWPayments API — USDT (TRC20) & Litecoin (LTC) with IPN callbacks |
| KYC Verification | Smile Identity — National ID verification for Kenyan users |
| Tunneling | ngrok — exposes local server for M-Pesa & NOWPayments callbacks |

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
# Server
PORT=5000
JWT_SECRET=your_jwt_secret_here

# M-Pesa (Safaricom Daraja)
USE_REAL_MPESA=false
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_PASSKEY=your_passkey
MPESA_SHORTCODE=174379
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/mpesa/callback

# NOWPayments (Crypto)
NOWPAYMENTS_API_KEY=your_api_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret
NOWPAYMENTS_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/crypto/ipn

# Smile Identity (KYC)
USE_REAL_SMILE=false
SMILE_PARTNER_ID=your_partner_id
SMILE_API_KEY=your_api_key
SMILE_ENVIRONMENT=sandbox
SMILE_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/kyc/smile-callback

# Frontend URL (for IPN callbacks)
API_URL=https://your-ngrok-url.ngrok-free.app
```

> **Note:** When `USE_REAL_MPESA=false` and `USE_REAL_SMILE=false`, the system runs in mock/sandbox mode — safe for development and testing without real API calls.

---

## 🚀 Running the Project

Open **three terminals** and run each command in order:

### Terminal 1 — Start ngrok (public tunnel for callbacks)
```bash
ngrok http 3000
```
Copy the `https://` forwarding URL and paste it into your `.env` as the callback URLs above.

### Terminal 2 — Start the Backend Server
```bash
cd backend
node server.js
```
The API will be running at `http://localhost:5000`

### Terminal 3 — Start the Mobile App
```bash
cd frontend
npx expo start -c
```
Scan the QR code with the **Expo Go** app on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## 📋 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login (returns JWT or 2FA prompt) |
| POST | `/api/auth/verify-2fa-login` | Complete login with TOTP code |
| GET | `/api/transfers/accounts` | Get user's accounts |
| POST | `/api/transfers/internal-transfer` | Transfer between accounts |
| POST | `/api/mpesa/deposit` | Initiate M-Pesa STK Push deposit |
| POST | `/api/crypto/deposit` | Create a crypto deposit address |
| GET | `/api/crypto/history` | Get crypto deposit history |
| GET | `/api/transactions/history` | Get full transaction history |
| POST | `/api/kyc/verify` | Submit KYC identity verification |
| GET | `/api/kyc/status` | Check KYC verification status |

---

## 🔐 Security Features

- Passwords hashed with **bcrypt** (cost factor 10)
- Sessions managed with signed **JWT tokens** (24-hour expiry)
- **TOTP-based 2FA** — immune to SIM-swap attacks unlike SMS OTP
- **HMAC-SHA512** signature verification on all NOWPayments IPN callbacks
- **Role-based access control** separating user and admin routes
- KYC verification required before transfers and account creation

---

## 👤 Admin Portal

The admin portal is accessible at:
```
http://localhost:5000/admin/index.html
```
It provides dashboards for user management, account oversight, transaction history, and cryptocurrency deposit tracking.

---

## 📦 Installing Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```
