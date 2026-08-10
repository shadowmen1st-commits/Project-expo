import { Schema, model } from 'mongoose';

const companyVerificationDocumentSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        documentType: {
            type: String,
            enum: [
                'BUSINESS_REGISTRATION',
                'ADDRESS_PROOF',
                'GST_CERTIFICATE',
                'AUTHORIZED_PERSON_ID',
                'COMPANY_PAN',
                'OTHER_SUPPORTING_DOCUMENT'
            ],
            required: true
        },
        documentUrl: { type: String, required: true },
        storageKey: { type: String }, // For private storage
        fileName: { type: String },
        fileSize: { type: Number },
        mimeType: { type: String },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING'
        },
        rejectionReason: { type: String },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: { type: Date }
    },
    {
        timestamps: true
    }
);

companyVerificationDocumentSchema.index({ companyId: 1 });
companyVerificationDocumentSchema.index({ companyId: 1, documentType: 1 }, { unique: true });

export const CompanyVerificationDocument = model('CompanyVerificationDocument', companyVerificationDocumentSchema);
export default CompanyVerificationDocument;
