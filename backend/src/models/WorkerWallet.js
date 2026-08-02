import { Schema, model } from 'mongoose';

const workerWalletSchema = new Schema({
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    currency: { type: String, default: 'INR', required: true },
    pendingBalancePaise: { type: Number, required: true, default: 0 },
    availableBalancePaise: { type: Number, required: true, default: 0 },
    reservedBalancePaise: { type: Number, required: true, default: 0 },
    frozenBalancePaise: { type: Number, required: true, default: 0 },
    totalEarnedPaise: { type: Number, required: true, default: 0 },
    totalWithdrawnPaise: { type: Number, required: true, default: 0 },
    totalCommissionDeductedPaise: { type: Number, required: true, default: 0 },
    totalRefundDeductedPaise: { type: Number, required: true, default: 0 },
    ledgerVersion: { type: Number, required: true, default: 0 },
    lastLedgerTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    lastReconciledAt: { type: Date },
    reconciliationStatus: {
        type: String,
        enum: ['RECONCILED', 'MISMATCH'],
        default: 'RECONCILED',
    },
}, {
    timestamps: true,
});

workerWalletSchema.index({ reconciliationStatus: 1 });

export const WorkerWallet = model('WorkerWallet', workerWalletSchema);
export default WorkerWallet;
