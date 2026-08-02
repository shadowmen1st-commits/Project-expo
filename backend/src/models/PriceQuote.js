import { Schema, model } from 'mongoose';

const priceQuoteSchema = new Schema(
    {
        quoteNumber: { type: String, required: true, unique: true, trim: true },
        customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        serviceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
        scheduledStart: { type: Date, required: true },
        scheduledEnd: { type: Date, required: true },
        pricingType: { type: String, enum: ['HOURLY', 'DAILY'], required: true },
        durationMinutes: { type: Number, required: true },
        durationDays: { type: Number, default: 0 },
        pricingSnapshot: { type: Schema.Types.Mixed, required: true },
        status: {
            type: String,
            enum: ['ACTIVE', 'CONSUMED', 'EXPIRED', 'CANCELLED'],
            default: 'ACTIVE',
        },
        expiresAt: { type: Date, required: true },
        consumedAt: { type: Date },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    },
    {
        timestamps: true,
    }
);

// Indexes (non-unique only — unique quoteNumber auto-indexed)
priceQuoteSchema.index({ customerId: 1, status: 1 });
priceQuoteSchema.index({ expiresAt: 1 });

export const PriceQuote = model('PriceQuote', priceQuoteSchema);
export default PriceQuote;
