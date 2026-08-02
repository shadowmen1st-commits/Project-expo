import mongoose from 'mongoose';
import config from '../config/env.js';
import SettlementReleaseService from '../services/payments/SettlementReleaseService.js';

async function runSweep() {
    console.log('🚀 Starting settlement hold release sweep...');
    try {
        await mongoose.connect(config.MONGODB_URI);
        console.log('Connected to Database successfully.');

        const result = await SettlementReleaseService.releaseEligibleEarnings({
            actorId: 'SYSTEM_SWEEP',
            requestId: `sweep-${Date.now()}`,
        });

        console.log(`✅ Sweep completed. Processed: ${result.processedCount} earnings. Total released: ${(result.totalReleasedAmount / 100).toFixed(2)} INR.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Sweep failed with error:', error);
        process.exit(1);
    }
}

runSweep();
