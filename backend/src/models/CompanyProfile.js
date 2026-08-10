import { Schema, model } from 'mongoose';

const companyProfileSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        companyName: { type: String, required: true, trim: true },
        logo: { type: String },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        pincode: { type: String, required: true, trim: true },
        businessType: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        gstNumber: { type: String, trim: true },
        website: { type: String, trim: true },
        authorizedPersonName: { type: String, required: true, trim: true },
        authorizedPersonPhone: { type: String, required: true, trim: true },
        panNumber: { type: String, trim: true },
        legalCompanyName: { type: String, trim: true },
        tradeName: { type: String, trim: true },
        companyType: { type: String, trim: true },
        registrationNumber: { type: String, trim: true },
        dateOfIncorporation: { type: Date },
        numberOfEmployees: { type: String, trim: true },
        industry: { type: String, trim: true },
        registeredAddress: { type: String, trim: true },
        operationalAddress: { type: String, trim: true },
        country: { type: String, trim: true, default: 'India' },
        completedSteps: [{ type: String }],
        lastStep: { type: Number, default: 1 },
        submittedAt: { type: Date },
        submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reviewHistory: [
            {
                action: { type: String },
                reason: { type: String },
                actor: { type: Schema.Types.ObjectId, ref: 'User' },
                timestamp: { type: Date, default: Date.now }
            }
        ],
        verificationStatus: {
            type: String,
            enum: ['DRAFT', 'PENDING', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'RESUBMISSION_REQUIRED', 'APPROVED', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
            default: 'DRAFT'
        },
        rejectionReason: { type: String },
        needsInfoReason: { type: String },
        suspensionReason: { type: String }
    },
    {
        timestamps: true
    }
);

export const CompanyProfile = model('CompanyProfile', companyProfileSchema);
export default CompanyProfile;
