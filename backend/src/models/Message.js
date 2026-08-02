import { Schema, model } from 'mongoose';

const messageSchema = new Schema(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        senderId: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional for SYSTEM messages
        senderRole: { type: String, enum: ['CUSTOMER', 'WORKER', 'SYSTEM', 'ADMIN'] },
        messageType: { type: String, enum: ['TEXT', 'ATTACHMENT', 'SYSTEM'], default: 'TEXT' },
        bodySafe: { type: String },
        attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'ChatAttachment' }],
        replyToMessageId: { type: Schema.Types.ObjectId, ref: 'Message' },
        clientMessageId: { type: String }, // For idempotency from client
        idempotencyKey: { type: String }, // Durable backend idempotency
        requestFingerprint: { type: String },
        sequenceNumber: { type: Number, required: true },
        moderationStatus: {
            type: String,
            enum: ['CLEAR', 'FLAGGED', 'HELD', 'HIDDEN', 'REMOVED'],
            default: 'CLEAR'
        },
        deliveryStatus: {
            type: String,
            enum: ['ACCEPTED', 'DELIVERED', 'READ'],
            default: 'ACCEPTED'
        },
        sentAt: { type: Date, default: Date.now },
        deliveredAt: { type: Date },
        editedAt: { type: Date },
        editCount: { type: Number, default: 0 },
        deletedAt: { type: Date },
        deletionType: { type: String, enum: ['SOFT', 'HARD'] },
        deletionReasonCode: { type: String },
        systemEventType: { type: String },
        metadataSafe: { type: Schema.Types.Mixed }
    },
    { timestamps: true }
);

// Idempotency indices
messageSchema.index({ conversationId: 1, senderId: 1, clientMessageId: 1 }, { unique: true, sparse: true });
messageSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// Sequence index per conversation (must be monotonic)
messageSchema.index({ conversationId: 1, sequenceNumber: 1 }, { unique: true });
messageSchema.index({ bookingId: 1 });
messageSchema.index({ sentAt: 1 });

export const Message = model('Message', messageSchema);
export default Message;
