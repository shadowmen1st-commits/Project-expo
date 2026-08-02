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
    documentNumberMasked: { type: String, required: true },
    frontFile: { type: String, required: true },
    backFile: { type: String },
    fileMimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storageProvider: { type: String, default: 'LOCAL' },
    verificationStatus: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
        default: 'PENDING',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
    expiryDate: { type: Date },
}, {
    timestamps: true,
});
// Indexes
verificationDocumentSchema.index({ workerId: 1 });
verificationDocumentSchema.index({ verificationStatus: 1 });
verificationDocumentSchema.index({ workerId: 1, documentType: 1 }, { unique: true });
export const VerificationDocument = model('VerificationDocument', verificationDocumentSchema);
export default VerificationDocument;
