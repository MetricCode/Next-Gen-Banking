# NextGen Bank - Frontend (React Native + Expo)

Beautiful mobile banking app with authentication and dashboard.

## 🚀 Features

✅ **Authentication**
- Beautiful login screen
- Registration with validation
- JWT token management
- Secure password handling

✅ **Dashboard**
- Account balance overview
- Multiple accounts support
- Quick actions menu
- Transaction history
- Pull-to-refresh

✅ **UI/UX**
- Modern, clean design
- Smooth animations
- Responsive layout
- Loading states
- Error handling

## 📁 Project Structure

```
frontend/
├── src/
│   ├── screens/
│   │   ├── LoginScreen.js      # Login page
│   │   ├── RegisterScreen.js   # Registration
│   │   └── DashboardScreen.js  # Main dashboard
│   ├── navigation/
│   │   └── AppNavigator.js     # Navigation setup
│   ├── services/
│   │   └── api.js              # API calls & auth
│   └── utils/
│       └── colors.js           # Theme colors
├── App.js                       # Main app component
├── app.json                     # Expo config
└── package.json
```

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Backend URL

Open `src/services/api.js` and update the API URL:

```javascript
// For Android Emulator
const API_BASE_URL = 'http://10.0.2.2:5000/api';

// For iOS Simulator
const API_BASE_URL = 'http://localhost:5000/api';

// For Physical Device (replace with your computer's IP)
const API_BASE_URL = 'http://192.168.1.100:5000/api';
```

**To find your computer's IP:**
- **Windows**: `ipconfig` (look for IPv4 Address)
- **Mac/Linux**: `ifconfig` or `ip addr show`

### 3. Start the App

```bash
# Start Expo development server
npm start

# Or directly on Android
npm run android

# Or directly on iOS
npm run ios
```

### 4. Scan QR Code

- Install **Expo Go** app on your phone
- Scan the QR code shown in terminal
- App will load on your device

## 📱 Screens

### Login Screen
- Email and password fields
- Test account credentials shown
- Link to registration
- Beautiful gradient design

### Register Screen
- Full name, email, phone, ID number
- Password with confirmation
- Form validation
- Auto-login after registration

### Dashboard Screen
- Total balance card
- Quick actions (Send, M-Pesa, Deposit, History)
- Account list with balances
- Transaction history placeholder
- Logout functionality

## 🧪 Test Account

```
Email: john.doe@example.com
Password: Test@123
```

## 🎨 Customization

### Colors
Edit `src/utils/colors.js`:
```javascript
export const colors = {
    primary: '#4F46E5',    // Change main color
    secondary: '#10B981',
    // ... more colors
};
```

### Logo
Replace the emoji in `LoginScreen.js`:
```javascript
<Text style={styles.logoText}>💳</Text>  // Change this
```

## 🔧 Common Issues

### Issue: "Network Error" when logging in
**Solution:** 
1. Make sure backend server is running (`npm start` in backend folder)
2. Check API_BASE_URL in `src/services/api.js`
3. For physical device, use your computer's IP address
4. Make sure phone and computer are on same WiFi network

### Issue: "Cannot connect to Metro"
**Solution:**
```bash
# Clear Expo cache
npm start -- --clear

# Or
expo start -c
```

### Issue: App crashes on startup
**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Clear watchman (Mac/Linux)
watchman watch-del-all
```

## 🌐 Testing on Different Platforms

### Android Emulator
```bash
npm run android
```
API URL: `http://10.0.2.2:5000/api`

### iOS Simulator
```bash
npm run ios
```
API URL: `http://localhost:5000/api`

### Physical Device
1. Connect to same WiFi as computer
2. Find computer's IP address
3. Update API_BASE_URL to `http://YOUR_IP:5000/api`
4. Scan QR code in Expo Go app

## 📝 API Integration

All API calls are in `src/services/api.js`:

```javascript
// Login
await authAPI.login({ email, password });

// Register
await authAPI.register({
    fullName,
    email,
    phoneNumber,
    idNumber,
    password
});

// Get accounts
await authAPI.getAccounts();

// Logout
await authAPI.logout();
```

## 🔐 Authentication Flow

1. User enters credentials
2. API call to backend `/api/auth/login`
3. Token saved to AsyncStorage
4. Navigate to Dashboard
5. Token automatically added to all API requests
6. Logout clears token and redirects to Login

## 🚀 Next Steps

### Features to Add:
- [ ] Send money functionality
- [ ] M-Pesa integration
- [ ] Transaction history with details
- [ ] Profile settings
- [ ] Biometric authentication
- [ ] Push notifications
- [ ] QR code payments
- [ ] Bill payments
- [ ] Chatbot support

### Screens to Create:
- `TransferScreen.js` - Send money
- `TransactionHistoryScreen.js` - Full transaction list
- `ProfileScreen.js` - User profile & settings
- `MPesaScreen.js` - M-Pesa integration
- `BeneficiariesScreen.js` - Saved recipients

## 📚 Technologies Used

- **React Native** - Mobile framework
- **Expo** - Development platform
- **React Navigation** - Screen navigation
- **Axios** - HTTP requests
- **AsyncStorage** - Local storage
- **React Native Safe Area Context** - Safe area handling

## 🤝 Contributing

1. Create new screens in `src/screens/`
2. Add routes to `src/navigation/AppNavigator.js`
3. Create API functions in `src/services/api.js`
4. Use colors from `src/utils/colors.js`

## 📄 License

This project is for educational purposes.

---

**Need Help?** Check the backend README for API documentation.

## Quick Start Checklist

- [ ] Backend server running (`npm start` in backend folder)
- [ ] Database setup done (`npm run setup-db` in backend)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] API URL configured in `api.js`
- [ ] Expo app started (`npm start`)
- [ ] App loaded on device/emulator
- [ ] Logged in with test account

🎉 You're all set! Happy coding!
