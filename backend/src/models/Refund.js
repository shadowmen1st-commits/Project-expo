import { Schema, model } from 'mongoose';

const refundSchema = new Schema({
    refundNumber: { type: String, required: true, unique: true, trim: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    disputeId: { type: Schema.Types.ObjectId, ref: 'DisputeCase' },
    paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
    paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
    provider: { type: String, default: 'razorpay', required: true },
    providerPaymentId: { type: String, required: true },
    providerRefundId: { type: String, unique: true, sparse: true },
    refundType: {
        type: String,
        enum: ['FULL', 'PARTIAL'],
        required: true,
    },
    refundReason: { type: String, required: true },
    requestedAmountPaise: { type: Number, required: true, min: 1 },
    approvedAmountPaise: { type: Number, required: true, min: 1 },
    processedAmountPaise: { type: Number, default: 0 },
    currency: { type: String, default: 'INR', required: true },
    status: {
        type: String,
        enum: [
            'REQUESTED',
            'UNDER_REVIEW',
            'APPROVED',
            'REJECTED',
            'PROCESSING',
            'PROVIDER_SUBMITTED',
            'PROCESSED',
            'PARTIALLY_PROCESSED',
            'FAILED',
            'CANCELLED',
            'REVERSED'
        ],
        default: 'REQUESTED',
        required: true,
    },
    source: {
        type: String,
        enum: [
            'CUSTOMER_CANCELLATION',
            'WORKER_REJECTION',
            'WORKER_NO_SHOW',
            'ADMIN_DISPUTE_RESOLUTION',
            'PAYMENT_DUPLICATE',
            'SERVICE_FAILURE',
            'SYSTEM_CORRECTION'
        ],
        required: true,
    },
    eligibilitySnapshot: { type: Schema.Types.Mixed },
    allocationSnapshot: { type: Schema.Types.Mixed },
    idempotencyKey: { type: String, required: true, unique: true },
    providerIdempotencyReference: { type: String },
    requestedByType: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SYSTEM'],
        required: true,
    },
    requestedById: { type: Schema.Types.ObjectId, required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now, required: true },
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    providerSubmittedAt: { type: Date },
    processedAt: { type: Date },
    failedAt: { type: Date },
    cancelledAt: { type: Date },
    failureCode: { type: String },
    failureDescriptionSafe: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, {
    timestamps: true,
});

refundSchema.index({ bookingId: 1 });
refundSchema.index({ customerId: 1 });
refundSchema.index({ workerId: 1 });
refundSchema.index({ status: 1 });

export const Refund = model('Refund', refundSchema);
export default Refund;
