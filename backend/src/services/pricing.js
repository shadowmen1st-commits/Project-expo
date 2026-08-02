import { CommissionRule } from '../models/CommissionRule.js';
import { WorkerProfile } from '../models/WorkerProfile.js';
import { ServiceCategory } from '../models/ServiceCategory.js';
export const calculatePricing = async (params) => {
    const { workerId, categoryId, startDate, endDate, pricingType, couponCode } = params;
    // 1. Fetch Worker Profile
    const workerProfile = await WorkerProfile.findOne({ userId: workerId });
    if (!workerProfile) {
        throw new Error('Worker profile not found');
    }
    // 2. Fetch Category details
    const category = await ServiceCategory.findById(categoryId);
    if (!category) {
        throw new Error('Service category not found');
    }
    // 3. Compute duration & Base Amount
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs <= 0) {
        throw new Error('End date must be after start date');
    }
    let baseAmount = 0;
    let durationUnits = 0;
    if (pricingType === 'HOURLY') {
        const hours = Math.ceil(durationMs / (1000 * 60 * 60));
        const minHours = category.minimumBookingDuration || workerProfile.minimumBookingDuration || 1;
        durationUnits = Math.max(hours, minHours);
        baseAmount = durationUnits * workerProfile.hourlyRate;
    }
    else {
        // DAILY
        const days = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
        durationUnits = Math.max(days, 1);
        baseAmount = durationUnits * workerProfile.dailyRate;
    }
    // 4. Resolve Commission Rule
    // Priority: 1. WorkerSpecific, 2. CategorySpecific, 3. Global Default
    const now = new Date();
    // Find active rules
    const activeRules = await CommissionRule.find({
        isActive: true,
        effectiveFrom: { $lte: now },
        $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: null }, { effectiveUntil: { $gte: now } }],
    }).sort({ priority: 1 }); // Sort by priority (1 is highest, then 2, then 3)
    let percentage = category.defaultCommission; // default fallback from category
    let fixedAmount = 0;
    let minCommission = 0;
    let maxCommission;
    // Match rule by priority
    const matchedRule = activeRules.find(rule => {
        // Worker specific override
        if (rule.priority === 1 && rule.workerId?.toString() === workerId) {
            return true;
        }
        // Category specific override
        if (rule.priority === 2 && rule.serviceCategoryId?.toString() === categoryId) {
            return true;
        }
        // Global rule
        if (rule.priority === 3 && !rule.workerId && !rule.serviceCategoryId) {
            return true;
        }
        return false;
    });
    if (matchedRule) {
        percentage = matchedRule.percentage;
        fixedAmount = matchedRule.fixedAmount;
        minCommission = matchedRule.minimumCommission;
        maxCommission = matchedRule.maximumCommission;
    }
    // Calculate commission
    let commissionAmount = Math.round((baseAmount * percentage) / 100) + fixedAmount;
    if (commissionAmount < minCommission) {
        commissionAmount = minCommission;
    }
    if (maxCommission !== undefined && maxCommission !== null && commissionAmount > maxCommission) {
        commissionAmount = maxCommission;
    }
    // Platform Fee (e.g. flat 50 INR = 5000 paise)
    const platformFee = 5000;
    // Discount (simulate simple coupons)
    let discountAmount = 0;
    if (couponCode && couponCode.toUpperCase() === 'WELCOME10') {
        discountAmount = Math.round((baseAmount * 10) / 100); // 10% off base
    }
    // Tax (GST 18% on base amount + platform fee)
    const taxableAmount = Math.max(0, baseAmount + platformFee - discountAmount);
    const taxAmount = Math.round((taxableAmount * 18) / 100);
    // Total payable by customer
    const totalAmount = baseAmount + platformFee + taxAmount - discountAmount;
    // Net earning for worker
    const workerEarning = Math.max(0, baseAmount - commissionAmount);
    return {
        baseAmount,
        platformFee,
        taxAmount,
        discountAmount,
        totalAmount,
        commissionPercentage: percentage,
        commissionAmount,
        workerEarning,
    };
};
