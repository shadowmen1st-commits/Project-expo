import { Schema, model } from 'mongoose';

const notificationOutboxSchema = new Schema(
    {
        eventType: { type: String, required: true },
        eventVersion: { type: String, default: '1.0' },
        aggregateType: { type: String, required: true },
        aggregateId: { type: Schema.Types.ObjectId, required: true },
        recipientIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
        payloadSafe: { type: Schema.Types.Mixed, required: true },
        dedupeKey: { type: String, required: true },
        status: {
            type: String,
            enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'RETRY', 'DEAD_LETTER'],
            default: 'PENDING'
        },
        attempts: { type: Number, default: 0 },
        nextAttemptAt: { type: Date, default: Date.now },
        lockedAt: { type: Date },
        lockedBy: { type: String }, // Used by background dispatcher
        processedAt: { type: Date },
        lastErrorSafe: { type: String }
    },
    { timestamps: true }
);

notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
notificationOutboxSchema.index({ dedupeKey: 1 }, { unique: true });

export const NotificationOutbox = model('NotificationOutbox', notificationOutboxSchema);
export default NotificationOutbox;
