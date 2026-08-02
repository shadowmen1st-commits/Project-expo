/**
 * WebhookEvent — Durable record of every webhook delivery.
 *
 * Security notes:
 * - payloadHash = SHA-256(rawBody) — proves what was received without storing full payload
 * - signatureHash = SHA-256(rawSignature header) — proves what was verified
 * - Raw signature NEVER stored in plaintext
 * - normalizedPayload contains only safe, non-sensitive event fields
 * - provider + providerEventId unique constraint prevents duplicate processing
 * - If Razorpay does not supply an event ID, a deterministic deduplication key is derived
 */
import { Schema, model } from 'mongoose';

const PROCESSING_STATUSES = [
    'RECEIVED',
    'VERIFIED',
    'PROCESSING',
    'PROCESSED',
    'IGNORED',
    'FAILED',
    'DEAD_LETTER',
];

const webhookEventSchema = new Schema(
    {
        // Provider identification
        provider: {
            type: String,
            required: true,
            enum: ['razorpay'],
        },

        // Razorpay-supplied event ID (or deterministic deduplication key if missing).
        // provider + providerEventId UNIQUE — core idempotency guarantee.
        providerEventId: {
            type: String,
            required: true,
        },

        eventType: {
            type: String,
            required: true,
        },

        // Integrity proofs — SHA-256 hashes, not raw values
        payloadHash: {
            type: String,   // SHA-256(rawBodyBuffer)
            required: true,
        },
        signatureHash: {
            type: String,   // SHA-256(x-razorpay-signature header value)
        },
        signatureVerified: {
            type: Boolean,
            default: false,
        },

        // Processing lifecycle
        processingStatus: {
            type: String,
            required: true,
            enum: PROCESSING_STATUSES,
            default: 'RECEIVED',
        },
        processingAttempts: {
            type: Number,
            default: 0,
        },

        // Timestamps
        receivedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        processedAt: { type: Date },
        failedAt: { type: Date },
        nextRetryAt: { type: Date },

        // Linked records (set after processing)
        relatedBookingId: {
            type: Schema.Types.ObjectId,
            ref: 'Booking',
        },
        relatedPaymentOrderId: {
            type: Schema.Types.ObjectId,
            ref: 'PaymentOrder',
        },
        relatedPaymentTransactionId: {
            type: Schema.Types.ObjectId,
            ref: 'PaymentTransaction',
        },

        // Error info (safe — no stack traces or secrets)
        errorCode: { type: String },
        errorMessageSafe: { type: String },

        // Safe normalized event fields for reconciliation/audit.
        // Contains only non-sensitive data: event type, amounts, IDs.
        // NEVER contains signatures, secrets, or raw card/bank details.
        normalizedPayload: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Core uniqueness — prevents duplicate processing of same delivery
webhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });

// Query indexes
webhookEventSchema.index({ processingStatus: 1, receivedAt: -1 });
webhookEventSchema.index({ eventType: 1 });
webhookEventSchema.index({ relatedBookingId: 1 });
webhookEventSchema.index({ relatedPaymentOrderId: 1 });
webhookEventSchema.index({ nextRetryAt: 1 });

export const WebhookEvent = model('WebhookEvent', webhookEventSchema);
export default WebhookEvent;
