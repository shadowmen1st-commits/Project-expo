import mongoose from 'mongoose';
import config from '../config/env.js';
import Booking from '../models/Booking.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import WorkerEarning from '../models/WorkerEarning.js';
import WorkerWallet from '../models/WorkerWallet.js';
import crypto from 'crypto';

async function migrate() {
    console.log('🚀 Starting ledger migration / backfill...');
    try {
        await mongoose.connect(config.MONGODB_URI);
        console.log('Connected to Database successfully.');

        // 1. Process Payment Transactions
        console.log('Processing past verified payment transactions...');
        const txns = await PaymentTransaction.find({ status: 'VERIFIED' });
        let paymentMigrated = 0;
        
        for (const t of txns) {
            const booking = await Booking.findById(t.bookingId);
            if (!booking) continue;
            
            const idempotencyKey = `PAYMENT_CAPTURED:${t.providerPaymentId}`;
            const res = await LedgerPostingService.postPaymentCaptured(
                booking,
                t.paymentOrderId,
                t._id,
                t.providerPaymentId,
                { actorId: 'SYSTEM_MIGRATION' }
            );
            if (!res.alreadyProcessed) {
                paymentMigrated++;
            }
        }
        console.log(`✅ Payment transactions processed. Migrated: ${paymentMigrated}.`);

        // 2. Process Completed Bookings
        console.log('Processing past completed bookings...');
        const bookings = await Booking.find({ bookingStatus: 'COMPLETED', paymentStatus: 'PAID' });
        let bookingsMigrated = 0;

        for (const booking of bookings) {
            const idempotencyKey = `BOOKING_COMPLETION_ALLOCATION:${booking._id}`;
            
            // Check if already processed
            const exists = await WorkerEarning.findOne({ bookingId: booking._id });
            if (exists) continue;

            const snap = booking.pricingSnapshot || {};
            const totalAmount = snap.customerTotalPaise || booking.totalAmount;
            const workerEarning = snap.workerEarningPaise || booking.workerEarning;
            const commissionAmount = snap.commissionAmountPaise || booking.commissionAmount;
            const platformFee = snap.platformFeeAmountPaise || booking.platformFee || 0;
            const taxAmount = snap.taxAmountPaise || booking.taxAmount || 0;
            const discountAmount = snap.discountAmountPaise || booking.discountAmount || 0;

            // Balance validation
            const totalDebits = totalAmount + discountAmount;
            const totalCredits = workerEarning + commissionAmount + platformFee + taxAmount;

            if (totalDebits !== totalCredits) {
                console.warn(`⚠️ Skipped unbalanced booking ${booking.bookingNumber}. Debits: ${totalDebits}, Credits: ${totalCredits}`);
                continue;
            }

            // Post allocation
            const res = await LedgerPostingService.postBookingCompletionAllocation(
                booking,
                { userId: 'SYSTEM_MIGRATION', role: 'SYSTEM' },
                { actorId: 'SYSTEM_MIGRATION' }
            );

            if (!res.alreadyProcessed) {
                bookingsMigrated++;

                // Check if completed more than 24 hours ago, if so, release immediately
                const completedTime = booking.completedAt || booking.updatedAt || new Date();
                const hoursSinceCompletion = (Date.now() - new Date(completedTime).getTime()) / (1000 * 60 * 60);

                if (hoursSinceCompletion >= (config.PAYMENT_SETTLEMENT_HOLD_HOURS || 24)) {
                    const earning = await WorkerEarning.findOne({ bookingId: booking._id });
                    if (earning && earning.status === 'PENDING') {
                        await LedgerPostingService.postSettlementRelease(earning, { actorId: 'SYSTEM_MIGRATION' });
                    }
                }
            }
        }
        console.log(`✅ Completed bookings processed. Migrated: ${bookingsMigrated}.`);

        // 3. Rebuild and Sync Worker Wallets
        console.log('Rebuilding all worker wallet cache projections...');
        const workers = await Booking.distinct('workerId');
        for (const workerId of workers) {
            if (workerId) {
                await LedgerPostingService.syncWorkerWallet(workerId);
            }
        }
        console.log('✅ Worker wallets synchronization completed.');

        console.log('🎉 Ledger migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
