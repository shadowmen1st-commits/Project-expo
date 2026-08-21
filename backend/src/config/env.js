import dotenv from 'dotenv';
import path from 'path';
import { validateProductionEnvironment } from './productionConfigValidator.js';

// Force dotenv to load
dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '5001', 10);
const MONGODB_URI = process.env.MONGODB_URI;
const CUSTOMER_APP_URL = process.env.CUSTOMER_APP_URL;
const WEB_ADMIN_URL = process.env.WEB_ADMIN_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || CUSTOMER_APP_URL;
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS;

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const PAYOUT_DATA_ENCRYPTION_KEY = process.env.PAYOUT_DATA_ENCRYPTION_KEY || '';
const PAYOUT_DATA_ENCRYPTION_KEY_VERSION = process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION || 'v1';
const PAYOUT_PROVIDER = process.env.PAYOUT_PROVIDER || 'razorpayx';
const PAYOUT_PROVIDER_MODE = process.env.PAYOUT_PROVIDER_MODE || 'test';
const PAYOUT_MINIMUM_PAISE = parseInt(process.env.PAYOUT_MINIMUM_PAISE || '10000', 10);
const PAYOUT_MAXIMUM_PAISE = parseInt(process.env.PAYOUT_MAXIMUM_PAISE || '500000', 10);
const PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE = parseInt(process.env.PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE || '200000', 10);
const PAYOUT_PROCESSING_STALE_HOURS = parseInt(process.env.PAYOUT_PROCESSING_STALE_HOURS || '24', 10);

// Razorpay variables — enforce verified credentials to prevent stale cloud environment overrides
const VERIFIED_RAZORPAY_KEY_ID = 'rzp_test_TS38Ger2YMCfWh';
const VERIFIED_RAZORPAY_KEY_SECRET = 'UVmoRQl5c51d7CoCxJqa3hvY';

const RAZORPAY_KEY_ID = VERIFIED_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = VERIFIED_RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'sandboxWebhookSecretKey1234567890abcdef';

process.env.RAZORPAY_KEY_ID = RAZORPAY_KEY_ID;
process.env.RAZORPAY_KEY_SECRET = RAZORPAY_KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = RAZORPAY_WEBHOOK_SECRET;

// Google OAuth variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_OAUTH_ENABLED = process.env.GOOGLE_OAUTH_ENABLED || 'true';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (NODE_ENV === 'production' ? 'https://project-expo-md7o.onrender.com/api/auth/oauth/google/callback' : 'http://localhost:5001/api/auth/oauth/google/callback');

if (GOOGLE_CLIENT_ID) process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;
if (GOOGLE_CLIENT_SECRET) process.env.GOOGLE_CLIENT_SECRET = GOOGLE_CLIENT_SECRET;
process.env.GOOGLE_OAUTH_ENABLED = GOOGLE_OAUTH_ENABLED;
process.env.GOOGLE_REDIRECT_URI = GOOGLE_REDIRECT_URI;

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'razorpay';
const PAYMENT_PROVIDER_MODE = process.env.PAYMENT_PROVIDER_MODE || 'live';
const PAYMENT_CURRENCY = process.env.PAYMENT_CURRENCY || 'INR';
const PAYMENT_ORDER_EXPIRY_MINUTES = parseInt(process.env.PAYMENT_ORDER_EXPIRY_MINUTES || '15', 10);
const PAYMENT_WEBHOOK_MAX_BODY_BYTES = parseInt(process.env.PAYMENT_WEBHOOK_MAX_BODY_BYTES || '102400', 10);

// Validation
const missing = [];
const requiredCore = [
    ['NODE_ENV', NODE_ENV],
    ['PORT', PORT],
    ['MONGODB_URI', MONGODB_URI],
    ['CUSTOMER_APP_URL', CUSTOMER_APP_URL],
    ['WEB_ADMIN_URL', WEB_ADMIN_URL],
    ['JWT_ACCESS_SECRET', JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', JWT_REFRESH_SECRET]
];

for (const [key, val] of requiredCore) {
    if (!val) {
        missing.push(key);
    }
}

// In production, we strictly require payment provider secrets and forbid mock mode
if (NODE_ENV === 'production') {
    validateProductionEnvironment(process.env);
}

if (missing.length > 0) {
    console.error(`CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

// Warn if test mock mode is active
if (NODE_ENV === 'test' && PAYMENT_PROVIDER_MODE === 'mock') {
    console.warn('⚠️ WARNING: Mock Payment Provider Mode is ACTIVE for testing purposes.');
}

const defaultDevOrigins = [
    'https://shadowmen.in',
    'https://www.shadowmen.in',
    'https://project-expo-ebon.vercel.app',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:19006',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:19006',
    'http://127.0.0.1:5173'
];

const parsedCorsOrigins = Array.from(new Set([
    ...(CORS_ALLOWED_ORIGINS ? CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [CUSTOMER_APP_URL, WEB_ADMIN_URL, FRONTEND_URL]),
    ...defaultDevOrigins
])).filter(Boolean);

export const config = {
    NODE_ENV,
    PORT,
    MONGODB_URI,
    CUSTOMER_APP_URL,
    WEB_ADMIN_URL,
    FRONTEND_URL,
    CORS_ALLOWED_ORIGINS: parsedCorsOrigins,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET,
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    ENCRYPTION_KEY,
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    PAYMENT_PROVIDER,
    PAYMENT_PROVIDER_MODE,
    PAYMENT_CURRENCY,
    PAYMENT_ORDER_EXPIRY_MINUTES,
    PAYMENT_WEBHOOK_MAX_BODY_BYTES,
    PAYMENT_SETTLEMENT_HOLD_HOURS: parseInt(process.env.PAYMENT_SETTLEMENT_HOLD_HOURS || '24', 10),
    PAYOUT_DATA_ENCRYPTION_KEY,
    PAYOUT_DATA_ENCRYPTION_KEY_VERSION,
    PAYOUT_PROVIDER,
    PAYOUT_PROVIDER_MODE,
    PAYOUT_MINIMUM_PAISE,
    PAYOUT_MAXIMUM_PAISE,
    PAYOUT_MANUAL_REVIEW_THRESHOLD_PAISE,
    PAYOUT_PROCESSING_STALE_HOURS,
};

export default config;
