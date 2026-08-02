import { Schema, model } from 'mongoose';

const chatAttachmentSchema = new Schema(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
        messageId: { type: Schema.Types.ObjectId, ref: 'Message' }, // Assigned when message is successfully saved
        uploaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        storageProvider: { type: String, enum: ['S3', 'CLOUDINARY', 'LOCAL_MOCK'], default: 'LOCAL_MOCK' },
        storageKey: { type: String, required: true },
        originalFileNameSafe: { type: String, required: true },
        mimeType: { type: String, required: true },
        extension: { type: String },
        sizeBytes: { type: Number, required: true },
        checksum: { type: String },
        contentBase64: { type: String, select: false },
        scanStatus: {
            type: String,
            enum: ['PENDING', 'CLEAN', 'REJECTED', 'FAILED', 'SCANNER_NOT_CONFIGURED'],
            default: 'SCANNER_NOT_CONFIGURED'
        },
        moderationStatus: {
            type: String,
            enum: ['CLEAR', 'FLAGGED', 'BLOCKED'],
            default: 'CLEAR'
        },
        status: {
            type: String,
            enum: ['PENDING', 'AVAILABLE', 'BLOCKED', 'DELETED', 'EXPIRED'],
            default: 'PENDING'
        },
        uploadedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
        deletedAt: { type: Date }
    },
    { timestamps: true }
);

chatAttachmentSchema.index({ conversationId: 1, status: 1 });
chatAttachmentSchema.index({ messageId: 1 });
chatAttachmentSchema.index({ storageKey: 1 }, { unique: true });

export const ChatAttachment = model('ChatAttachment', chatAttachmentSchema);
export default ChatAttachment;
