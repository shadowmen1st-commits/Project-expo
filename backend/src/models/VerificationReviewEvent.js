import { Schema, model } from 'mongoose';

const verificationReviewEventSchema = new Schema({
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'VerificationSubmission', required: true },
    documentId: { type: Schema.Types.ObjectId, ref: 'VerificationDocument' },
    action: { type: String, required: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    reasonCode: { type: String },
    safeComment: { type: String },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    requestId: { type: String }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

verificationReviewEventSchema.index({ workerId: 1 });
verificationReviewEventSchema.index({ submissionId: 1 });
verificationReviewEventSchema.index({ createdAt: -1 });

export const VerificationReviewEvent = model('VerificationReviewEvent', verificationReviewEventSchema);
export default VerificationReviewEvent;
