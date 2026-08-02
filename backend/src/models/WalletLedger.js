import { Schema, model } from 'mongoose';
const walletLedgerSchema = new Schema({
    reference: { type: String, required: true, unique: true, trim: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    debitAccount: { type: String, required: true, trim: true },
    creditAccount: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },
    transactionType: {
        type: String,
        enum: ['DEPOSIT', 'EARNING', 'WITHDRAWAL', 'COMMISSION', 'REFUND', 'HOLD', 'RELEASE'],
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
    },
    idempotencyKey: { type: String, required: true, unique: true },
    auditReference: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, {
    timestamps: true,
});
// Indexes (non-unique only — unique reference and idempotencyKey auto-indexed)
walletLedgerSchema.index({ userId: 1 });
walletLedgerSchema.index({ bookingId: 1 });
walletLedgerSchema.index({ status: 1 });
export const WalletLedger = model('WalletLedger', walletLedgerSchema);
export default WalletLedger;
