import { Schema, model } from 'mongoose';

const ledgerTransactionSchema = new Schema({
    transactionNumber: { type: String, required: true, unique: true, trim: true },
    transactionType: {
        type: String,
        enum: [
            'PAYMENT_CAPTURED',
            'BOOKING_FUNDS_HELD',
            'BOOKING_COMPLETION_ALLOCATION',
            'WORKER_EARNING_PENDING',
            'WORKER_EARNING_AVAILABLE',
            'WORKER_EARNING_RESERVED',
            'SETTLEMENT_HOLD_RELEASE',
            'CORRECTIVE_REVERSAL',
            'ADMIN_CORRECTIVE_JOURNAL',
            'REFUND_PLACEHOLDER',
            'PAYOUT_PLACEHOLDER',
            'REFUND_APPROVED',
            'REFUND_PROCESSED',
            'TEST_EARNING',
            'WORKER_PAYOUT_RESERVATION',
            'WORKER_PAYOUT_PROCESSING',
            'WORKER_PAYOUT_RELEASE',
            'WORKER_PAYOUT_FAILED_RELEASE',
            'WORKER_PAYOUT_REVERSAL',
            'WORKER_PAYOUT_CANCELLATION',
        ],
        required: true,
    },
    status: {
        type: String,
        enum: ['DRAFT', 'POSTING', 'POSTED', 'REVERSING', 'REVERSED', 'FAILED'],
        default: 'DRAFT',
        required: true,
    },
    currency: { type: String, default: 'INR', required: true },
    businessEvent: { type: String, required: true },
    referenceType: { type: String },
    referenceId: { type: Schema.Types.ObjectId },
    bookingId: { type: Schema.Types.ObjectId },
    paymentOrderId: { type: Schema.Types.ObjectId },
    paymentTransactionId: { type: Schema.Types.ObjectId },
    workerId: { type: Schema.Types.ObjectId },
    customerId: { type: Schema.Types.ObjectId },
    idempotencyKey: { type: String, required: true, unique: true },
    reversalOfTransactionId: { type: Schema.Types.ObjectId },
    reversedByTransactionId: { type: Schema.Types.ObjectId },
    totalDebitPaise: { type: Number, required: true, default: 0 },
    totalCreditPaise: { type: Number, required: true, default: 0 },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
    postedByType: {
        type: String,
        enum: ['SYSTEM', 'ADMIN', 'USER'],
        default: 'SYSTEM',
    },
    postedById: { type: Schema.Types.ObjectId },
    requestId: { type: String },
    effectiveAt: { type: Date, default: Date.now, required: true },
    postedAt: { type: Date },
    reversedAt: { type: Date },
}, {
    timestamps: true,
});

// Indexes (ensure no duplicate index warnings)
ledgerTransactionSchema.index({ bookingId: 1 });
ledgerTransactionSchema.index({ workerId: 1 });
ledgerTransactionSchema.index({ status: 1 });
ledgerTransactionSchema.index({ transactionType: 1 });
ledgerTransactionSchema.index({ reversalOfTransactionId: 1 });

export const LedgerTransaction = model('LedgerTransaction', ledgerTransactionSchema);
export default LedgerTransaction;
