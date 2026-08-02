import { Schema, model } from 'mongoose';

const notificationSchema = new Schema(
    {
        recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: { type: String, required: true }, // E.g., 'MESSAGE_RECEIVED', 'PAYMENT_VERIFIED'
        category: {
            type: String,
            enum: [
                'BOOKING',
                'PAYMENT',
                'REFUND',
                'DISPUTE',
                'PAYOUT',
                'REVIEW',
                'CHAT',
                'SUPPORT',
                'ACCOUNT',
                'SECURITY',
                'SYSTEM'
            ],
            required: true
        },
        title: { type: String, required: true },
        messageSafe: { type: String, required: true },
        message: { type: String }, // For backwards compatibility
        actionUrlSafe: { type: String }, // Pre-validated relative URL
        entityType: { type: String },
        entityId: { type: Schema.Types.ObjectId },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        channelStates: {
            inApp: { type: String, enum: ['PENDING', 'DELIVERED', 'READ', 'FAILED', 'NOT_APPLICABLE'], default: 'DELIVERED' },
            email: { type: String, enum: ['PENDING', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE'], default: 'NOT_APPLICABLE' },
            push: { type: String, enum: ['PENDING', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE'], default: 'NOT_APPLICABLE' }
        },
        priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'], default: 'NORMAL' },
        dedupeKey: { type: String, required: true },
        idempotencyKey: { type: String }, // For backwards compatibility
        status: { type: String, enum: ['UNREAD', 'READ', 'ARCHIVED'], default: 'UNREAD' },
        readAt: { type: Date },
        archivedAt: { type: Date },
        expiresAt: { type: Date }
    },
    { timestamps: true }
);

notificationSchema.index({ recipientId: 1, status: 1 });
notificationSchema.index({ recipientId: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ idempotencyKey: 1 }, { sparse: true });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.pre('validate', function(next) {
    if (this.message && !this.messageSafe) {
        this.messageSafe = this.message;
    }
    if (this.idempotencyKey && !this.dedupeKey) {
        this.dedupeKey = this.idempotencyKey;
    }
    if (!this.dedupeKey) {
        this.dedupeKey = `legacy-${this._id.toString()}`;
    }
    if (!this.category) {
        const t = (this.title || '').toLowerCase();
        if (t.includes('payout') || t.includes('withdrawal')) this.category = 'PAYOUT';
        else if (t.includes('review')) this.category = 'REVIEW';
        else if (t.includes('dispute')) this.category = 'DISPUTE';
        else if (t.includes('payment')) this.category = 'PAYMENT';
        else if (t.includes('booking')) this.category = 'BOOKING';
        else this.category = 'SYSTEM';
    }
    next();
});

export const Notification = model('Notification', notificationSchema);
export default Notification;
