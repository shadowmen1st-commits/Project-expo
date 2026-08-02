import { Schema, model } from 'mongoose';

const ledgerEntrySchema = new Schema({
    ledgerTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction', required: true },
    lineNumber: { type: Number, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    direction: {
        type: String,
        enum: ['DEBIT', 'CREDIT'],
        required: true,
    },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', required: true },
    bookingId: { type: Schema.Types.ObjectId },
    workerId: { type: Schema.Types.ObjectId },
    customerId: { type: Schema.Types.ObjectId },
    balanceBeforePaise: { type: Number, required: true, default: 0 },
    balanceAfterPaise: { type: Number, required: true, default: 0 },
    description: { type: String },
    metadata: { type: Schema.Types.Mixed },
    effectiveAt: { type: Date, default: Date.now, required: true },
}, {
    timestamps: true,
});

// Indexes (ensure no duplicate index warnings)
ledgerEntrySchema.index({ ledgerTransactionId: 1, lineNumber: 1 }, { unique: true });
ledgerEntrySchema.index({ accountId: 1, createdAt: 1 });
ledgerEntrySchema.index({ bookingId: 1, createdAt: 1 });
ledgerEntrySchema.index({ workerId: 1, createdAt: 1 });
ledgerEntrySchema.index({ customerId: 1, createdAt: 1 });

export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);
export default LedgerEntry;
