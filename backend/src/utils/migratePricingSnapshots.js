import { connectDB } from '../config/db.js';
import Booking from '../models/Booking.js';
import dotenv from 'dotenv';
dotenv.config();

export const migratePricingSnapshots = async ({ dryRun = false } = {}) => {
    console.log(`Starting Pricing Snapshot Migration (Dry Run: ${dryRun})...`);
    await connectDB();

    const bookingsWithoutSnapshot = await Booking.find({
        $or: [
            { pricingSnapshot: { $exists: false } },
            { pricingSnapshot: null },
            { 'pricingSnapshot.pricingVersion': { $exists: false } },
        ],
    });

    console.log(`Found ${bookingsWithoutSnapshot.length} bookings requiring pricing snapshot backfill.`);
    let migratedCount = 0;

    for (const booking of bookingsWithoutSnapshot) {
        const basePaise = booking.baseAmount || 0;
        const platformFeePaise = booking.platformFee || 5000;
        const taxPaise = booking.taxAmount || 0;
        const discountPaise = booking.discountAmount || 0;
        const totalPaise = booking.totalAmount || (basePaise + platformFeePaise + taxPaise - discountPaise);
        const commPct = booking.commissionPercentage || 10;
        const commPaise = booking.commissionAmount || Math.round((basePaise * commPct) / 100);
        const workerEarningPaise = booking.workerEarning || Math.max(0, basePaise - commPaise);

        const legacySnapshot = {
            pricingVersion: 1,
            currency: booking.currency || 'INR',
            pricingType: booking.pricingType || 'HOURLY',
            rateSource: 'LEGACY_MIGRATION',
            hourlyRatePaise: 0,
            dailyRatePaise: 0,
            durationMinutes: booking.durationMinutes || 60,
            durationDays: 0,
            rawServiceAmountPaise: basePaise,
            minimumChargeAdjustmentPaise: 0,
            baseAmountPaise: basePaise,
            couponId: null,
            couponCodeMasked: null,
            discountType: null,
            discountValue: 0,
            discountAmountPaise: discountPaise,
            serviceAmountAfterDiscountPaise: Math.max(0, basePaise - discountPaise),
            platformFeeType: 'FIXED',
            platformFeeBps: 0,
            platformFeeFixedPaise: platformFeePaise,
            platformFeeAmountPaise,
            taxEnabled: taxPaise > 0,
            taxRateBps: taxPaise > 0 ? 1800 : 0,
            taxApplicationMode: 'EXCLUSIVE',
            taxableAmountPaise: basePaise + platformFeePaise - discountPaise,
            taxAmountPaise: taxPaise,
            customerTotalPaise: totalPaise,
            commissionRuleId: null,
            commissionRuleVersion: 1,
            commissionRuleName: 'Legacy Migration Snapshot',
            commissionScope: 'GLOBAL_LEGACY',
            commissionCalculationType: 'PERCENTAGE',
            commissionPercentageBps: Math.round(commPct * 100),
            commissionFixedAmountPaise: 0,
            minimumCommissionPaise: 0,
            maximumCommissionPaise: null,
            commissionBasePaise: basePaise,
            commissionAmountPaise: commPaise,
            workerEarningPaise,
            surgeRuleId: null,
            surgeMultiplierBps: 10000,
            calculatedAt: booking.createdAt || new Date(),
        };

        if (!dryRun) {
            booking.pricingSnapshot = legacySnapshot;
            await booking.save();
        }
        migratedCount++;
    }

    console.log(`Successfully processed ${migratedCount} bookings.`);
    return migratedCount;
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    const isDryRun = process.argv.includes('--dry-run');
    migratePricingSnapshots({ dryRun: isDryRun })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
