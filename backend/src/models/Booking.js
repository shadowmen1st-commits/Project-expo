import { Schema, model } from 'mongoose';

const bookingSchema = new Schema(
    {
        bookingNumber: { type: String, required: true, unique: true, trim: true },
        quoteId: { type: Schema.Types.ObjectId, ref: 'PriceQuote' },
        customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        serviceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', required: true },
        serviceAddress: { type: String, required: true },
        addressSnapshot: {
            houseNumber: String,
            street: String,
            locality: String,
            landmark: String,
            city: String,
            state: String,
            pincode: String,
            addressType: { type: String, enum: ['HOME', 'OFFICE', 'OTHER'], default: 'HOME' },
            instructions: String,
            addressLine: String,
            latitude: Number,
            longitude: Number,
        },
        scheduledStart: { type: Date, required: true },
        scheduledEnd: { type: Date, required: true },
        bookingDate: { type: String },
        bookingTime: { type: String },
        durationMinutes: { type: Number, required: true },
        pricingType: { type: String, enum: ['HOURLY', 'DAILY'], required: true },
        
        // Integer Paise amounts
        baseAmount: { type: Number, required: true },
        platformFee: { type: Number, required: true },
        taxAmount: { type: Number, required: true },
        discountAmount: { type: Number, required: true, default: 0 },
        totalAmount: { type: Number, required: true },
        commissionPercentage: { type: Number, required: true },
        commissionAmount: { type: Number, required: true },
        workerEarning: { type: Number, required: true },
        currency: { type: String, default: 'INR' },

        // Embedded Immutable Pricing Snapshot
        pricingSnapshot: {
            pricingVersion: { type: Number, default: 1 },
            currency: { type: String, default: 'INR' },
            pricingType: { type: String, enum: ['HOURLY', 'DAILY'] },
            rateSource: { type: String, default: 'WORKER_PROFILE' },
            hourlyRatePaise: Number,
            dailyRatePaise: Number,
            durationMinutes: Number,
            durationDays: Number,
            rawServiceAmountPaise: Number,
            minimumChargeAdjustmentPaise: { type: Number, default: 0 },
            baseAmountPaise: Number,
            couponId: Schema.Types.ObjectId,
            couponCodeMasked: String,
            discountType: String,
            discountValue: Number,
            discountAmountPaise: { type: Number, default: 0 },
            serviceAmountAfterDiscountPaise: Number,
            platformFeeType: String,
            platformFeeBps: Number,
            platformFeeFixedPaise: Number,
            platformFeeAmountPaise: Number,
            taxEnabled: Boolean,
            taxRateBps: Number,
            taxApplicationMode: String,
            taxableAmountPaise: Number,
            taxAmountPaise: Number,
            customerTotalPaise: Number,
            commissionRuleId: Schema.Types.ObjectId,
            commissionRuleVersion: Number,
            commissionRuleName: String,
            commissionScope: String,
            commissionCalculationType: String,
            commissionPercentageBps: Number,
            commissionFixedAmountPaise: Number,
            minimumCommissionPaise: Number,
            maximumCommissionPaise: Number,
            commissionBasePaise: Number,
            commissionAmountPaise: Number,
            workerEarningPaise: Number,
            surgeRuleId: Schema.Types.ObjectId,
            surgeMultiplierBps: Number,
            calculatedAt: Date,
            quoteId: Schema.Types.ObjectId,
        },

        bookingStatus: {
            type: String,
            enum: [
                'REQUESTED',
                'PAYMENT_PENDING',
                'PAID',
                'ACCEPTED',
                'REJECTED',
                'CONFIRMED',
                'WORKER_EN_ROUTE',
                'STARTED',
                'COMPLETION_REQUESTED',
                'COMPLETED',
                'CANCELLED',
                'DISPUTED',
                'REFUNDED',
            ],
            default: 'PAYMENT_PENDING',
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'AUTHORISED', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'],
            default: 'PENDING',
        },
        escrowStatus: {
            type: String,
            enum: [
                'NOT_FUNDED',
                'FUNDED',
                'HELD',
                'RELEASE_PENDING',
                'RELEASED',
                'REFUND_PENDING',
                'REFUNDED',
                'FROZEN',
            ],
            default: 'NOT_FUNDED',
        },
        customerNotes: { type: String },
        workerNotes: { type: String },
        cancellationReason: { type: String },
        cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String },
        
        // Transition Timestamps
        acceptedAt: { type: Date },
        rejectedAt: { type: Date },
        confirmedAt: { type: Date },
        workerEnRouteAt: { type: Date },
        startedAt: { type: Date },
        completionRequestedAt: { type: Date },
        completedAt: { type: Date },
        cancelledAt: { type: Date },
        expiresAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

// Indexes (non-unique only — unique bookingNumber auto-indexed)
bookingSchema.index({ customerId: 1, createdAt: -1 });
bookingSchema.index({ workerId: 1, scheduledStart: 1 });
bookingSchema.index({ workerId: 1, bookingStatus: 1 });
bookingSchema.index({ customerId: 1, bookingStatus: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ escrowStatus: 1 });
bookingSchema.index({ scheduledStart: 1 });
bookingSchema.index({ expiresAt: 1 }, { sparse: true });

export const Booking = model('Booking', bookingSchema);
export default Booking;
