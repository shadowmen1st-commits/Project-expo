/**
 * PaymentOrder — Represents one payment attempt for a booking.
 *
 * Lifecycle: CREATED → PROVIDER_ORDER_CREATED → ATTEMPTED → PAID | FAILED | EXPIRED | CANCELLED
 *
 * Security notes:
 * - Amount MUST equal the booking's immutable pricingSnapshot.totalAmount
 * - Status transitions are controlled exclusively by VerifiedPaymentService / PaymentFailureService
 * - Client-supplied amounts are NEVER trusted
 * - idempotencyKey guarantees exactly-once order creation
 */
import { Schema, model } from 'mongoose';
import crypto from 'crypto';

const PAYMENT_ORDER_STATUSES = [
    'CREATED',
    'PROVIDER_ORDER_CREATED',
    'ATTEMPTED',
    'PAID',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
];

const paymentOrderSchema = new Schema(
    {
        // Internal order number (human-readable reference)
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            default: () => `PO-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        },

        // References
        bookingId: {
            type: Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Provider details
        provider: {
            type: String,
            required: true,
            enum: ['razorpay'],
            default: 'razorpay',
        },
        providerOrderId: {
            // Razorpay order_xxx — set after provider creates it
            type: String,
            sparse: true,   // unique when present, null allowed
        },
        providerReceipt: {
            // Safe receipt string sent to Razorpay (based on orderNumber, not sensitive data)
            type: String,
        },

        // Financial fields — ALL stored as integer paise
        amountPaise: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: 'amountPaise must be an integer (paise)',
            },
        },
        currency: {
            type: String,
            required: true,
            default: 'INR',
            maxlength: 3,
        },

        // Status
        status: {
            type: String,
            required: true,
            enum: PAYMENT_ORDER_STATUSES,
            default: 'CREATED',
        },

        // Immutable snapshot of the booking's financial details at time of order creation
        bookingAmountSnapshot: {
            type: Schema.Types.Mixed,
            required: true,
        },

        // Reference to the PriceQuote used (if applicable)
        quoteId: {
            type: Schema.Types.ObjectId,
            ref: 'PriceQuote',
        },

        // Idempotency — prevents duplicate order creation for same request
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
        },

        // Retry tracking
        attemptNumber: {
            type: Number,
            default: 1,
            min: 1,
        },

        // Expiry — provider order expires after PAYMENT_ORDER_EXPIRY_MINUTES
        expiresAt: {
            type: Date,
            required: true,
        },

        // Timestamps for terminal states
        paidAt: { type: Date },
        failedAt: { type: Date },
        cancelledAt: { type: Date },

        // Last known provider-side status (for reconciliation)
        lastProviderStatus: { type: String },

        // Safe metadata — do NOT store signatures or secrets here
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Indexes — unique field indexes are automatically registered by mongoose from schema properties
paymentOrderSchema.index({ bookingId: 1, status: 1 });
paymentOrderSchema.index({ customerId: 1, createdAt: -1 });
paymentOrderSchema.index({ expiresAt: 1 });
paymentOrderSchema.index({ status: 1, createdAt: -1 });

export const PaymentOrder = model('PaymentOrder', paymentOrderSchema);
export default PaymentOrder;
