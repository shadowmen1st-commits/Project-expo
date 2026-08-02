/**
 * WebhookProcessorService — Processes verified Razorpay webhook events.
 *
 * This service is called AFTER signature verification has succeeded.
 * It handles the following Razorpay events:
 *  - payment.authorized  → record AUTHORISED state (not final success)
 *  - payment.captured    → apply verified payment via VerifiedPaymentService
 *  - order.paid          → apply verified payment via VerifiedPaymentService (idempotent)
 *  - payment.failed      → record failure via PaymentFailureService
 *  - (others)            → record as IGNORED in WebhookEvent
 *
 * Idempotency:
 *  - WebhookEvent unique constraint (provider + providerEventId) prevents double processing
 *  - VerifiedPaymentService and PaymentFailureService are themselves idempotent
 */
import crypto from 'crypto';
import WebhookEvent from '../../models/WebhookEvent.js';
import PaymentOrder from '../../models/PaymentOrder.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import VerifiedPaymentService from '../payments/VerifiedPaymentService.js';
import PaymentFailureService from '../payments/PaymentFailureService.js';
import { razorpayProvider } from '../payments/RazorpayProvider.js';
import Refund from '../../models/Refund.js';
import DisputeCase from '../../models/DisputeCase.js';
import Booking from '../../models/Booking.js';
import LedgerPostingService from '../payments/LedgerPostingService.js';
import RefundStateService from '../payments/RefundStateService.js';

class WebhookProcessorServiceClass {
    /**
     * Process a verified Razorpay webhook delivery.
     *
     * @param {object} params
     * @param {Buffer} params.rawBody        Exact bytes received from Razorpay
     * @param {string} params.signature      x-razorpay-signature header value
     * @param {boolean} params.sigVerified   Result of signature check
     * @param {string} params.requestId
     * @param {string} params.ipAddress
     * @returns {object} Processing result
     */
    async process({ rawBody, signature, sigVerified, requestId, ipAddress }) {
        const receivedAt = new Date();

        // ── 1. Parse and normalize payload ────────────────────────────────────────
        let parsedPayload;
        try {
            parsedPayload = JSON.parse(rawBody.toString('utf8'));
        } catch {
            return { accepted: false, reason: 'PAYLOAD_PARSE_ERROR' };
        }

        const normalized = razorpayProvider.normalizeWebhookEvent(parsedPayload);
        const eventType = normalized.eventType || parsedPayload.event || 'unknown';

        // ── 2. Derive stable deduplication ID ────────────────────────────────────
        // Razorpay provides event.id — use it if present.
        // Otherwise derive deterministic key from stable event data.
        const providerEventId = parsedPayload.id ||
            this._deriveDeduplicationKey(parsedPayload);

        // ── 3. Compute integrity hashes (never store raw body or signature) ───────
        const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        const signatureHash = signature
            ? crypto.createHash('sha256').update(signature).digest('hex')
            : null;

        // ── 4. Create or detect duplicate WebhookEvent ────────────────────────────
        let webhookEvent;
        try {
            webhookEvent = await WebhookEvent.create({
                provider: 'razorpay',
                providerEventId,
                eventType,
                payloadHash,
                signatureHash,
                signatureVerified: sigVerified,
                processingStatus: sigVerified ? 'VERIFIED' : 'RECEIVED',
                processingAttempts: 1,
                receivedAt,
                normalizedPayload: normalized,
            });
        } catch (e) {
            if (e.code === 11000) {
                // Duplicate delivery — already processed
                const existing = await WebhookEvent.findOne({ provider: 'razorpay', providerEventId });
                if (existing?.processingStatus === 'PROCESSED') {
                    return { accepted: true, deduplicated: true, eventId: existing._id.toString() };
                }
                // Still processing or failed — return accepted so Razorpay doesn't keep retrying
                return { accepted: true, deduplicated: true, eventId: existing?._id.toString() };
            }
            throw e;
        }

        // ── 5. Reject unverified signatures ──────────────────────────────────────
        if (!sigVerified) {
            await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
                processingStatus: 'FAILED',
                failedAt: new Date(),
                errorCode: 'SIGNATURE_VERIFICATION_FAILED',
                errorMessageSafe: 'Webhook signature did not match.',
            });
            return { accepted: false, reason: 'SIGNATURE_VERIFICATION_FAILED' };
        }

        // ── 6. Route to event handler ─────────────────────────────────────────────
        await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
            processingStatus: 'PROCESSING',
            $inc: { processingAttempts: 0 },
        });

        try {
            let result;
            switch (eventType) {
                case 'payment.authorized':
                    result = await this._handlePaymentAuthorized(normalized, webhookEvent);
                    break;
                case 'payment.captured':
                    result = await this._handlePaymentCaptured(normalized, webhookEvent);
                    break;
                case 'order.paid':
                    result = await this._handleOrderPaid(normalized, webhookEvent);
                    break;
                case 'payment.failed':
                    result = await this._handlePaymentFailed(normalized, webhookEvent);
                    break;
                case 'refund.created':
                case 'refund.processed':
                    result = await this._handleRefundProcessed(parsedPayload, webhookEvent);
                    break;
                case 'refund.failed':
                    result = await this._handleRefundFailed(parsedPayload, webhookEvent);
                    break;
                default:
                    result = { ignored: true };
                    break;
            }

            await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
                processingStatus: result.ignored ? 'IGNORED' : 'PROCESSED',
                processedAt: new Date(),
                relatedBookingId: result.bookingId || undefined,
                relatedPaymentOrderId: result.paymentOrderId || undefined,
                relatedPaymentTransactionId: result.transactionId || undefined,
            });

            return { accepted: true, deduplicated: false, eventId: webhookEvent._id.toString() };

        } catch (processingErr) {
            await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
                processingStatus: 'FAILED',
                failedAt: new Date(),
                errorCode: 'PROCESSING_ERROR',
                errorMessageSafe: String(processingErr.message).substring(0, 200),
            });
            // Return accepted so Razorpay doesn't keep retrying on internal errors
            // The WebhookEvent record allows manual reconciliation
            return { accepted: true, processingFailed: true, eventId: webhookEvent._id.toString() };
        }
    }

    // ─── Event Handlers ───────────────────────────────────────────────────────

    /**
     * payment.authorized — Store AUTHORISED state.
     * Do NOT mark booking PAID yet — capture may not have occurred.
     */
    async _handlePaymentAuthorized(normalized, webhookEvent) {
        const { providerOrderId, providerPaymentId, amountPaise } = normalized;
        if (!providerOrderId) return { ignored: true };

        const paymentOrder = await PaymentOrder.findOne({ providerOrderId });
        if (!paymentOrder) return { ignored: true };

        const idempotencyKey = `authorized::${providerPaymentId}`;
        try {
            await PaymentTransaction.create({
                bookingId: paymentOrder.bookingId,
                paymentOrderId: paymentOrder._id,
                customerId: paymentOrder.customerId,
                provider: 'razorpay',
                providerOrderId,
                providerPaymentId,
                amountPaise: amountPaise || paymentOrder.amountPaise,
                currency: paymentOrder.currency,
                method: normalized.method,
                status: 'AUTHORISED',
                verificationSource: 'WEBHOOK',
                signatureVerified: true,
                idempotencyKey,
            });
        } catch (e) {
            if (e.code !== 11000) throw e;
        }

        await PaymentOrder.findByIdAndUpdate(paymentOrder._id, {
            status: 'ATTEMPTED',
            lastProviderStatus: 'authorized',
        });

        return {
            bookingId: paymentOrder.bookingId.toString(),
            paymentOrderId: paymentOrder._id.toString(),
        };
    }

    /**
     * payment.captured — Apply verified payment.
     */
    async _handlePaymentCaptured(normalized, webhookEvent) {
        const { providerOrderId, providerPaymentId, amountPaise, currency } = normalized;
        if (!providerOrderId || !providerPaymentId) return { ignored: true };

        const paymentOrder = await PaymentOrder.findOne({ providerOrderId });
        if (!paymentOrder) return { ignored: true };

        const result = await VerifiedPaymentService.applyVerifiedPayment({
            paymentOrder,
            verifiedFacts: {
                providerOrderId,
                providerPaymentId,
                providerSignatureHash: null,  // Webhook — no checkout signature to hash
                amountPaise: amountPaise || paymentOrder.amountPaise,
                currency: currency || paymentOrder.currency,
                method: normalized.method,
                captured: true,
                verificationSource: 'WEBHOOK',
                signatureVerified: true,
            },
            requestMeta: { requestId: webhookEvent._id.toString() },
        });

        return {
            bookingId: paymentOrder.bookingId.toString(),
            paymentOrderId: paymentOrder._id.toString(),
            transactionId: result.transactionNumber,
        };
    }

    /**
     * order.paid — Reconcile and apply payment idempotently.
     * This event fires when the entire Razorpay order is settled.
     * Since payment.captured may already have fired, VerifiedPaymentService handles idempotency.
     */
    async _handleOrderPaid(normalized, webhookEvent) {
        return await this._handlePaymentCaptured(normalized, webhookEvent);
    }

    /**
     * payment.failed — Record safe failure state.
     */
    async _handlePaymentFailed(normalized, webhookEvent) {
        const { providerOrderId, providerPaymentId, errorCode, errorDescriptionSafe } = normalized;
        if (!providerOrderId) return { ignored: true };

        const paymentOrder = await PaymentOrder.findOne({ providerOrderId });
        if (!paymentOrder) return { ignored: true };

        const result = await PaymentFailureService.applyPaymentFailure({
            paymentOrder,
            failureFacts: {
                providerPaymentId,
                providerOrderId,
                failureCode: errorCode,
                failureDescriptionSafe: errorDescriptionSafe,
                verificationSource: 'WEBHOOK',
                method: normalized.method,
            },
        });

        return {
            bookingId: paymentOrder.bookingId.toString(),
            paymentOrderId: paymentOrder._id.toString(),
        };
    }

    /**
     * refund.processed — Confirm provider refund and post double-entry ledger transactions.
     */
    async _handleRefundProcessed(parsedPayload, webhookEvent) {
        const entity = parsedPayload?.payload?.refund?.entity || {};
        const providerRefundId = entity.id;
        const providerPaymentId = entity.payment_id;

        if (!providerRefundId || !providerPaymentId) return { ignored: true };

        let refund = await Refund.findOne({ providerPaymentId, providerRefundId });
        if (!refund) {
            refund = await Refund.findOne({ providerPaymentId, status: { $in: ['APPROVED', 'PROCESSING', 'PROVIDER_SUBMITTED'] } });
        }

        if (!refund) return { ignored: true };

        if (refund.status === 'PROCESSED') {
            return {
                bookingId: refund.bookingId.toString(),
                paymentOrderId: refund.paymentOrderId.toString(),
                alreadyProcessed: true,
            };
        }

        // Save provider refund ID if missing
        refund.providerRefundId = providerRefundId;
        refund.providerIdempotencyReference = providerRefundId;
        await refund.save();

        // Secure transition to PROCESSED
        await RefundStateService.transitionStatus(refund._id, 'PROCESSED', {
            processedAmountPaise: refund.approvedAmountPaise,
        });

        // Post stage 2 ledger entry
        await LedgerPostingService.postRefundProcessed(refund, {
            actorId: 'SYSTEM',
            requestId: webhookEvent._id.toString(),
        });

        // Update booking states
        const booking = await Booking.findById(refund.bookingId);
        if (booking) {
            if (refund.refundType === 'FULL') {
                booking.paymentStatus = 'REFUNDED';
                booking.escrowStatus = 'REFUNDED';
                booking.bookingStatus = 'REFUNDED';
            } else {
                booking.paymentStatus = 'PARTIALLY_REFUNDED';
                booking.escrowStatus = 'RELEASED';
            }
            await booking.save();
        }

        // Close associated dispute case if any
        if (refund.disputeId) {
            await DisputeCase.findByIdAndUpdate(refund.disputeId, {
                status: 'RESOLVED_CUSTOMER',
                resolvedAt: new Date(),
                financialFreezeStatus: 'RELEASED',
            });
        }

        return {
            bookingId: refund.bookingId.toString(),
            paymentOrderId: refund.paymentOrderId.toString(),
            transactionId: refund._id.toString(),
        };
    }

    /**
     * refund.failed — Mark internal Refund as failed and notify.
     */
    async _handleRefundFailed(parsedPayload, webhookEvent) {
        const entity = parsedPayload?.payload?.refund?.entity || {};
        const providerRefundId = entity.id;
        const providerPaymentId = entity.payment_id;

        if (!providerRefundId || !providerPaymentId) return { ignored: true };

        const refund = await Refund.findOne({ providerRefundId });
        if (!refund) return { ignored: true };

        if (refund.status === 'FAILED') return { bookingId: refund.bookingId.toString() };

        await RefundStateService.transitionStatus(refund._id, 'FAILED', {
            failureCode: entity.error_code || 'PROVIDER_REFUND_FAILED',
            failureDescriptionSafe: entity.error_description || 'Gateway refund processing failed.',
        });

        return {
            bookingId: refund.bookingId.toString(),
            paymentOrderId: refund.paymentOrderId.toString(),
        };
    }

    /**
     * Derive a deterministic deduplication key when Razorpay does not provide an event ID.
     * Based on stable event fields: event type + provider order ID + provider payment ID + timestamp.
     */
    _deriveDeduplicationKey(payload) {
        const stable = JSON.stringify({
            event: payload.event,
            orderId: payload?.payload?.payment?.entity?.order_id ||
                     payload?.payload?.order?.entity?.id || '',
            paymentId: payload?.payload?.payment?.entity?.id || '',
            timestamp: payload?.created_at || '',
        });
        return `derived::${crypto.createHash('sha256').update(stable).digest('hex')}`;
    }
}

export const WebhookProcessorService = new WebhookProcessorServiceClass();
export default WebhookProcessorService;
