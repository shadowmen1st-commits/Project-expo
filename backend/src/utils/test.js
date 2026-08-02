import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { encryptText, decryptText, maskDocumentNumber } from './crypto.js';
import { calculatePricing } from '../services/pricing.js';
import { recordTransaction, getWalletBalances } from '../services/ledger.js';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_marketplace';
const runTests = async () => {
    console.log('\n======================================');
    console.log('  STARTING SYSTEM INTEGRATION CHECKS  ');
    console.log('======================================\n');
    let passed = 0;
    let failed = 0;
    const assert = (condition, message) => {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passed++;
        }
        else {
            console.log(`[FAIL] ${message}`);
            failed++;
        }
    };
    try {
        // Connect to database
        await mongoose.connect(MONGODB_URI);
        console.log('[INFO] Database connected.');
        // 1. Check Cryptography utilities
        console.log('\n--- Checking Cryptography & Masking ---');
        const secret = '1234-5678-9012';
        const encrypted = encryptText(secret);
        const decrypted = decryptText(encrypted);
        assert(decrypted === secret, 'Encrypt/Decrypt value matches original');
        const maskedAadhaar = maskDocumentNumber('AADHAAR', '123456789012');
        assert(maskedAadhaar === 'XXXX-XXXX-9012', 'Aadhaar masking format matches XXXX-XXXX-9012');
        const maskedPan = maskDocumentNumber('PAN', 'ABCDE1234F');
        assert(maskedPan === 'XXXXXX234F', 'PAN masking format matches XXXXXX234F');
        // 2. Check Pricing service
        console.log('\n--- Checking Pricing Engine Calculations ---');
        const worker = await User.findOne({ role: 'WORKER' });
        const category = await ServiceCategory.findOne();
        if (worker && category) {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
            const details = await calculatePricing({
                workerId: worker._id.toString(),
                categoryId: category._id.toString(),
                startDate: now,
                endDate: tomorrow,
                pricingType: 'HOURLY',
            });
            console.log(`[INFO] Computed Total Bill: ${(details.totalAmount / 100).toFixed(2)} INR`);
            console.log(`[INFO] Commission deducted: ${(details.commissionAmount / 100).toFixed(2)} INR`);
            console.log(`[INFO] Worker Earning: ${(details.workerEarning / 100).toFixed(2)} INR`);
            assert(details.baseAmount > 0, 'Base amount computed successfully');
            assert(details.platformFee === 5000, 'Platform fee set to flat 50.00 INR (5000 paise)');
            assert(details.taxAmount === Math.round(((details.baseAmount + details.platformFee) * 18) / 100), 'GST tax computed accurately at 18%');
            assert(details.totalAmount === details.baseAmount + details.platformFee + details.taxAmount, 'Total is sum of base + fee + tax');
        }
        else {
            console.log('[WARN] Worker or category not found, skipping pricing checks.');
        }
        // 3. Check Wallet Ledger Double Entry
        console.log('\n--- Checking Wallet Ledger & double-entry balances ---');
        const customer = await User.findOne({ role: 'CUSTOMER' });
        if (customer) {
            // Record a test deposit
            const idempotencyKey = `TEST-DEP-${Date.now()}`;
            await recordTransaction({
                userId: customer._id.toString(),
                debitAccount: 'CUSTOMER_BANK',
                creditAccount: 'USER_WALLET',
                amount: 100000, // 1000 INR
                transactionType: 'DEPOSIT',
                idempotencyKey,
                status: 'COMPLETED',
            });
            const balances = await getWalletBalances(customer._id.toString());
            assert(balances.available >= 100000, 'Available balance sums completed deposits correctly');
        }
        else {
            console.log('[WARN] Customer not found, skipping ledger balances checks.');
        }
        // Print summary
        console.log('\n======================================');
        console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log('======================================\n');
        // Close database connection
        await mongoose.disconnect();
        process.exit(failed > 0 ? 1 : 0);
    }
    catch (err) {
        console.error('Test execution failed with exception:', err);
        process.exit(1);
    }
};
runTests();
