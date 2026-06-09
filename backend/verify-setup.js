#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 NextGen Bank Backend - Setup Verification\n');

const checks = {
    folders: [
        'routes',
        'config'
    ],
    files: [
        'server.js',
        'package.json',
        '.env',
        'routes/auth.js',
        'config/db.js',
        'config/sqlite-wrapper.js',
        'config/sqlite-setup.js'
    ]
};

let allGood = true;

// Check folders
console.log('📁 Checking folders...');
checks.folders.forEach(folder => {
    if (fs.existsSync(folder)) {
        console.log(`   ✅ ${folder}/`);
    } else {
        console.log(`   ❌ ${folder}/ - MISSING`);
        allGood = false;
    }
});

// Check files
console.log('\n📄 Checking files...');
checks.files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - MISSING`);
        allGood = false;
    }
});

// Check if node_modules exists
console.log('\n📦 Checking dependencies...');
if (fs.existsSync('node_modules')) {
    console.log('   ✅ node_modules/ - Dependencies installed');
} else {
    console.log('   ⚠️  node_modules/ - Run "npm install"');
    allGood = false;
}

// Check database
console.log('\n🗄️  Checking database...');
if (fs.existsSync('nextgen_bank.db')) {
    console.log('   ✅ nextgen_bank.db - Database exists');
} else {
    console.log('   ⚠️  nextgen_bank.db - Run "npm run setup-db"');
}

console.log('\n' + '='.repeat(50));
if (allGood) {
    console.log('✅ All checks passed! Your backend is ready.');
    console.log('\nNext steps:');
    console.log('1. Run "npm install" (if not done)');
    console.log('2. Run "npm run setup-db" (if database missing)');
    console.log('3. Run "npm start" to start the server');
} else {
    console.log('❌ Some issues found. Please fix them before starting.');
}
console.log('='.repeat(50) + '\n');
