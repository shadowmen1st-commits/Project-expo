import { Schema, model } from 'mongoose';

const payoutPolicySchema = new Schema({
    minimumPayoutPaise: { type: Number, required: true, default: 10000 },
    maximumPayoutPaise: { type: Number, required: true, default: 500000 },
    dailyPayoutLimitPaise: { type: Number, required: true, default: 200000 },
    monthlyPayoutLimitPaise: { type: Number, required: true, default: 1000000 },
    maximumDailyRequests: { type: Number, required: true, default: 3 },
    settlementSchedule: { type: String, default: 'T+1' },
    manualReviewThresholdPaise: { type: Number, required: true, default: 200000 },
    supportedModes: [{ type: String, enum: ['IMPS', 'NEFT', 'RTGS', 'UPI'] }],
    providerFeesPolicy: { type: Schema.Types.Mixed, default: {} },
    taxPolicy: { type: Schema.Types.Mixed, default: {} },
    payoutAccountValidationRequired: { type: Boolean, default: true },
    KycRequired: { type: Boolean, default: true },
    coolDownMinutes: { type: Number, default: 0 },
    effectiveFrom: { type: Date, required: true },
    effectiveUntil: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, trim: true },
    updatedBy: { type: String, trim: true },
}, { timestamps: true });

payoutPolicySchema.index({ isActive: 1, effectiveFrom: -1 });

export const PayoutPolicy = model('PayoutPolicy', payoutPolicySchema);
export default PayoutPolicy;
