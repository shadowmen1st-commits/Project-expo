import { Schema, model } from 'mongoose';

const workerPayoutAccountSchema = new Schema({
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountType: { type: String, enum: ['BANK_ACCOUNT', 'VPA'], required: true },
    displayName: { type: String, trim: true, required: true },
    beneficiaryName: { type: String, trim: true, required: true },
    encryptedAccountNumber: { type: String },
    accountNumberLast4: { type: String, trim: true },
    encryptedIfsc: { type: String },
    ifscMasked: { type: String },
    encryptedVpa: { type: String },
    vpaMasked: { type: String },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    provider: { type: String, default: 'razorpayx' },
    providerContactId: { type: String },
    providerFundAccountId: { type: String },
    providerValidationId: { type: String },
    verificationStatus: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'REQUIRES_UPDATE'], default: 'PENDING' },
    validationStatus: { type: String, enum: ['NOT_STARTED', 'PENDING', 'VALID', 'INVALID', 'FAILED'], default: 'NOT_STARTED' },
    status: { type: String, enum: ['ACTIVE', 'DISABLED', 'BLOCKED', 'ARCHIVED'], default: 'ACTIVE' },
    isDefault: { type: Boolean, default: false },
    workerConsentAt: { type: Date },
    verifiedAt: { type: Date },
    rejectedAt: { type: Date },
    disabledAt: { type: Date },
    rejectionReasonSafe: { type: String },
    fingerprint: { type: String, required: true, unique: true, trim: true },
    encryptionKeyVersion: { type: String, default: 'v1' },
}, { timestamps: true });

workerPayoutAccountSchema.index({ workerId: 1, status: 1 });
workerPayoutAccountSchema.index({ verificationStatus: 1 });
workerPayoutAccountSchema.index({ isDefault: 1 });

export const WorkerPayoutAccount = model('WorkerPayoutAccount', workerPayoutAccountSchema);
export default WorkerPayoutAccount;
