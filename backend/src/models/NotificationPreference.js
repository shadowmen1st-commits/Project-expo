import { Schema, model } from 'mongoose';

const notificationPreferenceSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        categoryPreferences: {
            BOOKING: { type: Boolean, default: true },
            PAYMENT: { type: Boolean, default: true },
            REFUND: { type: Boolean, default: true },
            DISPUTE: { type: Boolean, default: true },
            PAYOUT: { type: Boolean, default: true },
            REVIEW: { type: Boolean, default: true },
            CHAT: { type: Boolean, default: true },
            SUPPORT: { type: Boolean, default: true },
            ACCOUNT: { type: Boolean, default: true },
            SECURITY: { type: Boolean, default: true }, // System overrides this to always true for critical events
            SYSTEM: { type: Boolean, default: true }
        },
        channelPreferences: {
            IN_APP: { type: Boolean, default: true },
            EMAIL: { type: Boolean, default: true },
            PUSH: { type: Boolean, default: false }
        },
        quietHours: {
            enabled: { type: Boolean, default: false },
            startHour: { type: Number, min: 0, max: 23, default: 22 },
            endHour: { type: Number, min: 0, max: 23, default: 8 },
            timezone: { type: String, default: 'UTC' }
        },
        language: { type: String, default: 'en' },
        marketingOptIn: { type: Boolean, default: false },
        serviceUpdatesEnabled: { type: Boolean, default: true },
        securityNotificationsRequired: { type: Boolean, default: true } // Read-only policy
    },
    { timestamps: true }
);

export const NotificationPreference = model('NotificationPreference', notificationPreferenceSchema);
export default NotificationPreference;
