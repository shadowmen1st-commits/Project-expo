import { Schema, model } from 'mongoose';

const verificationSubmissionSchema = new Schema({
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionNumber: { type: Number, required: true },
    version: { type: Number, required: true, default: 1 },
    profileSnapshot: { type: Schema.Types.Mixed, required: true },
    serviceSnapshot: { type: Schema.Types.Mixed, required: true },
    documentIds: [{ type: Schema.Types.ObjectId, ref: 'VerificationDocument' }],
    declarationAccepted: { type: Boolean, required: true },
    consentAccepted: { type: Boolean, required: true },
    status: {
        type: String,
        enum: [
            'INCOMPLETE_PROFILE',
            'DRAFT',
            'PENDING_APPROVAL',
            'CHANGES_REQUIRED',
            'APPROVED',
            'REJECTED',
            'SUSPENDED'
        ],
        default: 'PENDING_APPROVAL'
    },
    submittedAt: { type: Date, default: Date.now },
    reviewStartedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    finalDecisionAt: { type: Date },
    finalReasonCode: { type: String },
    finalComment: { type: String },
    previousSubmissionId: { type: Schema.Types.ObjectId, ref: 'VerificationSubmission' }
}, {
    timestamps: true
});

verificationSubmissionSchema.index({ workerId: 1 });
verificationSubmissionSchema.index({ status: 1 });
verificationSubmissionSchema.index({ workerId: 1, version: 1 }, { unique: true });

export const VerificationSubmission = model('VerificationSubmission', verificationSubmissionSchema);
export default VerificationSubmission;
