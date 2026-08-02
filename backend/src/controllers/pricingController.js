import crypto from 'crypto';
import PriceQuote from '../models/PriceQuote.js';
import CommissionRule from '../models/CommissionRule.js';
import AuditLog from '../models/AuditLog.js';
import PricingService from '../services/PricingService.js';
import CommissionResolverService from '../services/CommissionResolverService.js';
import { paiseToDisplayRupees, rupeesToPaise } from '../utils/moneyUtils.js';

/**
 * Customer Action: Generate Server-Side Price Quote
 * POST /api/v1/pricing/quote
 */
export const createPriceQuote = async (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'CUSTOMER') {
        res.status(403).json({ success: false, message: 'Only customers can request price quotes.' });
        return;
    }
    try {
        const { workerId, serviceCategoryId, scheduledStart, scheduledEnd, pricingType, couponCode } = req.body;

        const pricingResult = await PricingService.calculatePrice({
            workerId,
            serviceCategoryId,
            scheduledStart,
            scheduledEnd,
            pricingType: pricingType || 'HOURLY',
            couponCode,
            customerId: user.userId,
        });

        // Store Quote with 15-minute expiration
        const quoteNumber = `QTE-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        const quote = new PriceQuote({
            quoteNumber,
            customerId: user.userId,
            workerId,
            serviceCategoryId,
            scheduledStart: new Date(scheduledStart),
            scheduledEnd: new Date(scheduledEnd),
            pricingType: pricingType || 'HOURLY',
            durationMinutes: pricingResult.pricingSnapshot.durationMinutes,
            durationDays: pricingResult.pricingSnapshot.durationDays,
            pricingSnapshot: pricingResult.pricingSnapshot,
            status: 'ACTIVE',
            expiresAt,
        });

        await quote.save();

        res.status(201).json({
            success: true,
            quoteId: quote._id,
            quoteNumber: quote.quoteNumber,
            expiresAt: quote.expiresAt,
            currency: pricingResult.pricingSnapshot.currency,
            pricingType: pricingResult.pricingSnapshot.pricingType,
            durationMinutes: pricingResult.pricingSnapshot.durationMinutes,
            breakdown: {
                baseAmountPaise: pricingResult.baseAmount,
                baseAmountRupees: paiseToDisplayRupees(pricingResult.baseAmount),
                platformFeePaise: pricingResult.platformFee,
                platformFeeRupees: paiseToDisplayRupees(pricingResult.platformFee),
                taxAmountPaise: pricingResult.taxAmount,
                taxAmountRupees: paiseToDisplayRupees(pricingResult.taxAmount),
                discountAmountPaise: pricingResult.discountAmount,
                discountAmountRupees: paiseToDisplayRupees(pricingResult.discountAmount),
                totalAmountPaise: pricingResult.totalAmount,
                totalAmountRupees: paiseToDisplayRupees(pricingResult.totalAmount),
            },
        });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({
                success: false,
                statusCode: error.statusCode,
                errorCode: error.errorCode || 'QUOTE_CALCULATION_FAILED',
                message: error.message,
            });
            return;
        }
        next(error);
    }
};

/**
 * Admin Action: List All Commission Rules
 * GET /api/v1/admin/commission-rules
 */
export const getCommissionRules = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const { scope, status } = req.query;
        const query = {};
        if (scope) query.scope = scope;
        if (status) query.status = status;

        const rules = await CommissionRule.find(query)
            .populate('serviceCategoryId', 'name icon')
            .populate('workerId', 'name email')
            .populate('createdBy', 'name')
            .sort({ priority: 1, createdAt: -1 });

        res.status(200).json({ success: true, rules });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin Action: Get Single Commission Rule Details
 * GET /api/v1/admin/commission-rules/:id
 */
export const getCommissionRuleDetails = async (req, res, next) => {
    const { id } = req.params;
    try {
        const rule = await CommissionRule.findById(id)
            .populate('serviceCategoryId', 'name icon')
            .populate('workerId', 'name email');
        if (!rule) {
            res.status(404).json({ success: false, message: 'Commission rule not found.' });
            return;
        }
        res.status(200).json({ success: true, rule });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin Action: Preview Commission Calculation for Custom Amount
 * POST /api/v1/admin/commission-rules/preview
 */
export const previewCommissionRule = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const { percentageBps, fixedAmountPaise, minimumCommissionPaise, maximumCommissionPaise, sampleAmountsRupees } = req.body;
        const amounts = sampleAmountsRupees || [500, 1000, 2500];

        const previews = amounts.map((rupees) => {
            const basePaise = rupeesToPaise(rupees);
            const pctPaise = Math.round((basePaise * (percentageBps || 0)) / 10000);
            let commPaise = pctPaise + (fixedAmountPaise || 0);

            if (minimumCommissionPaise && commPaise < minimumCommissionPaise) {
                commPaise = minimumCommissionPaise;
            }
            if (maximumCommissionPaise && commPaise > maximumCommissionPaise) {
                commPaise = maximumCommissionPaise;
            }
            if (commPaise > basePaise) {
                commPaise = basePaise;
            }

            const workerEarningPaise = Math.max(0, basePaise - commPaise);

            return {
                sampleRupees: rupees,
                basePaise,
                commissionPaise: commPaise,
                commissionRupees: paiseToDisplayRupees(commPaise),
                workerEarningPaise,
                workerEarningRupees: paiseToDisplayRupees(workerEarningPaise),
            };
        });

        res.status(200).json({ success: true, previews });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin Action: Create New Commission Rule with Conflict Detection
 * POST /api/v1/admin/commission-rules
 */
export const createCommissionRule = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const {
            name,
            description,
            scope,
            serviceCategoryId,
            workerId,
            calculationType,
            percentageBps,
            fixedAmountPaise,
            minimumCommissionPaise,
            maximumCommissionPaise,
            priority,
            effectiveFrom,
            effectiveUntil,
        } = req.body;

        // Scope validation
        if (scope === 'GLOBAL') {
            if (serviceCategoryId || workerId) {
                res.status(400).json({ success: false, message: 'GLOBAL rules must not specify category or worker.' });
                return;
            }
        } else if (scope === 'CATEGORY') {
            if (!serviceCategoryId || workerId) {
                res.status(400).json({ success: false, message: 'CATEGORY rules require serviceCategoryId and no workerId.' });
                return;
            }
        } else if (scope === 'WORKER') {
            if (!workerId) {
                res.status(400).json({ success: false, message: 'WORKER rules require workerId.' });
                return;
            }
        }

        // Conflict check
        const conflicts = await CommissionResolverService.detectConflicts({
            scope,
            serviceCategoryId,
            workerId,
            priority: priority || (scope === 'WORKER' ? 1 : scope === 'CATEGORY' ? 2 : 3),
            effectiveFrom: effectiveFrom || new Date(),
            effectiveUntil,
        });

        if (conflicts.length > 0) {
            res.status(409).json({
                success: false,
                statusCode: 409,
                errorCode: 'COMMISSION_RULE_CONFLICT',
                message: 'Conflicting active rule exists with same scope and priority.',
                conflictingRules: conflicts.map((c) => ({ id: c._id, name: c.name, scope: c.scope })),
            });
            return;
        }

        const rule = new CommissionRule({
            name,
            description,
            scope,
            serviceCategoryId: serviceCategoryId || null,
            workerId: workerId || null,
            calculationType: calculationType || 'PERCENTAGE',
            percentageBps: percentageBps ?? 1000,
            fixedAmountPaise: fixedAmountPaise || 0,
            minimumCommissionPaise: minimumCommissionPaise || 0,
            maximumCommissionPaise: maximumCommissionPaise || null,
            priority: priority || (scope === 'WORKER' ? 1 : scope === 'CATEGORY' ? 2 : 3),
            effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
            effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
            isActive: true,
            status: 'ACTIVE',
            createdBy: user.userId,
        });

        await rule.save();

        // Audit Log
        await new AuditLog({
            actor: user.userId,
            action: 'COMMISSION_RULE_CREATED',
            resourceType: 'CommissionRule',
            resourceId: rule._id.toString(),
            afterSnapshot: { ruleName: rule.name, scope: rule.scope, priority: rule.priority },
        }).save();

        res.status(201).json({ success: true, message: 'Commission rule created successfully.', rule });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin Action: Resolve Rule Preview for Context
 * POST /api/v1/admin/commission-rules/resolve-preview
 */
export const resolveCommissionPreview = async (req, res, next) => {
    try {
        const { workerId, serviceCategoryId, targetDate } = req.body;
        const resolution = await CommissionResolverService.resolveCommissionRule({
            workerId: workerId || '000000000000000000000000',
            serviceCategoryId,
            targetDate: targetDate ? new Date(targetDate) : new Date(),
        });
        res.status(200).json({ success: true, resolution });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({
                success: false,
                statusCode: error.statusCode,
                errorCode: error.errorCode || 'RESOLUTION_FAILED',
                message: error.message,
            });
            return;
        }
        next(error);
    }
};
