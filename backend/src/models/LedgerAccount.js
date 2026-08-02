import { Schema, model } from 'mongoose';

const ledgerAccountSchema = new Schema({
    accountNumber: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    accountType: {
        type: String,
        enum: ['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY'],
        required: true,
    },
    normalBalance: {
        type: String,
        enum: ['DEBIT', 'CREDIT'],
        required: true,
    },
    ownerType: {
        type: String,
        enum: ['PLATFORM', 'WORKER', 'CUSTOMER', 'BOOKING', 'PROVIDER', 'SYSTEM'],
        required: true,
    },
    ownerId: { type: Schema.Types.ObjectId },
    currency: { type: String, default: 'INR', required: true },
    status: {
        type: String,
        enum: ['ACTIVE', 'FROZEN', 'CLOSED'],
        default: 'ACTIVE',
        required: true,
    },
    allowManualPosting: { type: Boolean, default: false },
    systemManaged: { type: Boolean, default: true },
    cachedDebitTotalPaise: { type: Number, default: 0, required: true },
    cachedCreditTotalPaise: { type: Number, default: 0, required: true },
    cachedBalancePaise: { type: Number, default: 0, required: true },
    lastPostedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
}, {
    timestamps: true,
});

// Indexes (ensure no duplicate index warnings)
// Compound index to help resolve accounts deterministically
ledgerAccountSchema.index({ code: 1, ownerType: 1, ownerId: 1, currency: 1 }, { unique: true, sparse: true });
ledgerAccountSchema.index({ ownerId: 1 });
ledgerAccountSchema.index({ status: 1 });

export const LedgerAccount = model('LedgerAccount', ledgerAccountSchema);
export default LedgerAccount;
