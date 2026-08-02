/**
 * PaymentFailureService — Handles verified payment failures safely.
 *
 * Records failure state without:
 * - Cancelling the booking automatically
 * - Crediting wallets
 * - Exposing sensitive provider internals
 *
 * Allows controlled retry by keeping booking in PAYMENT_PENDING.
 */
import PaymentOrder from '../../models/PaymentOrder.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';

class PaymentFailureServiceClass {
    /**
     * Record a verified payment failure.
     *
     * @param {object} params
     * @param {object} params.paymentOrder    Mongoose PaymentOrder document
     * @param {object} params.failureFacts    Provider-verified failure details
     * @param {object} params.requestMeta     { requestId, ipAddress, userAgent }
     */
    async applyPaymentFailure({ paymentOrder, failureFacts, requestMeta = {} }) {
        const {
            providerPaymentId,
            providerOrderId,
            failureCode,
            failureDescriptionSafe,
            verificationSource,
            method,
        } = failureFacts;

        // ── 1. Idempotency — if already failed with this payment ID, skip ─────────
        if (providerPaymentId) {
            const existing = await PaymentTransaction.findOne({ providerPaymentId, status: 'FAILED' });
            if (existing) {
                return { transactionNumber: existing.transactionNumber, alreadyProcessed: true };
            }
        }

        const now = new Date();

        // ── 2. Create FAILED PaymentTransaction ───────────────────────────────────
        const idempotencyKey = `payment-failure::${paymentOrder._id}::${providerPaymentId || Date.now()}`;
        let transaction;
        try {
            transaction = await PaymentTransaction.create({
                bookingId: paymentOrder.bookingId,
                paymentOrderId: paymentOrder._id,
                customerId: paymentOrder.customerId,
                provider: 'razorpay',
                providerOrderId: providerOrderId || paymentOrder.providerOrderId,
                providerPaymentId: providerPaymentId || null,
                amountPaise: paymentOrder.amountPaise,
                currency: paymentOrder.currency,
                method: method || null,
                status: 'FAILED',
                verificationSource,
                signatureVerified: false,
                failedAt: now,
                // Store only safe, sanitized failure descriptions — no PII, no bank details
                failureCode: failureCode ? String(failureCode).substring(0, 50) : 'PAYMENT_FAILED',
                failureDescriptionSafe: failureDescriptionSafe
                    ? String(failureDescriptionSafe).substring(0, 100)
                    : 'Payment could not be completed.',
                idempotencyKey,
            });
        } catch (e) {
            if (e.code === 11000) {
                transaction = await PaymentTransaction.findOne({ idempotencyKey });
                return { transactionNumber: transaction?.transactionNumber || 'DUPLICATE', alreadyProcessed: true };
            }
            throw e;
        }

        // ── 3. Update PaymentOrder → FAILED ──────────────────────────────────────
        // Keep booking in PAYMENT_PENDING to allow retry
        await PaymentOrder.findByIdAndUpdate(paymentOrder._id, {
            status: 'FAILED',
            failedAt: now,
            lastProviderStatus: 'failed',
        });

        // ── 4. Booking paymentStatus → FAILED (but bookingStatus stays PAYMENT_PENDING) ─
        // We do NOT cancel the booking — the customer may retry payment
        // The booking escrowStatus remains NOT_FUNDED

        // ── 5. Create immutable audit log ─────────────────────────────────────────
        await AuditLog.create({
            actor: paymentOrder.customerId,
            action: 'PAYMENT_FAILED',
            resourceType: 'Booking',
            resourceId: paymentOrder.bookingId.toString(),
            beforeSnapshot: { paymentOrderStatus: paymentOrder.status },
            afterSnapshot: {
                paymentOrderStatus: 'FAILED',
                failureCode: transaction.failureCode,
                verificationSource,
            },
            ipAddress: requestMeta.ipAddress || '',
            userAgent: requestMeta.userAgent || '',
            requestId: requestMeta.requestId || '',
        });

        // ── 6. Notify customer (safe message — no bank details, no card info) ─────
        const notifyKey = `payment-failed-customer::${paymentOrder._id}::${providerPaymentId || 'unknown'}`;
        try {
            await Notification.create({
                recipientId: paymentOrder.customerId,
                title: 'Payment Failed',
                message: `Your payment for booking could not be completed. You may retry payment. If the issue persists, contact support.`,
                type: 'WARNING',
                bookingId: paymentOrder.bookingId,
                idempotencyKey: notifyKey,
            });
        } catch (e) {
            if (e.code !== 11000) throw e; // Ignore duplicate notification
        }

        return {
            transactionNumber: transaction.transactionNumber,
            alreadyProcessed: false,
        };
    }
}

export const PaymentFailureService = new PaymentFailureServiceClass();
export default PaymentFailureService;
