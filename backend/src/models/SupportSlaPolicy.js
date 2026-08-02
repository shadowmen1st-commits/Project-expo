import { Schema, model } from 'mongoose';

const supportSlaPolicySchema = new Schema(
    {
        category: { type: String, required: true },
        priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], required: true },
        firstResponseMinutes: { type: Number, required: true },
        resolutionMinutes: { type: Number, required: true },
        businessHoursPolicy: {
            type: String,
            enum: ['24_7', 'BUSINESS_HOURS_ONLY'],
            default: '24_7'
        },
        escalationRules: [
            {
                triggerMinutes: Number, // Minutes after SLA breach
                action: { type: String, enum: ['NOTIFY_MANAGER', 'REASSIGN_TIER_2', 'ALERT_ADMIN'] }
            }
        ],
        isActive: { type: Boolean, default: false },
        effectiveFrom: { type: Date, required: true },
        effectiveUntil: { type: Date },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

supportSlaPolicySchema.index({ isActive: 1, category: 1, priority: 1 });

export const SupportSlaPolicy = model('SupportSlaPolicy', supportSlaPolicySchema);
export default SupportSlaPolicy;
