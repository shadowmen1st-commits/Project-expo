import { Schema, model } from 'mongoose';

const commissionRuleSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        scope: {
            type: String,
            enum: ['GLOBAL', 'CATEGORY', 'WORKER'],
            required: true,
        },
        serviceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', default: null },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        calculationType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED', 'PERCENTAGE_PLUS_FIXED'],
            default: 'PERCENTAGE',
        },
        percentageBps: { type: Number, min: 0, max: 10000, default: 1000 }, // 1000 bps = 10%
        fixedAmountPaise: { type: Number, default: 0, min: 0 },
        minimumCommissionPaise: { type: Number, default: 0, min: 0 },
        maximumCommissionPaise: { type: Number, min: 0 },
        priority: { type: Number, required: true, default: 3 }, // 1: Worker, 2: Category, 3: Global
        effectiveFrom: { type: Date, required: true, default: Date.now },
        effectiveUntil: { type: Date },
        isActive: { type: Boolean, default: true },
        status: {
            type: String,
            enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED'],
            default: 'ACTIVE',
        },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        deactivatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        deactivatedAt: { type: Date },
        version: { type: Number, default: 1 },
    },
    {
        timestamps: true,
    }
);

// Compound and single-field indexes
commissionRuleSchema.index({ scope: 1, isActive: 1 });
commissionRuleSchema.index({ serviceCategoryId: 1, isActive: 1 });
commissionRuleSchema.index({ workerId: 1, isActive: 1 });
commissionRuleSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });
commissionRuleSchema.index({ scope: 1, serviceCategoryId: 1, workerId: 1, priority: 1 });
commissionRuleSchema.index({ status: 1 });

export const CommissionRule = model('CommissionRule', commissionRuleSchema);
export default CommissionRule;
