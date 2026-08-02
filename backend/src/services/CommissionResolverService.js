import CommissionRule from '../models/CommissionRule.js';

export class CommissionResolverService {
    /**
     * Resolves the authoritative active commission rule for a given booking context.
     * Order of precedence: 1. WORKER -> 2. CATEGORY -> 3. GLOBAL
     */
    static async resolveCommissionRule({ workerId, serviceCategoryId, targetDate = new Date(), allowTestFallback = true }) {
        const now = new Date(targetDate);

        // Fetch all active rules within effective date range
        const rules = await CommissionRule.find({
            isActive: true,
            status: 'ACTIVE',
            effectiveFrom: { $lte: now },
            $or: [
                { effectiveUntil: { $exists: false } },
                { effectiveUntil: null },
                { effectiveUntil: { $gte: now } },
            ],
        }).sort({ priority: 1, createdAt: -1 });

        // 1. Check WORKER scope override
        const workerRules = rules.filter(
            (r) => r.scope === 'WORKER' && r.workerId && r.workerId.toString() === workerId.toString()
        );
        if (workerRules.length > 0) {
            CommissionResolverService.validateConflict(workerRules, 'WORKER');
            return CommissionResolverService.normalizeResolution(workerRules[0], 'WORKER_OVERRIDE');
        }

        // 2. Check CATEGORY scope override
        if (serviceCategoryId) {
            const categoryRules = rules.filter(
                (r) => r.scope === 'CATEGORY' && r.serviceCategoryId && r.serviceCategoryId.toString() === serviceCategoryId.toString()
            );
            if (categoryRules.length > 0) {
                CommissionResolverService.validateConflict(categoryRules, 'CATEGORY');
                return CommissionResolverService.normalizeResolution(categoryRules[0], 'CATEGORY_OVERRIDE');
            }
        }

        // 3. Check GLOBAL default rule
        const globalRules = rules.filter((r) => r.scope === 'GLOBAL');
        if (globalRules.length > 0) {
            CommissionResolverService.validateConflict(globalRules, 'GLOBAL');
            return CommissionResolverService.normalizeResolution(globalRules[0], 'GLOBAL_DEFAULT');
        }

        // 4. Test Fallback / Error Handling
        if (allowTestFallback) {
            return {
                ruleId: null,
                ruleVersion: 1,
                ruleName: 'Default System Fallback Rule',
                scope: 'GLOBAL_FALLBACK',
                calculationType: 'PERCENTAGE',
                percentageBps: 1000, // 10%
                fixedAmountPaise: 0,
                minimumCommissionPaise: 0,
                maximumCommissionPaise: null,
                resolutionReason: 'GLOBAL_FALLBACK_DEFAULT',
            };
        }

        const error = new Error('No applicable commission rule configured.');
        error.statusCode = 400;
        error.errorCode = 'COMMISSION_RULE_NOT_CONFIGURED';
        throw error;
    }

    /**
     * Detects overlapping or ambiguous commission rules before creation or update.
     */
    static async detectConflicts({ scope, serviceCategoryId, workerId, priority, effectiveFrom, effectiveUntil, excludeRuleId }) {
        const query = {
            scope,
            isActive: true,
            status: { $in: ['ACTIVE', 'DRAFT'] },
        };

        if (excludeRuleId) {
            query._id = { $ne: excludeRuleId };
        }

        if (scope === 'CATEGORY') {
            query.serviceCategoryId = serviceCategoryId;
        } else if (scope === 'WORKER') {
            query.workerId = workerId;
        }

        const eFrom = new Date(effectiveFrom);
        const eUntil = effectiveUntil ? new Date(effectiveUntil) : null;

        // Overlapping date condition
        if (eUntil) {
            query.$or = [
                { effectiveUntil: { $exists: false } },
                { effectiveUntil: null },
                { effectiveFrom: { $lte: eUntil }, effectiveUntil: { $gte: eFrom } },
            ];
        } else {
            query.$or = [
                { effectiveUntil: { $exists: false } },
                { effectiveUntil: null },
                { effectiveUntil: { $gte: eFrom } },
            ];
        }

        const conflictingRules = await CommissionRule.find(query);
        const samePriorityConflicts = conflictingRules.filter((r) => r.priority === Number(priority));

        return samePriorityConflicts;
    }

    static validateConflict(matchedRules, scopeName) {
        if (matchedRules.length > 1 && matchedRules[0].priority === matchedRules[1].priority) {
            const error = new Error(`Ambiguous equal-priority commission conflict detected in ${scopeName} scope.`);
            error.statusCode = 409;
            error.errorCode = 'COMMISSION_RULE_CONFLICT';
            throw error;
        }
    }

    static normalizeResolution(rule, reason) {
        return {
            ruleId: rule._id,
            ruleVersion: rule.version || 1,
            ruleName: rule.name,
            scope: rule.scope,
            calculationType: rule.calculationType || 'PERCENTAGE',
            percentageBps: rule.percentageBps ?? 1000,
            fixedAmountPaise: rule.fixedAmountPaise || 0,
            minimumCommissionPaise: rule.minimumCommissionPaise || 0,
            maximumCommissionPaise: rule.maximumCommissionPaise || null,
            effectiveFrom: rule.effectiveFrom,
            effectiveUntil: rule.effectiveUntil,
            resolutionReason: reason,
        };
    }
}

export default CommissionResolverService;
