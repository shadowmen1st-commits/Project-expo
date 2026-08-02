import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Refund from '../models/Refund.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import RefundAllocationService from '../services/payments/RefundAllocationService.js';
import { connectDB } from '../config/db.js';

async function runMigration() {
    await connectDB();

    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || !args.includes('--apply');

    console.log(`[REFUND MIGRATION] Starting migration backfill...`);
    console.log(`[REFUND MIGRATION] Mode: ${isDryRun ? 'DRY-RUN (No writes)' : 'APPLY (Modifying Database)'}`);

    const refundedBookings = await Booking.find({ paymentStatus: 'REFUNDED' });

    let inspected = 0;
    let eligible = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const booking of refundedBookings) {
        inspected++;
        try {
            // Check if Refund document already exists
            const exists = await Refund.exists({ bookingId: booking._id });
            if (exists) {
                skipped++;
                continue;
            }

            eligible++;
            if (isDryRun) {
                continue;
            }

            // Create refund backfill
            const paymentTx = await PaymentTransaction.findOne({ bookingId: booking._id, status: 'VERIFIED' });
            if (!paymentTx) {
                console.warn(`  - Skipped booking ${booking.bookingNumber}: No verified payment transaction found.`);
                failed++;
                continue;
            }

            const refundNumber = `REF-MIG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
            const idempotencyKey = `REFUND_MIGRATION:${booking._id}`;

            const allocRes = await RefundAllocationService.allocateRefund({
                bookingId: booking._id,
                approvedRefundAmountPaise: booking.totalAmount, // Assume full refund for migration
            });

            if (allocRes.status !== 'SUCCESS') {
                console.error(`  - Failed to allocate migration refund for booking ${booking.bookingNumber}: ${allocRes.error}`);
                failed++;
                continue;
            }

            const refund = new Refund({
                refundNumber,
                bookingId: booking._id,
                customerId: booking.customerId,
                workerId: booking.workerId,
                paymentOrderId: paymentTx.paymentOrderId,
                paymentTransactionId: paymentTx._id,
                providerPaymentId: paymentTx.providerPaymentId,
                refundType: 'FULL',
                refundReason: 'Migration backfill of legacy refunded booking',
                requestedAmountPaise: booking.totalAmount,
                approvedAmountPaise: booking.totalAmount,
                currency: 'INR',
                status: 'PROCESSED', // Legacy refunds already processed
                source: 'SYSTEM_CORRECTION',
                allocationSnapshot: allocRes.allocation,
                idempotencyKey,
                requestedByType: 'SYSTEM',
                requestedById: booking.customerId, // fallback
            });

            await refund.save();

            // Post double-entry refund approval and processed ledger entries
            await LedgerPostingService.postRefundApproval(refund);
            await LedgerPostingService.postRefundProcessed(refund);

            migrated++;
        } catch (err) {
            console.error(`  - Error processing booking ${booking.bookingNumber}:`, err);
            failed++;
        }
    }

    console.log(`\n==================================================`);
    console.log(`REFUND MIGRATION COMPLETE SUMMARY`);
    console.log(`==================================================`);
    console.log(`- Inspected: ${inspected}`);
    console.log(`- Eligible: ${eligible}`);
    console.log(`- Migrated: ${migrated}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Failed: ${failed}`);
    console.log(`==================================================\n`);

    await mongoose.connection.close();
}

runMigration().catch(err => {
    console.error(err);
    process.exit(1);
});
