/**
 * paymentSignatureService — Verifies Razorpay checkout callback signatures.
 *
 * Security:
 * - Timing-safe comparison via crypto.timingSafeEqual (in RazorpayProvider)
 * - providerSignatureHash stores SHA-256(rawSignature), never the raw value
 * - Amount and currency are reconciled against the internal PaymentOrder
 * - Do not expose calculated expected signature in error responses
 */
import crypto from 'crypto';
import PaymentOrder from '../../models/PaymentOrder.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import { razorpayProvider } from './RazorpayProvider.js';
import VerifiedPaymentService from './VerifiedPaymentService.js';
import PaymentFailureService from './PaymentFailureService.js';

/**
 * Verify a Razorpay checkout callback and apply verified payment state.
 *
 * @param {object} params
 * @param {string} params.internalPaymentOrderId  Internal MongoDB _id of PaymentOrder
 * @param {string} params.razorpayOrderId         razorpay_order_id from callback
 * @param {string} params.razorpayPaymentId       razorpay_payment_id from callback
 * @param {string} params.razorpaySignature       razorpay_signature from callback
 * @param {string} params.customerId              Authenticated customer's user ID
 * @param {object} params.requestMeta             { requestId, ipAddress, userAgent }
 * @returns {object} Safe verification result
 */
export async function verifyCheckoutCallback({
    internalPaymentOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    customerId,
    requestMeta = {},
}) {
    // ── 1. Input validation ──────────────────────────────────────────────────────
    if (!internalPaymentOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        const err = new Error('Missing required verification fields.');
        err.statusCode = 400;
        err.errorCode = 'VALIDATION_ERROR';
        throw err;
    }

    // ── 2. Load internal PaymentOrder ────────────────────────────────────────────
    const paymentOrder = await PaymentOrder.findById(internalPaymentOrderId);
    if (!paymentOrder) {
        const err = new Error('Payment order not found.');
        err.statusCode = 404;
        err.errorCode = 'PAYMENT_ORDER_NOT_FOUND';
        throw err;
    }

    // ── 3. Ownership check ───────────────────────────────────────────────────────
    if (paymentOrder.customerId.toString() !== customerId) {
        const err = new Error('You do not own this payment order.');
        err.statusCode = 403;
        err.errorCode = 'PAYMENT_ORDER_OWNERSHIP_ERROR';
        throw err;
    }

    // ── 4. Provider order ID reconciliation ─────────────────────────────────────
    if (paymentOrder.providerOrderId !== razorpayOrderId) {
        const err = new Error('Provider order ID does not match internal record.');
        err.statusCode = 400;
        err.errorCode = 'PROVIDER_ORDER_MISMATCH';
        throw err;
    }

    // ── 5. Idempotency — already verified? ───────────────────────────────────────
    if (paymentOrder.status === 'PAID') {
        return {
            success: true,
            alreadyProcessed: true,
            message: 'Payment has already been verified and applied.',
            bookingId: paymentOrder.bookingId.toString(),
        };
    }

    // ── 6. Duplicate payment ID check ────────────────────────────────────────────
    const dupTxn = await PaymentTransaction.findOne({
        providerPaymentId: razorpayPaymentId,
        status: { $in: ['SUCCESS', 'SETTLED', 'PROCESSING'] }
    });
    if (dupTxn) {
        // Already processed — idempotent return
        return {
            success: true,
            alreadyProcessed: true,
            message: 'This payment has already been recorded.',
            bookingId: paymentOrder.bookingId.toString(),
        };
    }

    // ── 7. Signature verification (timing-safe) ─────────────────────────────────
    console.log('[PAYMENT] Verifying signature for order:', razorpayOrderId);
    const sigVerified = razorpayProvider.verifyCheckoutSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    );

    if (!sigVerified) {
        // Record failed transaction for audit
        await createFailedTransaction(paymentOrder, razorpayPaymentId, razorpaySignature, 'CHECKOUT_CALLBACK');
        const err = new Error('Payment signature verification failed.');
        err.statusCode = 400;
        err.errorCode = 'PAYMENT_SIGNATURE_INVALID';
        throw err;
    }

    console.log('[PAYMENT] Signature verification successful for order:', razorpayOrderId);

    // ── 8. Fetch payment details from Razorpay for amount/currency reconciliation ─
    let providerPayment = null;
    if (razorpayProvider.isConfigured()) {
        try {
            providerPayment = await razorpayProvider.fetchPayment(razorpayPaymentId);
        } catch {
            // Non-fatal — proceed with signature verification as source of truth
        }
    }

    // ── 9. Amount and currency reconciliation ────────────────────────────────────
    if (providerPayment) {
        if (providerPayment.amount !== paymentOrder.amountPaise) {
            const err = new Error('Payment amount does not match the order amount.');
            err.statusCode = 409;
            err.errorCode = 'PAYMENT_AMOUNT_MISMATCH';
            throw err;
        }
        if (providerPayment.currency !== paymentOrder.currency) {
            const err = new Error('Payment currency does not match the order currency.');
            err.statusCode = 409;
            err.errorCode = 'PAYMENT_CURRENCY_MISMATCH';
            throw err;
        }
    }

    // ── 10. Build verified facts and apply through VerifiedPaymentService ─────────
    // Hash the signature for storage — never store raw signature
    const signatureHash = crypto
        .createHash('sha256')
        .update(razorpaySignature)
        .digest('hex');

    const verifiedFacts = {
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        providerSignatureHash: signatureHash,    // SHA-256 of signature, not signature itself
        amountPaise: providerPayment?.amount || paymentOrder.amountPaise,
        currency: providerPayment?.currency || paymentOrder.currency,
        method: providerPayment?.method || null,
        captured: providerPayment?.captured || false,
        verificationSource: 'CHECKOUT_CALLBACK',
        signatureVerified: true,
    };

    const result = await VerifiedPaymentService.applyVerifiedPayment({
        paymentOrder,
        verifiedFacts,
        requestMeta,
    });

    return {
        success: true,
        alreadyProcessed: false,
        bookingId: paymentOrder.bookingId.toString(),
        transactionNumber: result.transactionNumber,
        message: 'Payment verified successfully. Booking is now PAID.',
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createFailedTransaction(paymentOrder, providerPaymentId, rawSignature, source) {
    const signatureHash = rawSignature
        ? crypto.createHash('sha256').update(rawSignature).digest('hex')
        : null;

    const idempotencyKey = `verify-fail::${paymentOrder._id}::${providerPaymentId || 'unknown'}::${Date.now()}`;
    try {
        await PaymentTransaction.create({
            bookingId: paymentOrder.bookingId,
            paymentOrderId: paymentOrder._id,
            customerId: paymentOrder.customerId,
            provider: 'razorpay',
            providerOrderId: paymentOrder.providerOrderId,
            providerPaymentId,
            providerSignatureHash: signatureHash,
            amountPaise: paymentOrder.amountPaise,
            currency: paymentOrder.currency,
            status: 'FAILED',
            verificationSource: source,
            signatureVerified: false,
            failureCode: 'SIGNATURE_VERIFICATION_FAILED',
            failureDescriptionSafe: 'Checkout signature did not match.',
            idempotencyKey,
        });
    } catch {
        // Ignore duplicate key on concurrent requests
    }
}
