import { Schema, model } from 'mongoose';

const cancellationPolicySchema = new Schema({
    name: { type: String, required: true, trim: true },
    serviceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', unique: true, sparse: true },
    cancellationWindowType: {
        type: String,
        enum: ['FLAT_HOURS', 'TIERED', 'STRICT'],
        default: 'FLAT_HOURS',
        required: true,
    },
    freeCancellationBeforeMinutes: { type: Number, required: true, default: 1440 },
    customerCancellationFeeBps: { type: Number, required: true, default: 500 }, // in basis points, e.g. 5% = 500 bps
    customerCancellationFixedPaise: { type: Number, required: true, default: 0 },
    workerCompensationBps: { type: Number, required: true, default: 5000 }, // e.g. 50% of cancellation fee goes to worker
    platformFeeRefundable: { type: Boolean, default: false, required: true },
    taxRefundable: { type: Boolean, default: true, required: true },
    couponRefundPolicy: {
        type: String,
        enum: ['VOIDED', 'RESTORED'],
        default: 'VOIDED',
        required: true,
    },
    noShowPolicy: { type: String, default: 'CHARGE_FULL', required: true },
    effectiveFrom: { type: Date, default: Date.now, required: true },
    effectiveUntil: { type: Date },
    isActive: { type: Boolean, default: true, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true,
});

cancellationPolicySchema.index({ isActive: 1 });

export const CancellationPolicy = model('CancellationPolicy', cancellationPolicySchema);
export default CancellationPolicy;
