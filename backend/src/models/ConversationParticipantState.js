import { Schema, model } from 'mongoose';

const conversationParticipantStateSchema = new Schema(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['CUSTOMER', 'WORKER', 'ADMIN'] },
        lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
        lastReadSequenceNumber: { type: Number, default: 0 },
        unreadCount: { type: Number, default: 0 },
        mutedUntil: { type: Date },
        notificationLevel: { type: String, enum: ['ALL', 'MENTIONS_ONLY', 'MUTED'], default: 'ALL' },
        restrictedAt: { type: Date },
        lastSeenAt: { type: Date }
    },
    { timestamps: true }
);

conversationParticipantStateSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationParticipantStateSchema.index({ userId: 1, unreadCount: 1 });

export const ConversationParticipantState = model('ConversationParticipantState', conversationParticipantStateSchema);
export default ConversationParticipantState;
