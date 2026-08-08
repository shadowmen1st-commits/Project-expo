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
        verificationStatus: {
            type: String,
            enum: ['PENDING', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
            default: 'PENDING'
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
