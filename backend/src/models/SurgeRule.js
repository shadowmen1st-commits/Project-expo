import { Schema, model } from 'mongoose';

const surgeRuleSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        serviceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', default: null },
        city: { type: String, trim: true },
        daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 (Sun) - 6 (Sat)
        startTime: { type: String, trim: true }, // "08:00"
        endTime: { type: String, trim: true }, // "20:00"
        effectiveFrom: { type: Date, default: Date.now },
        effectiveUntil: { type: Date },
        multiplierBps: { type: Number, required: true, default: 10000, min: 10000, max: 50000 }, // 10000 = 1.0x
        maximumMultiplierBps: { type: Number, default: 30000 }, // 3.0x max
        priority: { type: Number, default: 1 },
        isActive: { type: Boolean, default: false }, // Disabled by default
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
    }
);

surgeRuleSchema.index({ isActive: 1, serviceCategoryId: 1 });

export const SurgeRule = model('SurgeRule', surgeRuleSchema);
export default SurgeRule;
