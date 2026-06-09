// backend/config/db.js
const db = require('./sqlite-wrapper');
const crypto = require('crypto');

// Helper to generate UUID-like IDs
function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

module.exports = { db, generateId };
