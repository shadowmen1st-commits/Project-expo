import { Schema, model } from 'mongoose';

const conversationSchema = new Schema(
    {
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        customerId: { type: Schema.Types.ObjectId, ref: 'User' },
        workerId: { type: Schema.Types.ObjectId, ref: 'User' },
        participantIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
        conversationType: { type: String, enum: ['BOOKING', 'SUPPORT_LINKED'], default: 'BOOKING' },
        status: {
            type: String,
            enum: ['ACTIVE', 'READ_ONLY', 'RESTRICTED', 'CLOSED', 'ARCHIVED'],
            default: 'ACTIVE'
        },
        policySnapshot: { type: Schema.Types.Mixed }, // Copy of active CommunicationPolicy at creation
        lastMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
        lastMessageAt: { type: Date },
        lastMessagePreviewSafe: { type: String },
        messageCount: { type: Number, default: 0 },
        openedAt: { type: Date, default: Date.now },
        readOnlyAt: { type: Date },
        closedAt: { type: Date },
        closedReasonCode: { type: String },
        retentionExpiresAt: { type: Date },
        metadataSafe: { type: Schema.Types.Mixed }
    },
    { timestamps: true }
);

conversationSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { conversationType: 'BOOKING' } });
conversationSchema.index({ participantIds: 1 });
conversationSchema.index({ status: 1 });

export const Conversation = model('Conversation', conversationSchema);
export default Conversation;
