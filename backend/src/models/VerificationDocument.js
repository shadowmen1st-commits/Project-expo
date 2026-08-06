import { Schema, model } from 'mongoose';
const verificationDocumentSchema = new Schema({
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    documentType: {
        type: String,
        enum: [
            'AADHAAR',
            'PAN',
            'DRIVING_LICENSE',
            'ADDRESS_PROOF',
            'POLICE_VERIFICATION',
            'EXPERIENCE_CERTIFICATE',
            'OTHER',
        ],
        required: true,
    },
    documentNumberEncrypted: { type: String, required: true },
    documentNumberLast4: { type: String, required: true },
    documentNumberHash: { type: String }, // For duplicate checks
    frontFile: { type: String, required: true }, // Keep legacy path/url
    frontFileId: { type: String }, // Private storage key
    backFile: { type: String }, // Keep legacy path/url
    backFileId: { type: String }, // Private storage key
    fileMimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storageProvider: { type: String, default: 'LOCAL' },
    verificationStatus: {
        type: String,
        enum: [
            'NOT_UPLOADED',
            'UPLOADED',
            'PENDING_REVIEW',
            'APPROVED',
            'CHANGES_REQUIRED',
            'REJECTED',
            'EXPIRED',
            'BLOCKED'
        ],
        default: 'UPLOADED',
    },
    reviewReasonCode: { type: String },
    reviewComment: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    uploadedAt: { type: Date, default: Date.now },
    replacedDocumentId: { type: Schema.Types.ObjectId, ref: 'VerificationDocument' },
    version: { type: Number, default: 1, min: 1 },
    operationId: { type: String, trim: true },
    operationHash: { type: String },
    isCurrent: { type: Boolean, default: true },
    scanStatus: { type: String, enum: ['SCANNER_NOT_CONFIGURED', 'CLEAN', 'INFECTED'], default: 'SCANNER_NOT_CONFIGURED' },
    metadata: { type: Schema.Types.Mixed },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    issuingAuthority: { type: String }
}, {
    timestamps: true,
});
// Indexes
verificationDocumentSchema.index({ workerId: 1 });
verificationDocumentSchema.index({ verificationStatus: 1 });
verificationDocumentSchema.index(
    { workerId: 1, documentType: 1 },
    { unique: true, partialFilterExpression: { isCurrent: true }, name: 'unique_current_worker_document' }
);
verificationDocumentSchema.index(
    { workerId: 1, operationId: 1 },
    { unique: true, partialFilterExpression: { operationId: { $type: 'string' } }, name: 'unique_worker_document_operation' }
);

export const VerificationDocument = model('VerificationDocument', verificationDocumentSchema);
export default VerificationDocument;
