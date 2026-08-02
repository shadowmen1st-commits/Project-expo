import WorkerProfile from '../models/WorkerProfile.js';
import ServiceCategory from '../models/ServiceCategory.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import Coupon from '../models/Coupon.js';
import SurgeRule from '../models/SurgeRule.js';
import CommissionResolverService from './CommissionResolverService.js';
import {
    assertSafeMoneyInteger,
    multiplyPaiseByBasisPoints,
    calculatePercentageAmount,
} from '../utils/moneyUtils.js';

export class PricingService {
    /**
     * Authoritative calculation pipeline for booking prices & commission snapshots
     */
    static async calculatePrice({
        workerId,
        serviceCategoryId,
        scheduledStart,
        scheduledEnd,
        pricingType = 'HOURLY',
        couponCode = null,
        customerId = null,
        quoteId = null,
    }) {
        const startDate = new Date(scheduledStart);
        const endDate = new Date(scheduledEnd);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            const error = new Error('Invalid scheduled start or end date.');
            error.statusCode = 400;
            error.errorCode = 'INVALID_TIME_RANGE';
            throw error;
        }

        const durationMinutes = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60));
        if (durationMinutes <= 0) {
            const error = new Error('Duration must be greater than zero.');
            error.statusCode = 400;
            error.errorCode = 'INVALID_BOOKING_DURATION';
            throw error;
        }

        // 1. Fetch Worker Profile
        const workerProfile = await WorkerProfile.findOne({ userId: workerId });
        if (!workerProfile) {
            const error = new Error('Worker profile not found.');
            error.statusCode = 404;
            error.errorCode = 'WORKER_NOT_FOUND';
            throw error;
        }

        if (workerProfile.verificationStatus !== 'APPROVED') {
            const error = new Error('Worker is not approved for bookings.');
            error.statusCode = 409;
            error.errorCode = 'WORKER_NOT_APPROVED';
            throw error;
        }

        // 2. Fetch Category details
        const category = await ServiceCategory.findById(serviceCategoryId);
        if (!category) {
            const error = new Error('Service category not found.');
            error.statusCode = 404;
            error.errorCode = 'CATEGORY_NOT_FOUND';
            throw error;
        }

        // 3. Fetch Platform Pricing Config (or fallback defaults)
        let config = await PlatformPricingConfig.findOne();
        if (!config) {
            config = {
                currency: 'INR',
                customerPlatformFeeType: 'FIXED',
                customerPlatformFeeBps: 0,
                customerPlatformFeeFixedPaise: 5000, // ₹50
                taxEnabled: true,
                taxRateBps: 1800, // 18% GST
                taxApplicationMode: 'EXCLUSIVE',
                defaultMinimumBookingAmountPaise: 0,
                quoteValiditySeconds: 900,
                surgePricingEnabled: false,
            };
        }

        // 4. Calculate Raw Service Amount
        let rawServiceAmountPaise = 0;
        let durationUnits = 0;

        if (pricingType === 'HOURLY') {
            if (!workerProfile.hourlyRate || workerProfile.hourlyRate <= 0) {
                const error = new Error('Worker hourly rate is not configured.');
                error.statusCode = 400;
                error.errorCode = 'WORKER_RATE_NOT_CONFIGURED';
                throw error;
            }
            const hours = Math.ceil(durationMinutes / 60);
            const minHours = Math.max(category.minimumBookingDuration || 1, workerProfile.minimumBookingDuration || 1);

            if (hours < minHours) {
                const error = new Error(`Minimum booking duration is ${minHours} hour(s).`);
                error.statusCode = 400;
                error.errorCode = 'MINIMUM_BOOKING_DURATION_NOT_MET';
                throw error;
            }
            durationUnits = hours;
            rawServiceAmountPaise = durationUnits * workerProfile.hourlyRate;
        } else if (pricingType === 'DAILY') {
            if (!workerProfile.dailyRate || workerProfile.dailyRate <= 0) {
                const error = new Error('Worker daily rate is not configured.');
                error.statusCode = 400;
                error.errorCode = 'WORKER_RATE_NOT_CONFIGURED';
                throw error;
            }
            const days = Math.max(1, Math.ceil(durationMinutes / (60 * 24)));
            durationUnits = days;
            rawServiceAmountPaise = durationUnits * workerProfile.dailyRate;
        } else {
            const error = new Error(`Pricing type ${pricingType} is not supported.`);
            error.statusCode = 400;
            error.errorCode = 'PRICING_TYPE_NOT_SUPPORTED';
            throw error;
        }

        assertSafeMoneyInteger(rawServiceAmountPaise, 'rawServiceAmountPaise');

        // 5. Minimum Booking Charge Adjustment
        const minAmountPaise = Math.max(
            config.defaultMinimumBookingAmountPaise || 0,
            category.minimumChargePaise || 0
        );
        let minimumChargeAdjustmentPaise = 0;
        if (rawServiceAmountPaise < minAmountPaise) {
            minimumChargeAdjustmentPaise = minAmountPaise - rawServiceAmountPaise;
        }
        const baseAmountPaise = rawServiceAmountPaise + minimumChargeAdjustmentPaise;
        assertSafeMoneyInteger(baseAmountPaise, 'baseAmountPaise');

        // 6. Coupon & Discount Calculation
        let couponObj = null;
        let discountAmountPaise = 0;
        let couponCodeMasked = null;

        if (couponCode) {
            couponObj = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });
            if (couponObj && couponObj.isActive) {
                const now = new Date();
                const isValidDate = (!couponObj.validFrom || couponObj.validFrom <= now) && (!couponObj.validUntil || couponObj.validUntil >= now);
                const meetsMinOrder = baseAmountPaise >= (couponObj.minimumOrderAmountPaise || 0);

                if (isValidDate && meetsMinOrder) {
                    if (couponObj.discountType === 'PERCENTAGE') {
                        discountAmountPaise = calculatePercentageAmount(baseAmountPaise, couponObj.percentageBps || 0);
                        if (couponObj.maximumDiscountPaise && discountAmountPaise > couponObj.maximumDiscountPaise) {
                            discountAmountPaise = couponObj.maximumDiscountPaise;
                        }
                    } else if (couponObj.discountType === 'FIXED') {
                        discountAmountPaise = couponObj.fixedAmountPaise || 0;
                    }
                    if (discountAmountPaise > baseAmountPaise) {
                        discountAmountPaise = baseAmountPaise;
                    }
                    couponCodeMasked = couponObj.code;
                }
            }
        }
        assertSafeMoneyInteger(discountAmountPaise, 'discountAmountPaise');
        const serviceAmountAfterDiscountPaise = Math.max(0, baseAmountPaise - discountAmountPaise);

        // 7. Customer Platform Fee
        let platformFeeAmountPaise = 0;
        if (config.customerPlatformFeeType === 'FIXED') {
            platformFeeAmountPaise = config.customerPlatformFeeFixedPaise || 0;
        } else if (config.customerPlatformFeeType === 'PERCENTAGE') {
            platformFeeAmountPaise = calculatePercentageAmount(baseAmountPaise, config.customerPlatformFeeBps || 0);
        } else if (config.customerPlatformFeeType === 'PERCENTAGE_PLUS_FIXED') {
            platformFeeAmountPaise = calculatePercentageAmount(baseAmountPaise, config.customerPlatformFeeBps || 0) + (config.customerPlatformFeeFixedPaise || 0);
        }
        assertSafeMoneyInteger(platformFeeAmountPaise, 'platformFeeAmountPaise');

        // 8. Tax Calculation
        let taxAmountPaise = 0;
        const taxableAmountPaise = Math.max(0, baseAmountPaise + platformFeeAmountPaise - discountAmountPaise);
        if (config.taxEnabled && config.taxRateBps > 0) {
            taxAmountPaise = calculatePercentageAmount(taxableAmountPaise, config.taxRateBps);
        }
        assertSafeMoneyInteger(taxAmountPaise, 'taxAmountPaise');

        // 9. Customer Total
        const customerTotalPaise = baseAmountPaise + platformFeeAmountPaise + taxAmountPaise - discountAmountPaise;
        assertSafeMoneyInteger(customerTotalPaise, 'customerTotalPaise');

        // 10. Commission Rule Resolution & Calculation
        const commissionRes = await CommissionResolverService.resolveCommissionRule({
            workerId,
            serviceCategoryId,
            targetDate: startDate,
        });

        const commissionBasePaise = baseAmountPaise;
        let commissionAmountPaise = 0;

        if (commissionRes.calculationType === 'PERCENTAGE') {
            commissionAmountPaise = calculatePercentageAmount(commissionBasePaise, commissionRes.percentageBps);
        } else if (commissionRes.calculationType === 'FIXED') {
            commissionAmountPaise = commissionRes.fixedAmountPaise;
        } else if (commissionRes.calculationType === 'PERCENTAGE_PLUS_FIXED') {
            commissionAmountPaise = calculatePercentageAmount(commissionBasePaise, commissionRes.percentageBps) + commissionRes.fixedAmountPaise;
        }

        // Apply Minimum & Maximum Commission Caps
        if (commissionRes.minimumCommissionPaise && commissionAmountPaise < commissionRes.minimumCommissionPaise) {
            commissionAmountPaise = commissionRes.minimumCommissionPaise;
        }
        if (commissionRes.maximumCommissionPaise && commissionAmountPaise > commissionRes.maximumCommissionPaise) {
            commissionAmountPaise = commissionRes.maximumCommissionPaise;
        }
        if (commissionAmountPaise > commissionBasePaise) {
            commissionAmountPaise = commissionBasePaise; // Cap at 100% of base
        }
        assertSafeMoneyInteger(commissionAmountPaise, 'commissionAmountPaise');

        // 11. Worker Earning Calculation
        const workerEarningPaise = Math.max(0, commissionBasePaise - commissionAmountPaise);
        assertSafeMoneyInteger(workerEarningPaise, 'workerEarningPaise');

        // 12. Invariant Reconciliation Check
        if (workerEarningPaise + commissionAmountPaise !== commissionBasePaise) {
            throw new Error(`Financial invariant failed: Earning (${workerEarningPaise}) + Commission (${commissionAmountPaise}) != Base (${commissionBasePaise})`);
        }

        // 13. Construct Immutable Pricing Snapshot
        const pricingSnapshot = {
            pricingVersion: 1,
            currency: config.currency || 'INR',
            pricingType,
            rateSource: 'WORKER_PROFILE',
            hourlyRatePaise: workerProfile.hourlyRate,
            dailyRatePaise: workerProfile.dailyRate,
            durationMinutes,
            durationDays: pricingType === 'DAILY' ? durationUnits : 0,
            rawServiceAmountPaise,
            minimumChargeAdjustmentPaise,
            baseAmountPaise,
            couponId: couponObj ? couponObj._id : null,
            couponCodeMasked,
            discountType: couponObj ? couponObj.discountType : null,
            discountValue: couponObj ? (couponObj.discountType === 'PERCENTAGE' ? couponObj.percentageBps : couponObj.fixedAmountPaise) : 0,
            discountAmountPaise,
            serviceAmountAfterDiscountPaise,
            platformFeeType: config.customerPlatformFeeType,
            platformFeeBps: config.customerPlatformFeeBps || 0,
            platformFeeFixedPaise: config.customerPlatformFeeFixedPaise || 0,
            platformFeeAmountPaise,
            taxEnabled: !!config.taxEnabled,
            taxRateBps: config.taxRateBps || 0,
            taxApplicationMode: config.taxApplicationMode || 'EXCLUSIVE',
            taxableAmountPaise,
            taxAmountPaise,
            customerTotalPaise,
            commissionRuleId: commissionRes.ruleId,
            commissionRuleVersion: commissionRes.ruleVersion,
            commissionRuleName: commissionRes.ruleName,
            commissionScope: commissionRes.scope,
            commissionCalculationType: commissionRes.calculationType,
            commissionPercentageBps: commissionRes.percentageBps,
            commissionFixedAmountPaise: commissionRes.fixedAmountPaise,
            minimumCommissionPaise: commissionRes.minimumCommissionPaise,
            maximumCommissionPaise: commissionRes.maximumCommissionPaise,
            commissionBasePaise,
            commissionAmountPaise,
            workerEarningPaise,
            surgeRuleId: null,
            surgeMultiplierBps: 10000,
            calculatedAt: new Date(),
            quoteId,
        };

        return {
            baseAmount: baseAmountPaise,
            platformFee: platformFeeAmountPaise,
            taxAmount: taxAmountPaise,
            discountAmount: discountAmountPaise,
            totalAmount: customerTotalPaise,
            commissionPercentage: commissionRes.percentageBps / 100, // display percent e.g. 10%
            commissionAmount: commissionAmountPaise,
            workerEarning: workerEarningPaise,
            pricingSnapshot,
        };
    }
}

export default PricingService;
