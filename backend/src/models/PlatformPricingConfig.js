import { Schema, model } from 'mongoose';

const platformPricingConfigSchema = new Schema(
    {
        currency: { type: String, default: 'INR' },
        customerPlatformFeeType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED', 'PERCENTAGE_PLUS_FIXED'],
            default: 'FIXED',
        },
        customerPlatformFeeBps: { type: Number, default: 0, min: 0, max: 10000 },
        customerPlatformFeeFixedPaise: { type: Number, default: 5000, min: 0 }, // ₹50.00
        minimumPlatformFeePaise: { type: Number, default: 0, min: 0 },
        maximumPlatformFeePaise: { type: Number, min: 0 },
        
        taxEnabled: { type: Boolean, default: true },
        taxRateBps: { type: Number, default: 1800, min: 0, max: 10000 }, // 18% GST
        taxApplicationMode: {
            type: String,
            enum: ['EXCLUSIVE', 'INCLUSIVE'],
            default: 'EXCLUSIVE',
        },
        
        defaultMinimumBookingAmountPaise: { type: Number, default: 0, min: 0 },
        quoteValiditySeconds: { type: Number, default: 900, min: 60, max: 86400 }, // 15 minutes
        surgePricingEnabled: { type: Boolean, default: false },
        cancellationPricingEnabled: { type: Boolean, default: false },
        
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        version: { type: Number, default: 1 },
    },
    {
        timestamps: true,
    }
);

export const PlatformPricingConfig = model('PlatformPricingConfig', platformPricingConfigSchema);
export default PlatformPricingConfig;
