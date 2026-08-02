import { Schema, model } from 'mongoose';

const couponSchema = new Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        description: { type: String, trim: true },
        discountType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED'],
            required: true,
        },
        percentageBps: { type: Number, min: 0, max: 10000, default: 0 },
        fixedAmountPaise: { type: Number, min: 0, default: 0 },
        maximumDiscountPaise: { type: Number, min: 0 },
        minimumOrderAmountPaise: { type: Number, min: 0, default: 0 },
        applicableCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }],
        applicableWorkerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        validFrom: { type: Date, default: Date.now },
        validUntil: { type: Date },
        usageLimit: { type: Number, min: 0 },
        perCustomerUsageLimit: { type: Number, default: 1, min: 1 },
        currentUsageCount: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

// Indexes (non-unique only — unique code auto-indexed)
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

export const Coupon = model('Coupon', couponSchema);
export default Coupon;
