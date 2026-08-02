import { Schema, model } from 'mongoose';

const disputeEvidenceSchema = new Schema({
    disputeId: { type: Schema.Types.ObjectId, ref: 'DisputeCase', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    uploadedByType: {
        type: String,
        enum: ['CUSTOMER', 'WORKER', 'ADMIN', 'SYSTEM'],
        required: true,
    },
    uploadedById: { type: Schema.Types.ObjectId, required: true },
    evidenceType: {
        type: String,
        enum: ['IMAGE', 'VIDEO', 'PDF', 'RECEIPT', 'CHAT_SCREENSHOT', 'SERVICE_DOCUMENT', 'TEXT_STATEMENT', 'OTHER'],
        required: true,
    },
    description: { type: String },
    storageProvider: { type: String, default: 'LOCAL', required: true },
    storageKey: { type: String, required: true },
    fileMimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    checksum: { type: String },
    originalNameSafe: { type: String, required: true },
    visibility: {
        type: String,
        enum: ['ADMIN_ONLY', 'DISPUTE_PARTICIPANTS', 'CUSTOMER_AND_ADMIN', 'WORKER_AND_ADMIN'],
        default: 'DISPUTE_PARTICIPANTS',
        required: true,
    },
    verificationStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED'],
        default: 'PENDING',
        required: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
}, {
    timestamps: true,
});

disputeEvidenceSchema.index({ disputeId: 1 });
disputeEvidenceSchema.index({ bookingId: 1 });

export const DisputeEvidence = model('DisputeEvidence', disputeEvidenceSchema);
export default DisputeEvidence;
