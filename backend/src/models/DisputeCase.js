import { Schema, model } from 'mongoose';
import Booking from './Booking.js';

const disputeCaseSchema = new Schema({
    disputeNumber: { type: String, required: true, unique: true, trim: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    openedByType: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SYSTEM'],
        required: true,
    },
    openedById: { type: Schema.Types.ObjectId, required: true },
    disputeType: {
        type: String,
        enum: [
            'SERVICE_NOT_PROVIDED',
            'SERVICE_INCOMPLETE',
            'SERVICE_QUALITY',
            'WORKER_NO_SHOW',
            'CUSTOMER_NO_SHOW',
            'OVERCHARGE',
            'SAFETY_CONCERN',
            'PROPERTY_DAMAGE',
            'INCORRECT_SERVICE',
            'UNAUTHORISED_COMPLETION',
            'PAYMENT_ISSUE',
            'CANCELLATION_DISPUTE',
            'OTHER'
        ],
        required: true,
    },
    reasonCode: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    claimedAmountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', required: true },
    status: {
        type: String,
        enum: [
            'OPEN',
            'UNDER_REVIEW',
            'EVIDENCE_REQUIRED',
            'CUSTOMER_RESPONSE_REQUIRED',
            'WORKER_RESPONSE_REQUIRED',
            'RESOLUTION_PENDING',
            'RESOLVED_CUSTOMER',
            'RESOLVED_WORKER',
            'PARTIALLY_RESOLVED',
            'REJECTED',
            'CANCELLED',
            'CLOSED'
        ],
        default: 'OPEN',
        required: true,
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM',
        required: true,
    },
    financialFreezeStatus: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'FROZEN', 'PARTIALLY_FROZEN', 'RELEASED', 'FAILED'],
        default: 'NOT_REQUIRED',
        required: true,
    },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    workerResponseDueAt: { type: Date },
    customerEvidenceDueAt: { type: Date },
    workerEvidenceDueAt: { type: Date },
    reviewStartedAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    cancelledAt: { type: Date },
    resolutionType: {
        type: String,
        enum: [
            'FULL_REFUND',
            'PARTIAL_REFUND',
            'NO_REFUND',
            'WORKER_FAVOURED',
            'CUSTOMER_FAVOURED',
            'SHARED_LIABILITY',
            'SERVICE_CREDIT_ONLY'
        ],
    },
    approvedRefundAmountPaise: { type: Number, default: 0, min: 0 },
    workerLiabilityAmountPaise: { type: Number, default: 0, min: 0 },
    platformLiabilityAmountPaise: { type: Number, default: 0, min: 0 },
    resolutionSummary: { type: String },
    internalAdminNotes: { type: String },
    version: { type: Number, default: 1 },
}, {
    timestamps: true,
});

disputeCaseSchema.pre('save', async function (next) {
    if (!this.isModified('claimedAmountPaise') && !this.isNew) {
        return next();
    }

    try {
        const booking = await Booking.findById(this.bookingId);
        if (!booking) {
            return next(new Error('Booking not found for dispute claim validation.'));
        }
        const maxClaim = booking.pricingSnapshot?.customerTotalPaise || booking.totalAmount || 0;
        if (this.claimedAmountPaise > maxClaim) {
            return next(new Error('Claimed amount cannot exceed the verified booking payment amount.'));
        }
        return next();
    } catch (error) {
        return next(error);
    }
});

// Indexes (non-unique to prevent warnings)
disputeCaseSchema.index({ bookingId: 1 });
disputeCaseSchema.index({ customerId: 1 });
disputeCaseSchema.index({ workerId: 1 });
disputeCaseSchema.index({ status: 1 });

export const DisputeCase = model('DisputeCase', disputeCaseSchema);
export default DisputeCase;
