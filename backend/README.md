# NextGen Bank Backend - Setup Instructions

## Error Fixes Applied

1. ✅ Fixed folder structure (created `routes/` and `config/` folders)
2. ✅ Fixed import paths in all files
3. ✅ Added proper error handling in server.js
4. ✅ Created .env file for environment variables
5. ✅ Added health check endpoint

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
npm run setup-db
```

This will create the SQLite database with all tables and test users.

### 3. Test Database Connection
```bash
npm run test-db
```

### 4. Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## Test Users

After running `setup-db`, you'll have these test accounts:

**User 1:**
- Email: john.doe@example.com
- Password: Test@123
- Account: 1000000001 (Balance: KES 25,000)

**User 2:**
- Email: jane.smith@example.com
- Password: Test@123
- Account: 1000000002 (Balance: KES 15,000)

## API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET /api/auth/accounts (requires token)
```

## Common Issues & Solutions

### Error: "Cannot find module './routes/auth'"
**Solution:** Make sure you have the correct folder structure:
```
backend/
├── routes/
│   └── auth.js
├── config/
│   ├── db.js
│   ├── sqlite-wrapper.js
│   └── sqlite-setup.js
├── server.js
├── package.json
└── .env
```

### Error: "Database connection error"
**Solution:** Run `npm run setup-db` to create the database

### Error: "Port 5000 already in use"
**Solution:** Change PORT in .env file or kill the process using port 5000

## Folder Structure
```
backend/
├── config/
│   ├── db.js              # Database connection & helpers
│   ├── sqlite-wrapper.js  # SQLite Promise wrapper
│   └── sqlite-setup.js    # Database schema & setup
├── routes/
│   └── auth.js           # Authentication routes
├── server.js             # Main server file
├── test-sqlite.js        # Database test script
├── package.json          # Dependencies
├── .env                  # Environment variables
└── nextgen_bank.db       # SQLite database (created after setup)
```

## Next Steps

1. Create additional route files:
   - `routes/accounts.js` - Account management
   - `routes/transactions.js` - Transaction handling

2. Add middleware:
   - `middleware/auth.js` - JWT verification
   - `middleware/validation.js` - Input validation

3. Implement remaining features:
   - M-Pesa integration
   - Fraud detection
   - Chatbot support

## Testing with Postman/cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phoneNumber": "0700000000",
    "idNumber": "12345679",
    "password": "Test@123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "Test@123"
  }'
```

### Get Accounts (use token from login response)
```bash
curl -X GET http://localhost:5000/api/auth/accounts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
