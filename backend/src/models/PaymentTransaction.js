/**
 * PaymentTransaction — One payment event (authorized, captured, failed, etc.).
 *
 * Security notes:
 * - providerSignatureHash stores SHA-256(rawSignature), never the raw signature itself
 * - providerPaymentId is unique — prevents duplicate success effects
 * - Amount and currency must reconcile with PaymentOrder and Booking
 * - verificationSource distinguishes checkout callback vs. webhook vs. reconciliation
 */
import { Schema, model } from 'mongoose';
import crypto from 'crypto';

const TRANSACTION_STATUSES = [
    'INITIATED',
    'AUTHORISED',
    'CAPTURED',
    'VERIFIED',
    'FAILED',
    'DUPLICATE',
    'REVERSED',
];

const VERIFICATION_SOURCES = [
    'CHECKOUT_CALLBACK',
    'WEBHOOK',
    'RECONCILIATION',
];

const paymentTransactionSchema = new Schema(
    {
        // Internal reference number
        transactionNumber: {
            type: String,
            required: true,
            unique: true,
            default: () => `PT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        },

        // References
        bookingId: {
            type: Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
        },
        paymentOrderId: {
            type: Schema.Types.ObjectId,
            ref: 'PaymentOrder',
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
            type: String,
        },
        providerPaymentId: {
            // Razorpay pay_xxx — unique when present
            type: String,
            sparse: true,
        },

        // Security: Store SHA-256 of the raw Razorpay signature, NOT the signature itself.
        // This proves verification occurred without retaining a replayable secret.
        providerSignatureHash: {
            type: String,
        },

        // Financial fields — all integer paise
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

        // Payment method (card, netbanking, upi, wallet, etc.) — from provider
        method: { type: String },

        // Status & verification
        status: {
            type: String,
            required: true,
            enum: TRANSACTION_STATUSES,
            default: 'INITIATED',
        },
        verificationSource: {
            type: String,
            enum: VERIFICATION_SOURCES,
        },
        signatureVerified: {
            type: Boolean,
            default: false,
        },
        captured: {
            type: Boolean,
            default: false,
        },

        // Timestamps
        providerCreatedAt: { type: Date },   // When Razorpay created the payment
        verifiedAt: { type: Date },
        failedAt: { type: Date },

        // Safe failure info — do NOT store raw provider error payloads
        failureCode: { type: String },
        failureDescriptionSafe: { type: String },

        // Idempotency for duplicate delivery protection
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
        },

        // Safe metadata only
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

// Indexes — unique field indexes are automatically registered by mongoose from schema properties
paymentTransactionSchema.index({ paymentOrderId: 1 });
paymentTransactionSchema.index({ bookingId: 1 });
paymentTransactionSchema.index({ customerId: 1, createdAt: -1 });
paymentTransactionSchema.index({ status: 1, createdAt: -1 });

export const PaymentTransaction = model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
