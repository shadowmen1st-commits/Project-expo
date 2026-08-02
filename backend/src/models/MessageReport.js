import { Schema, model } from 'mongoose';

const messageReportSchema = new Schema(
    {
        messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
        conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reasonCode: {
            type: String,
            enum: [
                'ABUSE',
                'HARASSMENT',
                'THREAT',
                'SPAM',
                'FRAUD_ATTEMPT',
                'PERSONAL_INFORMATION',
                'OFF_PLATFORM_PAYMENT',
                'INAPPROPRIATE_CONTENT',
                'OTHER'
            ],
            required: true
        },
        descriptionSafe: { type: String, maxlength: 1000 },
        status: {
            type: String,
            enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'DUPLICATE'],
            default: 'OPEN'
        },
        assignedModeratorId: { type: Schema.Types.ObjectId, ref: 'User' },
        resolutionCode: { type: String },
        resolvedAt: { type: Date }
    },
    { timestamps: true }
);

messageReportSchema.index({ status: 1 });
messageReportSchema.index({ reporterId: 1, messageId: 1 }, { unique: true });
messageReportSchema.index({ reportedUserId: 1 });

export const MessageReport = model('MessageReport', messageReportSchema);
export default MessageReport;
