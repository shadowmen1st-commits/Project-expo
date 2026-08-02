import { Schema, model } from 'mongoose';

const workerPayoutSchema = new Schema({
    payoutNumber: { type: String, required: true, unique: true, trim: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payoutAccountId: { type: Schema.Types.ObjectId, ref: 'WorkerPayoutAccount', required: true },
    provider: { type: String, default: 'razorpayx' },
    providerContactId: { type: String },
    providerFundAccountId: { type: String },
    providerPayoutId: { type: String, unique: true, sparse: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', required: true },
    status: { type: String, enum: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESERVING', 'RESERVED', 'PROVIDER_SUBMITTED', 'QUEUED', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'REVERSED', 'CANCELLED', 'MANUAL_REVIEW'], default: 'REQUESTED' },
    source: { type: String, enum: ['WORKER_REQUEST', 'SCHEDULED_PAYOUT', 'ADMIN_INITIATED'], default: 'WORKER_REQUEST' },
    mode: { type: String, enum: ['IMPS', 'NEFT', 'RTGS', 'UPI'], required: true },
    purpose: { type: String, trim: true },
    narrationSafe: { type: String, trim: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    providerIdempotencyKey: { type: String, unique: true, sparse: true, trim: true },
    requestFingerprint: { type: String, required: true, trim: true },
    availableBalanceSnapshotPaise: { type: Number, required: true, default: 0 },
    reservedBalanceSnapshotPaise: { type: Number, required: true, default: 0 },
    feeAmountPaise: { type: Number, default: 0 },
    taxAmountPaise: { type: Number, default: 0 },
    netTransferAmountPaise: { type: Number, default: 0 },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    reservedAt: { type: Date },
    providerSubmittedAt: { type: Date },
    processingAt: { type: Date },
    processedAt: { type: Date },
    failedAt: { type: Date },
    reversedAt: { type: Date },
    cancelledAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    failureCode: { type: String },
    failureDescriptionSafe: { type: String },
    statusDetailsSafe: { type: String },
    ledgerReservationTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    ledgerProcessedTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    ledgerFailureReleaseTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    ledgerReversalTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    ledgerCancellationTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    providerStatus: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

workerPayoutSchema.index({ workerId: 1, status: 1 });
workerPayoutSchema.index({ payoutAccountId: 1 });

export const WorkerPayout = model('WorkerPayout', workerPayoutSchema);
export default WorkerPayout;
