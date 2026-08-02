import { Schema, model } from 'mongoose';

const supportTicketMessageSchema = new Schema(
    {
        ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
        senderId: { type: Schema.Types.ObjectId, ref: 'User' }, // Optional for system messages
        senderType: { type: String, enum: ['CUSTOMER', 'WORKER', 'SUPPORT_AGENT', 'SYSTEM'], required: true },
        bodySafe: { type: String, required: true },
        attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'ChatAttachment' }],
        visibility: { type: String, enum: ['REQUESTER_VISIBLE', 'INTERNAL_ONLY'], default: 'REQUESTER_VISIBLE' },
        clientMessageId: { type: String }, // For idempotency
        idempotencyKey: { type: String }, // For backend durable idempotency
        editedAt: { type: Date },
        deletedAt: { type: Date }
    },
    { timestamps: true }
);

supportTicketMessageSchema.index({ ticketId: 1, createdAt: 1 });
supportTicketMessageSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
supportTicketMessageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true, sparse: true });

export const SupportTicketMessage = model('SupportTicketMessage', supportTicketMessageSchema);
export default SupportTicketMessage;
