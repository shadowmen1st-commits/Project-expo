import { Schema, model } from 'mongoose';

const communicationPolicySchema = new Schema(
    {
        chatEnabled: { type: Boolean, default: true },
        allowedBookingStatuses: {
            type: [String],
            default: [
                'ACCEPTED',
                'CONFIRMED',
                'WORKER_EN_ROUTE',
                'STARTED',
                'COMPLETION_REQUESTED',
                'COMPLETED',
                'DISPUTED'
            ]
        },
        chatStartRule: { type: String, enum: ['IMMEDIATE', 'AFTER_ACCEPTED', 'AFTER_CONFIRMED'], default: 'AFTER_ACCEPTED' },
        postCompletionChatWindowHours: { type: Number, default: 48 }, // REQUIRES_BUSINESS_APPROVAL
        maximumMessageLength: { type: Number, default: 2000 },
        maximumMessagesPerMinute: { type: Number, default: 30 },
        maximumAttachmentsPerMessage: { type: Number, default: 3 },
        maximumAttachmentSizeBytes: { type: Number, default: 5 * 1024 * 1024 }, // 5 MB
        allowedAttachmentMimeTypes: {
            type: [String],
            default: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        },
        messageEditWindowMinutes: { type: Number, default: 15 },
        messageDeleteWindowMinutes: { type: Number, default: 60 },
        typingEventLimitPerMinute: { type: Number, default: 10 },
        contactInformationSharingPolicy: { type: String, enum: ['ALLOWED', 'WARNING', 'BLOCKED'], default: 'WARNING' },
        externalLinkPolicy: { type: String, enum: ['ALLOWED', 'WARNING', 'BLOCKED'], default: 'WARNING' },
        retentionDays: { type: Number, default: 365 * 3 }, // 3 years
        supportRetentionDays: { type: Number, default: 365 * 7 }, // 7 years
        policyVersion: { type: Number, default: 1, required: true },
        requiresBusinessApproval: { type: Boolean, default: true },
        isActive: { type: Boolean, default: false },
        effectiveFrom: { type: Date, required: true },
        effectiveUntil: { type: Date },
        createdBy: { type: Schema.Types.Mixed, required: true },
        updatedBy: { type: Schema.Types.Mixed, required: true }
    },
    { timestamps: true }
);

communicationPolicySchema.index({ isActive: 1, effectiveFrom: -1 });

export const CommunicationPolicy = model('CommunicationPolicy', communicationPolicySchema);
export default CommunicationPolicy;
