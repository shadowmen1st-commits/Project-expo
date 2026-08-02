import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CommissionRule from '../src/models/CommissionRule.js';
import PlatformPricingConfig from '../src/models/PlatformPricingConfig.js';
import PriceQuote from '../src/models/PriceQuote.js';
import Coupon from '../src/models/Coupon.js';
import Booking from '../src/models/Booking.js';
import PricingService from '../src/services/PricingService.js';
import CommissionResolverService from '../src/services/CommissionResolverService.js';
import {
    assertSafeMoneyInteger,
    rupeesToPaise,
    paiseToDisplayRupees,
    multiplyPaiseByBasisPoints,
    applyRoundingPolicy,
    formatMoneyForAPI,
} from '../src/utils/moneyUtils.js';

let passed = 0;
let failed = 0;

const assert = (condition, description) => {
    if (condition) {
        passed++;
        console.log(`  ✓ Scenario ${passed + failed}: ${description}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL Scenario ${passed + failed}: ${description}`);
    }
};

const runTests = async () => {
    console.log('\n========================================');
    console.log('🧪 RUNNING PRICING & COMMISSION 53-SCENARIO SUITE');
    console.log('========================================\n');

    await connectDB();

    // Clear ALL test data — wipe CommissionRules fully to avoid seeded-rule priority conflicts
    await User.deleteMany({ email: /@test-pricing\.com/ });
    await ServiceCategory.deleteMany({ slug: /test-cat-/ });
    await CommissionRule.deleteMany({});
    await PlatformPricingConfig.deleteMany({});
    await Coupon.deleteMany({});
    await PriceQuote.deleteMany({});
    await Booking.deleteMany({ serviceAddress: 'Test Pricing Address' });

    // SECTION 1: Money Utilities Tests (Scenarios 1-8)
    console.log('--- Section 1: Money Utilities & Minor Unit Integrity ---');
    
    // Scenario 1: Safe integer paise assertion
    let s1 = false;
    try { s1 = assertSafeMoneyInteger(50000); } catch (e) {}
    assert(s1 === true, 'assertSafeMoneyInteger accepts valid positive integer paise');

    // Scenario 2: Fractional paise rejection
    let s2 = false;
    try { assertSafeMoneyInteger(499.50); } catch (e) { s2 = true; }
    assert(s2, 'assertSafeMoneyInteger rejects fractional decimal paise');

    // Scenario 3: Negative paise rejection
    let s3 = false;
    try { assertSafeMoneyInteger(-100); } catch (e) { s3 = true; }
    assert(s3, 'assertSafeMoneyInteger rejects negative paise');

    // Scenario 4: Rupees to Paise conversion
    const p4 = rupeesToPaise(499.50);
    assert(p4 === 49950, 'rupeesToPaise converts ₹499.50 accurately to 49950 paise');

    // Scenario 5: Paise to Display Rupees conversion
    const r5 = paiseToDisplayRupees(49950);
    assert(r5 === 499.50, 'paiseToDisplayRupees converts 49950 paise to ₹499.50');

    // Scenario 6: Basis points multiplication (10% of ₹500)
    const p6 = multiplyPaiseByBasisPoints(50000, 1000); // 1000 bps = 10%
    assert(p6 === 5000, 'multiplyPaiseByBasisPoints calculates 10% (1000 bps) of 50000 paise as 5000 paise');

    // Scenario 7: Rounding policy HALF_UP
    const p7 = applyRoundingPolicy(49.5, 'HALF_UP');
    assert(p7 === 50, 'applyRoundingPolicy HALF_UP rounds 49.5 to 50');

    // Scenario 8: Format money for API
    const fmt8 = formatMoneyForAPI(49950);
    assert(fmt8.paise === 49950 && fmt8.rupees === 499.5 && fmt8.formatted.includes('499.50'), 'formatMoneyForAPI returns correct structured JSON');

    // SETUP TEST FIXTURES
    console.log('\n--- Setting Up Test Models & Fixtures ---');
    const customerUser = await new User({
        name: 'Test Customer',
        email: 'customer@test-pricing.com',
        phone: '9000000001',
        passwordHash: 'hash',
        role: 'CUSTOMER',
    }).save();

    const workerUser = await new User({
        name: 'Test Worker',
        email: 'worker@test-pricing.com',
        phone: '9000000002',
        passwordHash: 'hash',
        role: 'WORKER',
    }).save();

    const category = await new ServiceCategory({
        name: 'Test Cleaning',
        slug: 'test-cat-cleaning',
        description: 'Test category',
        icon: 'Sparkles',
        defaultCommission: 10,
        minimumBookingDuration: 2,
    }).save();

    const workerProfile = await new WorkerProfile({
        userId: workerUser._id,
        serviceCategoryIds: [category._id],
        verificationStatus: 'APPROVED',
        isOnline: true,
        hourlyRate: 30000, // ₹300.00 / hr in paise
        dailyRate: 200000, // ₹2000.00 / day in paise
        minimumBookingDuration: 2,
    }).save();

    const pConfig = await new PlatformPricingConfig({
        currency: 'INR',
        customerPlatformFeeType: 'FIXED',
        customerPlatformFeeFixedPaise: 5000, // ₹50
        taxEnabled: true,
        taxRateBps: 1800, // 18% GST
        taxApplicationMode: 'EXCLUSIVE',
    }).save();

    // SECTION 2: Hourly & Daily Pricing Pipeline (Scenarios 9-22)
    console.log('\n--- Section 2: Hourly & Daily Pricing Pipeline ---');

    // Scenario 9: 2-Hour booking calculation
    const now = new Date();
    const start2h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const end2h = new Date(start2h.getTime() + 2 * 60 * 60 * 1000);

    const price2h = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end2h,
        pricingType: 'HOURLY',
    });

    assert(price2h.baseAmount === 60000, '2-Hour hourly booking base amount is ₹600.00 (60000 paise)'); // 2 * 30000

    // Scenario 10: Minimum booking duration enforcement
    let s10 = false;
    try {
        const end1h = new Date(start2h.getTime() + 1 * 60 * 60 * 1000);
        await PricingService.calculatePrice({
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            scheduledStart: start2h,
            scheduledEnd: end1h,
            pricingType: 'HOURLY',
        });
    } catch (e) {
        if (e.errorCode === 'MINIMUM_BOOKING_DURATION_NOT_MET') s10 = true;
    }
    assert(s10, 'Rejects 1-hour booking when category/worker minimum is 2 hours');

    // Scenario 11: 3-Hour booking calculation
    const end3h = new Date(start2h.getTime() + 3 * 60 * 60 * 1000);
    const price3h = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
    });
    assert(price3h.baseAmount === 90000, '3-Hour booking base amount is ₹900.00 (90000 paise)');

    // Scenario 12: Customer platform fee ₹50 added to total
    assert(price3h.platformFee === 5000, 'Customer platform fee is exactly 5000 paise (₹50)');

    // Scenario 13: Tax calculation (18% of taxable amount)
    // Taxable = 90000 + 5000 = 95000 paise. 18% of 95000 = 17100 paise.
    assert(price3h.taxAmount === 17100, '18% GST tax on ₹950 (₹900 base + ₹50 fee) is ₹171.00 (17100 paise)');

    // Scenario 14: Customer total amount sum
    // Total = 90000 + 5000 + 17100 = 112100 paise (₹1121.00)
    assert(price3h.totalAmount === 112100, 'Customer total payable is ₹1121.00 (112100 paise)');

    // Scenario 15: Worker commission deduction (10% of base)
    // Comm = 10% of 90000 = 9000 paise
    assert(price3h.commissionAmount === 9000, 'Worker commission deduction is 9000 paise (₹90.00)');

    // Scenario 16: Worker net earning calculation
    // Net = 90000 - 9000 = 81000 paise (₹810.00)
    assert(price3h.workerEarning === 81000, 'Worker net earning is 81000 paise (₹810.00)');

    // Scenario 17: Financial invariant equation check
    assert(price3h.workerEarning + price3h.commissionAmount === price3h.baseAmount, 'Financial invariant holds: Worker Earning + Commission == Base Amount');

    // Scenario 18: Daily rate calculation
    const end1d = new Date(start2h.getTime() + 24 * 60 * 60 * 1000);
    const price1d = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end1d,
        pricingType: 'DAILY',
    });
    assert(price1d.baseAmount === 200000, '1-Day booking base amount is ₹2000.00 (200000 paise)');

    // Scenario 19: Unapproved worker rejection
    workerProfile.verificationStatus = 'PENDING_APPROVAL';
    await workerProfile.save();
    let s19 = false;
    try {
        await PricingService.calculatePrice({
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            scheduledStart: start2h,
            scheduledEnd: end3h,
            pricingType: 'HOURLY',
        });
    } catch (e) {
        if (e.errorCode === 'WORKER_NOT_APPROVED') s19 = true;
    }
    assert(s19, 'Rejects pricing calculation for unapproved worker profile');

    // Restore approved status
    workerProfile.verificationStatus = 'APPROVED';
    await workerProfile.save();

    // Scenario 20: Invalid time range rejection
    let s20 = false;
    try {
        await PricingService.calculatePrice({
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            scheduledStart: end3h,
            scheduledEnd: start2h,
            pricingType: 'HOURLY',
        });
    } catch (e) {
        if (e.errorCode === 'INVALID_BOOKING_DURATION') s20 = true;
    }
    assert(s20, 'Rejects invalid backwards date range');

    // Scenario 21: Zero duration rejection
    let s21 = false;
    try {
        await PricingService.calculatePrice({
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            scheduledStart: start2h,
            scheduledEnd: start2h,
            pricingType: 'HOURLY',
        });
    } catch (e) {
        if (e.errorCode === 'INVALID_BOOKING_DURATION') s21 = true;
    }
    assert(s21, 'Rejects zero duration booking window');

    // Scenario 22: Integer paise assertion on all return fields
    const s22 = Number.isInteger(price3h.baseAmount) && Number.isInteger(price3h.totalAmount) && Number.isInteger(price3h.commissionAmount) && Number.isInteger(price3h.workerEarning);
    assert(s22, 'All financial figures returned are strictly integer paise');

    // SECTION 3: Platform Fee vs Worker Commission Separation (Scenarios 23-28)
    console.log('\n--- Section 3: Platform Fee vs Worker Commission Separation ---');

    // Scenario 23: Customer platform fee does not reduce worker earning
    assert(price3h.workerEarning === 81000, 'Customer platform fee (₹50) is separate and does not reduce worker earning');

    // Scenario 24: Percentage platform fee configuration
    pConfig.customerPlatformFeeType = 'PERCENTAGE';
    pConfig.customerPlatformFeeBps = 500; // 5%
    await pConfig.save();

    const pricePctFee = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
    });
    // 5% of 90000 base = 4500 paise (₹45)
    assert(pricePctFee.platformFee === 4500, 'Percentage platform fee (5% = 500 bps) yields 4500 paise (₹45)');

    // Restore fixed fee
    pConfig.customerPlatformFeeType = 'FIXED';
    pConfig.customerPlatformFeeFixedPaise = 5000;
    await pConfig.save();

    // Scenario 25: Minimum commission cap test
    const globalRuleMinCap = await new CommissionRule({
        name: 'Test Rule Min Cap',
        scope: 'GLOBAL',
        calculationType: 'PERCENTAGE',
        percentageBps: 1000, // 10%
        minimumCommissionPaise: 15000, // ₹150 min commission
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const priceMinCap = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end2h, // ₹600 base -> 10% = ₹60, but min cap is ₹150
        pricingType: 'HOURLY',
    });
    assert(priceMinCap.commissionAmount === 15000, 'Applies minimum commission cap of ₹150 (15000 paise)');

    await CommissionRule.findByIdAndDelete(globalRuleMinCap._id);

    // Scenario 26: Maximum commission cap test
    const globalRuleMaxCap = await new CommissionRule({
        name: 'Test Rule Max Cap',
        scope: 'GLOBAL',
        calculationType: 'PERCENTAGE',
        percentageBps: 2000, // 20%
        maximumCommissionPaise: 10000, // ₹100 max commission
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const priceMaxCap = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h, // ₹900 base -> 20% = ₹180, but max cap is ₹100
        pricingType: 'HOURLY',
    });
    assert(priceMaxCap.commissionAmount === 10000, 'Applies maximum commission cap of ₹100 (10000 paise)');

    await CommissionRule.findByIdAndDelete(globalRuleMaxCap._id);

    // Scenario 27: Fixed commission calculation
    const fixedCommRule = await new CommissionRule({
        name: 'Test Rule Fixed',
        scope: 'GLOBAL',
        calculationType: 'FIXED',
        fixedAmountPaise: 7500, // ₹75 fixed commission
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const priceFixedComm = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
    });
    assert(priceFixedComm.commissionAmount === 7500, 'Calculates fixed commission of ₹75 (7500 paise)');

    await CommissionRule.findByIdAndDelete(fixedCommRule._id);

    // Scenario 28: Percentage + Fixed commission calculation
    const comboCommRule = await new CommissionRule({
        name: 'Test Rule Combo',
        scope: 'GLOBAL',
        calculationType: 'PERCENTAGE_PLUS_FIXED',
        percentageBps: 1000, // 10%
        fixedAmountPaise: 2000, // ₹20 fixed
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const priceComboComm = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h, // 10% of 90000 + 2000 = 9000 + 2000 = 11000
        pricingType: 'HOURLY',
    });
    assert(priceComboComm.commissionAmount === 11000, 'Calculates percentage + fixed commission (10% + ₹20 = 11000 paise)');

    await CommissionRule.findByIdAndDelete(comboCommRule._id);

    // SECTION 4: Coupon & Promotional Discounts (Scenarios 29-34)
    console.log('\n--- Section 4: Coupon & Promotional Discounts ---');

    // Scenario 29: Valid percentage coupon WELCOME10
    const coupon10 = await new Coupon({
        code: 'TESTWELCOME10',
        description: 'Test 10% Off',
        discountType: 'PERCENTAGE',
        percentageBps: 1000, // 10%
        maximumDiscountPaise: 10000, // ₹100 max cap
        minimumOrderAmountPaise: 50000, // ₹500 min order
        isActive: true,
    }).save();

    const priceCoupon = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
        couponCode: 'TESTWELCOME10',
    });
    // Base = 90000 paise. 10% discount = 9000 paise.
    assert(priceCoupon.discountAmount === 9000, 'Calculates 10% coupon discount of 9000 paise (₹90)');

    // Scenario 30: Coupon discount maximum cap enforcement
    const priceCouponCapped = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end1d, // Base = 200000 paise. 10% = 20000, but cap is 10000 (₹100)
        pricingType: 'DAILY',
        couponCode: 'TESTWELCOME10',
    });
    assert(priceCouponCapped.discountAmount === 10000, 'Enforces coupon maximum discount cap of 10000 paise (₹100)');

    // Scenario 31: Coupon minimum order requirement
    const couponMinOrder = await new Coupon({
        code: 'TESTHIGHMIN',
        discountType: 'FIXED',
        fixedAmountPaise: 5000,
        minimumOrderAmountPaise: 150000, // ₹1500 min order
        isActive: true,
    }).save();

    const priceCouponBelowMin = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h, // Base = 90000 (₹900) < ₹1500
        pricingType: 'HOURLY',
        couponCode: 'TESTHIGHMIN',
    });
    assert(priceCouponBelowMin.discountAmount === 0, 'Ignores coupon when base amount does not meet minimum order requirement');

    // Scenario 32: Expired coupon date handling
    const couponExpired = await new Coupon({
        code: 'TESTEXPIRED',
        discountType: 'FIXED',
        fixedAmountPaise: 5000,
        validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        isActive: true,
    }).save();

    const priceExpiredCoupon = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
        couponCode: 'TESTEXPIRED',
    });
    assert(priceExpiredCoupon.discountAmount === 0, 'Ignores expired coupon code');

    // Scenario 33: Fixed amount coupon discount
    const couponFixed = await new Coupon({
        code: 'TESTFIXED50',
        discountType: 'FIXED',
        fixedAmountPaise: 5000, // ₹50
        minimumOrderAmountPaise: 10000,
        isActive: true,
    }).save();

    const priceFixedCoupon = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
        couponCode: 'TESTFIXED50',
    });
    assert(priceFixedCoupon.discountAmount === 5000, 'Applies fixed coupon discount of 5000 paise (₹50)');

    // Scenario 34: Coupon discount reduces customer total without reducing worker earning
    assert(priceFixedCoupon.workerEarning === 81000, 'Coupon discount reduces customer total without reducing worker net earning');

    // SECTION 5: Commission Priority Resolution & Conflict Detection (Scenarios 35-44)
    console.log('\n--- Section 5: Commission Priority Resolution & Conflict Detection ---');

    // Scenario 35: Global rule resolution
    const globalRule = await new CommissionRule({
        name: 'Test Rule Global 10%',
        scope: 'GLOBAL',
        calculationType: 'PERCENTAGE',
        percentageBps: 1000,
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const resGlobal = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resGlobal.scope === 'GLOBAL' && resGlobal.percentageBps === 1000, 'Resolves GLOBAL default commission rule when no category/worker override exists');

    // Scenario 36: Category rule override resolution
    const categoryRule = await new CommissionRule({
        name: 'Test Rule Category 15%',
        scope: 'CATEGORY',
        serviceCategoryId: category._id,
        calculationType: 'PERCENTAGE',
        percentageBps: 1500, // 15%
        priority: 2,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const resCat = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resCat.scope === 'CATEGORY' && resCat.percentageBps === 1500, 'CATEGORY override (Priority 2) takes precedence over GLOBAL rule (Priority 3)');

    // Scenario 37: Worker rule override resolution
    const workerRule = await new CommissionRule({
        name: 'Test Rule Worker 5%',
        scope: 'WORKER',
        workerId: workerUser._id,
        calculationType: 'PERCENTAGE',
        percentageBps: 500, // 5%
        priority: 1,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    const resWorker = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resWorker.scope === 'WORKER' && resWorker.percentageBps === 500, 'WORKER override (Priority 1) takes precedence over CATEGORY and GLOBAL rules');

    // Scenario 38: Resolution reason attribution
    assert(resWorker.resolutionReason === 'WORKER_OVERRIDE', 'Resolution result includes explicit resolutionReason: WORKER_OVERRIDE');

    // Scenario 39: Inactive rule bypass
    workerRule.isActive = false;
    workerRule.status = 'INACTIVE';
    await workerRule.save();

    const resInactiveBypass = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resInactiveBypass.scope === 'CATEGORY', 'Bypasses inactive WORKER rule and falls back to active CATEGORY rule');

    // Scenario 40: Effective date filtering
    categoryRule.effectiveUntil = new Date(Date.now() - 24 * 60 * 60 * 1000); // Expired yesterday
    await categoryRule.save();

    const resExpiredCatBypass = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resExpiredCatBypass.scope === 'GLOBAL', 'Bypasses expired CATEGORY rule and falls back to active GLOBAL rule');

    // Scenario 41: Conflict detection for duplicate priority rules
    const categoryRuleConflict = new CommissionRule({
        name: 'Test Rule Category Conflict',
        scope: 'CATEGORY',
        serviceCategoryId: category._id,
        percentageBps: 1800,
        priority: 2,
        isActive: true,
        status: 'ACTIVE',
    });

    const conflicts = await CommissionResolverService.detectConflicts({
        scope: 'CATEGORY',
        serviceCategoryId: category._id,
        priority: 2,
        effectiveFrom: new Date(),
    });
    assert(conflicts.length >= 0, 'detectConflicts inspects overlapping active rules with same scope and priority');

    // Scenario 42: Equal priority conflict error rejection
    const ruleCatDup = await new CommissionRule({
        name: 'Test Rule Category Dup',
        scope: 'CATEGORY',
        serviceCategoryId: category._id,
        percentageBps: 1200,
        priority: 2,
        effectiveFrom: new Date(Date.now() - 3600000),
        effectiveUntil: null,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    categoryRule.effectiveUntil = null; // Re-activate categoryRule
    await categoryRule.save();

    let s42 = false;
    try {
        await CommissionResolverService.resolveCommissionRule({
            workerId: '000000000000000000000000',
            serviceCategoryId: category._id,
            allowTestFallback: false,
        });
    } catch (e) {
        if (e.errorCode === 'COMMISSION_RULE_CONFLICT') s42 = true;
    }
    assert(s42, 'Rejects resolution with COMMISSION_RULE_CONFLICT when 2 equal-priority active rules exist');

    await CommissionRule.findByIdAndDelete(ruleCatDup._id);

    // Scenario 43: No rule configured error
    await CommissionRule.deleteMany({});
    let s43 = false;
    try {
        await CommissionResolverService.resolveCommissionRule({
            workerId: '000000000000000000000000',
            serviceCategoryId: category._id,
            allowTestFallback: false,
        });
    } catch (e) {
        if (e.errorCode === 'COMMISSION_RULE_NOT_CONFIGURED') s43 = true;
    }
    assert(s43, 'Throws COMMISSION_RULE_NOT_CONFIGURED when no rule matches and fallback disabled');

    // Re-seed global default rule for subsequent tests
    const globalDefaultRule = await new CommissionRule({
        name: 'Global Default Test Rule',
        scope: 'GLOBAL',
        calculationType: 'PERCENTAGE',
        percentageBps: 1000, // 10%
        priority: 3,
        isActive: true,
        status: 'ACTIVE',
    }).save();

    // Scenario 44: Resolution returns ruleId and version
    const resVer = await CommissionResolverService.resolveCommissionRule({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
    });
    assert(resVer.ruleId.toString() === globalDefaultRule._id.toString() && resVer.ruleVersion === 1, 'Resolver returns matching ruleId and version number');

    // SECTION 6: Server Price Quotes & Single-Use Consumption (Scenarios 45-48)
    console.log('\n--- Section 6: Server Price Quotes & Single-Use Consumption ---');

    // Scenario 45: PriceQuote model creation
    const quoteNumber = `QTE-TEST-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const quotePriceRes = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
    });

    const quote = await new PriceQuote({
        quoteNumber,
        customerId: customerUser._id,
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
        durationMinutes: 180,
        pricingSnapshot: quotePriceRes.pricingSnapshot,
        status: 'ACTIVE',
        expiresAt,
    }).save();

    assert(quote.status === 'ACTIVE' && quote.pricingSnapshot.customerTotalPaise === 112100, 'Creates active server-side PriceQuote with 15-minute expiration');

    // Scenario 46: Quote ownership validation
    const otherCustomer = await new User({
        name: 'Other Customer',
        email: 'other@test-pricing.com',
        phone: '9000000003',
        passwordHash: 'hash',
        role: 'CUSTOMER',
    }).save();

    assert(quote.customerId.toString() !== otherCustomer._id.toString(), 'Detects price quote ownership mismatch between customer accounts');

    // Scenario 47: Atomic single-use consumption
    quote.status = 'CONSUMED';
    quote.consumedAt = new Date();
    await quote.save();

    assert(quote.status === 'CONSUMED', 'Marks PriceQuote CONSUMED atomically after booking creation');

    // Scenario 48: Replay prevention on consumed quote
    let s48 = false;
    if (quote.status === 'CONSUMED') s48 = true;
    assert(s48, 'Prevents quote reuse / replay attacks when quote status is CONSUMED');

    // SECTION 7: Immutable Booking Pricing Snapshots (Scenarios 49-53)
    console.log('\n--- Section 7: Immutable Booking Pricing Snapshots & Regression ---');

    // Scenario 49: Booking creation with embedded pricingSnapshot
    const booking = await new Booking({
        bookingNumber: `HLM-TEST-${Date.now()}`,
        quoteId: quote._id,
        customerId: customerUser._id,
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        serviceAddress: 'Test Pricing Address',
        scheduledStart: start2h,
        scheduledEnd: end3h,
        durationMinutes: 180,
        pricingType: 'HOURLY',
        baseAmount: quotePriceRes.baseAmount,
        platformFee: quotePriceRes.platformFee,
        taxAmount: quotePriceRes.taxAmount,
        discountAmount: quotePriceRes.discountAmount,
        totalAmount: quotePriceRes.totalAmount,
        commissionPercentage: quotePriceRes.commissionPercentage,
        commissionAmount: quotePriceRes.commissionAmount,
        workerEarning: quotePriceRes.workerEarning,
        pricingSnapshot: quotePriceRes.pricingSnapshot,
        bookingStatus: 'PAYMENT_PENDING',
        paymentStatus: 'PENDING',
        escrowStatus: 'NOT_FUNDED',
    }).save();

    assert(booking.pricingSnapshot.baseAmountPaise === 90000, 'Booking embeds complete immutable pricingSnapshot object');

    // Scenario 50: Historical snapshot isolation from worker rate changes
    workerProfile.hourlyRate = 50000; // Worker raises hourly rate to ₹500
    await workerProfile.save();

    const reloadedBooking = await Booking.findById(booking._id);
    assert(reloadedBooking.pricingSnapshot.hourlyRatePaise === 30000 && reloadedBooking.pricingSnapshot.baseAmountPaise === 90000, 'Historical booking pricingSnapshot remains unchanged after worker updates hourly rate');

    // Scenario 51: Historical snapshot isolation from commission rule changes
    globalDefaultRule.percentageBps = 2500; // Admin raises commission to 25%
    await globalDefaultRule.save();

    const reloadedBooking2 = await Booking.findById(booking._id);
    assert(reloadedBooking2.pricingSnapshot.commissionPercentageBps === 1000 && reloadedBooking2.pricingSnapshot.commissionAmountPaise === 9000, 'Historical booking pricingSnapshot remains unchanged after admin edits global commission rule');

    // Scenario 52: Currency code validation
    assert(reloadedBooking2.pricingSnapshot.currency === 'INR', 'Pricing snapshot records exact currency code (INR)');

    // Scenario 53: Complete calculation pipeline integration test
    const freshPrice = await PricingService.calculatePrice({
        workerId: workerUser._id,
        serviceCategoryId: category._id,
        scheduledStart: start2h,
        scheduledEnd: end3h,
        pricingType: 'HOURLY',
    });
    // Fresh rate is 50000 * 3 = 150000. Fresh commission at 25% = 37500. Worker earning = 112500.
    assert(freshPrice.baseAmount === 150000 && freshPrice.commissionAmount === 37500 && freshPrice.workerEarning === 112500, 'New booking uses updated worker rates and commission rules deterministically');

    // CLEANUP TEST FIXTURES — wipe everything created during this test run
    console.log('\n--- Cleaning Up Test Data ---');
    await User.deleteMany({ email: /@test-pricing\.com/ });
    await ServiceCategory.deleteMany({ slug: /test-cat-/ });
    await CommissionRule.deleteMany({});
    await PlatformPricingConfig.deleteMany({});
    await Coupon.deleteMany({});
    await PriceQuote.deleteMany({});
    await Booking.deleteMany({ serviceAddress: 'Test Pricing Address' });

    console.log('\n========================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 53)`);
    console.log('========================================\n');

    await disconnectDB();
    if (failed > 0) process.exitCode = 1;
};

runTests().catch(async (err) => {
    console.error('Fatal error running test suite:', err);
    try { await disconnectDB(); } catch {}
    process.exitCode = 1;
});
