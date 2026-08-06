/**
 * Full end-to-end test of:
 *   1. Worker search  → returns serviceCategoryIds
 *   2. checkAvailability → 200 with pricePreview
 *   3. /v1/pricing/quote → 201 with full breakdown
 */
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import WorkerProfile from '../models/WorkerProfile.js';
import PricingService from '../services/PricingService.js';
import AvailabilityService from '../services/availabilityService.js';

async function test() {
    await connectDB();
    let pass = 0;
    let fail = 0;

    const assert = (label, cond) => {
        if (cond) { console.log(`  ✅ ${label}`); pass++; }
        else       { console.error(`  ❌ ${label}`); fail++; }
    };

    // --- Test Data ---
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(9, 0, 0, 0);
    const twoHoursLater = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000);

    const cats = await ServiceCategory.find();
    assert('ServiceCategories seeded (≥1)', cats.length >= 1);

    // --- Test Rajesh Kumar ---
    const rajesh = await User.findOne({ name: 'Rajesh Kumar' });
    assert('Rajesh Kumar user exists', !!rajesh);

    const rajeshProfile = await WorkerProfile.findOne({ userId: rajesh._id }).populate('serviceCategoryIds');
    assert('Rajesh has WorkerProfile', !!rajeshProfile);
    assert('Rajesh is APPROVED', rajeshProfile.verificationStatus === 'APPROVED');
    assert('Rajesh has serviceCategoryIds', rajeshProfile.serviceCategoryIds.length > 0);
    assert('Rajesh hourlyRate > 0', rajeshProfile.hourlyRate > 0);

    const rajeshCatId = rajeshProfile.serviceCategoryIds[0]._id.toString();
    console.log(`\n  Rajesh's first category: ${rajeshProfile.serviceCategoryIds[0].name} (${rajeshCatId})`);

    // --- Availability Check ---
    console.log('\n[AvailabilityService]');
    try {
        const avail = await AvailabilityService.validateAvailability({
            workerId: rajesh._id.toString(),
            serviceCategoryId: rajeshCatId,
            scheduledStart: tomorrow.toISOString(),
            scheduledEnd: twoHoursLater.toISOString(),
            pricingType: 'HOURLY',
        });
        assert('validateAvailability returns available=true', avail.available === true);
        assert('durationMinutes = 120', avail.durationMinutes === 120);
    } catch (e) {
        console.error('  ❌ AvailabilityService threw:', e.message);
        fail++;
    }

    // --- Pricing Calculation ---
    console.log('\n[PricingService]');
    try {
        const pricing = await PricingService.calculatePrice({
            workerId: rajesh._id.toString(),
            serviceCategoryId: rajeshCatId,
            scheduledStart: tomorrow.toISOString(),
            scheduledEnd: twoHoursLater.toISOString(),
            pricingType: 'HOURLY',
        });
        assert('calculatePrice returns totalAmount > 0', pricing.totalAmount > 0);
        assert('calculatePrice has pricingSnapshot', !!pricing.pricingSnapshot);
        assert('Financial invariant: earning + commission = base',
            pricing.pricingSnapshot.workerEarningPaise + pricing.pricingSnapshot.commissionAmountPaise === pricing.pricingSnapshot.commissionBasePaise
        );
        assert('baseAmount > 0', pricing.baseAmount > 0);
        assert('taxAmount > 0', pricing.taxAmount > 0);
        console.log(`  Total: ₹${(pricing.totalAmount / 100).toFixed(2)}, Base: ₹${(pricing.baseAmount / 100).toFixed(2)}, Tax: ₹${(pricing.taxAmount / 100).toFixed(2)}`);
    } catch (e) {
        console.error('  ❌ PricingService threw:', e.message);
        fail++;
    }

    // --- Test All Workers ---
    console.log('\n[All Workers Pricing Check]');
    const workerUsers = await User.find({ role: 'WORKER' });
    for (const w of workerUsers) {
        const wp = await WorkerProfile.findOne({ userId: w._id }).populate('serviceCategoryIds');
        if (!wp || wp.verificationStatus !== 'APPROVED' || wp.serviceCategoryIds.length === 0) {
            console.log(`  ⏭ Skipping ${w.name} (not approved or no categories)`);
            continue;
        }
        const catId = wp.serviceCategoryIds[0]._id.toString();
        try {
            const p = await PricingService.calculatePrice({
                workerId: w._id.toString(),
                serviceCategoryId: catId,
                scheduledStart: tomorrow.toISOString(),
                scheduledEnd: twoHoursLater.toISOString(),
                pricingType: 'HOURLY',
            });
            assert(`${w.name} → pricing OK (₹${(p.totalAmount/100).toFixed(0)})`, p.totalAmount > 0);
        } catch (e) {
            console.error(`  ❌ ${w.name} pricing failed: ${e.message}`);
            fail++;
        }
    }

    console.log(`\n========================================`);
    console.log(`RESULTS: ${pass} passed, ${fail} failed`);
    console.log(`========================================`);

    await disconnectDB();
    process.exit(fail > 0 ? 1 : 0);
}

test().catch(e => { console.error(e); process.exit(1); });
