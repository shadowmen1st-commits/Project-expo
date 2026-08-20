/**
 * paymentService — Creates and manages PaymentOrders.
 *
 * This is the authoritative service for:
 * - Creating a new payment order (reading amount from Booking, NEVER from client)
 * - Enforcing idempotency via Idempotency-Key header
 * - Preventing duplicate active orders for the same booking
 * - Expiry validation
 * - Delegating Razorpay order creation to the provider
 */
import crypto from 'crypto';
import PaymentOrder from '../../models/PaymentOrder.js';
import Booking from '../../models/Booking.js';
import { razorpayProvider } from './RazorpayProvider.js';
import { assertSafeMoneyInteger } from '../../utils/moneyUtils.js';
import config from '../../config/env.js';

const EXPIRY_MINUTES = config.PAYMENT_ORDER_EXPIRY_MINUTES;
const CURRENCY = config.PAYMENT_CURRENCY;

/**
 * Create a new PaymentOrder for a PAYMENT_PENDING booking.
 *
 * @param {object} params
 * @param {string} params.bookingId       MongoDB ObjectId of the booking
 * @param {string} params.customerId      Authenticated customer's user ID
 * @param {string} params.idempotencyKey  From Idempotency-Key header (scoped to customer)
 * @param {string} params.requestId       For audit trails
 * @returns {object} Safe checkout data (never secrets)
 */
export async function createPaymentOrder({ bookingId, customerId, idempotencyKey, requestId }) {
    // ── 1. Load and validate booking ────────────────────────────────────────────
    const booking = await Booking.findById(bookingId);
    if (!booking) {
        const err = new Error('Booking not found.');
        err.statusCode = 404;
        err.errorCode = 'BOOKING_NOT_FOUND';
        throw err;
    }

    // ── 2. Ownership check ───────────────────────────────────────────────────────
    if (booking.customerId.toString() !== customerId) {
        const err = new Error('You do not own this booking.');
        err.statusCode = 403;
        err.errorCode = 'PAYMENT_ORDER_OWNERSHIP_ERROR';
        throw err;
    }

    // ── 3. Booking must be PAYMENT_PENDING ──────────────────────────────────────
    if (booking.bookingStatus !== 'PAYMENT_PENDING') {
        const err = new Error(`Booking is in ${booking.bookingStatus} state. Payment is only accepted for PAYMENT_PENDING bookings.`);
        err.statusCode = 409;
        err.errorCode = 'BOOKING_NOT_PAYMENT_PENDING';
        throw err;
    }

    // ── 4. Booking paymentStatus must be PENDING or FAILED (eligible for payment) ─
    if (!['PENDING', 'FAILED'].includes(booking.paymentStatus) || booking.escrowStatus !== 'NOT_FUNDED') {
        const err = new Error(`Booking payment status is ${booking.paymentStatus} and escrow status is ${booking.escrowStatus}. Cannot create a new payment order.`);
        err.statusCode = 409;
        err.errorCode = 'BOOKING_ALREADY_PAID_OR_INELIGIBLE';
        throw err;
    }

    // ── 5. Load and validate amount from the immutable pricing snapshot ──────────
    const snapshot = booking.pricingSnapshot;
    if (!snapshot) {
        const err = new Error('Booking pricing snapshot is missing. Cannot create payment order.');
        err.statusCode = 400;
        err.errorCode = 'BOOKING_SNAPSHOT_MISSING';
        throw err;
    }

    const amountPaise = snapshot.customerTotalPaise || snapshot.totalAmount;
    if (!amountPaise) {
        const err = new Error('Booking pricing snapshot is missing total amount. Cannot create payment order.');
        err.statusCode = 400;
        err.errorCode = 'BOOKING_SNAPSHOT_MISSING';
        throw err;
    }
    try {
        assertSafeMoneyInteger(amountPaise, 'Booking total amount');
    } catch (e) {
        const err = new Error('Booking pricing snapshot contains an invalid amount.');
        err.statusCode = 500;
        err.errorCode = 'BOOKING_SNAPSHOT_AMOUNT_INVALID';
        throw err;
    }

    const currency = snapshot.currency || CURRENCY;
    if (currency !== 'INR') {
        const err = new Error(`Currency ${currency} is not supported.`);
        err.statusCode = 400;
        err.errorCode = 'UNSUPPORTED_CURRENCY';
        throw err;
    }

    // ── 6. Idempotency — return existing order if key already used ───────────────
    const scopedKey = `${customerId}::create-payment-order::${idempotencyKey}`;
    const existing = await PaymentOrder.findOne({ idempotencyKey: scopedKey });
    if (existing) {
        // Same key + same booking = idempotent success
        if (existing.bookingId.toString() !== bookingId) {
            const err = new Error('Idempotency key has already been used for a different booking.');
            err.statusCode = 409;
            err.errorCode = 'IDEMPOTENCY_KEY_REUSED';
            throw err;
        }
        // Return the existing order's safe data
        return buildSafeOrderResponse(existing, booking);
    }

    // ── 7. Check for existing non-expired reusable provider order ────────────────
    const existingActive = await PaymentOrder.findOne({
        bookingId,
        status: 'PROVIDER_ORDER_CREATED',
        expiresAt: { $gt: new Date() },
    });
    if (existingActive) {
        return buildSafeOrderResponse(existingActive, booking);
    }

    // ── 8. Check attempt limit (prevent order-spam) ──────────────────────────────
    const attemptCount = await PaymentOrder.countDocuments({ bookingId });
    if (attemptCount >= 5) {
        const err = new Error('Maximum payment attempts reached for this booking. Contact support.');
        err.statusCode = 429;
        err.errorCode = 'PAYMENT_ATTEMPT_LIMIT_EXCEEDED';
        throw err;
    }

    // ── 9. Create internal PaymentOrder record ───────────────────────────────────
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
    const orderRecord = new PaymentOrder({
        bookingId,
        customerId,
        provider: 'razorpay',
        amountPaise,
        currency,
        status: 'CREATED',
        bookingAmountSnapshot: {
            totalAmount: amountPaise,
            baseAmount: snapshot.baseAmountPaise || snapshot.baseAmount,
            platformFee: snapshot.platformFeeAmountPaise || snapshot.platformFee,
            taxAmount: snapshot.taxAmountPaise || snapshot.taxAmount,
            discountAmount: snapshot.discountAmountPaise || snapshot.discountAmount,
            workerEarning: snapshot.workerEarningPaise || snapshot.workerEarning,
            commissionAmount: snapshot.commissionAmountPaise || snapshot.commissionAmount,
            currency: snapshot.currency,
        },
        quoteId: booking.quoteId,
        idempotencyKey: scopedKey,
        attemptNumber: attemptCount + 1,
        expiresAt,
    });

    // ── 10. Create Razorpay order on provider ────────────────────────────────────
    // Safe receipt: use internal order number (no customer PII, no secrets)
    const receipt = `BK-${booking.bookingNumber}-${orderRecord.attemptNumber}`.substring(0, 40);
    orderRecord.providerReceipt = receipt;

    let providerOrder;
    try {
        providerOrder = await razorpayProvider.createOrder({
            amountPaise,
            currency,
            receipt,
            // Safe notes — no PII, no secrets, no worker data
            notes: {
                bookingNumber: booking.bookingNumber,
                internalOrderId: orderRecord._id.toString(),
            },
        });
    } catch (providerErr) {
        console.error('[PAYMENT_PROVIDER_CREATE_ORDER_FAILED]', providerErr?.message || providerErr);
        // Save CREATED record even if provider fails (for audit)
        orderRecord.status = 'FAILED';
        await orderRecord.save();

        if (providerErr.errorCode === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
            throw providerErr;
        }
        const err = new Error(providerErr?.message || 'Payment provider is currently unavailable. Please try again.');
        err.statusCode = 502;
        err.errorCode = 'PAYMENT_PROVIDER_ERROR';
        throw err;
    }

    // ── 11. Store provider order ID and update status ────────────────────────────
    orderRecord.providerOrderId = providerOrder.id;
    orderRecord.lastProviderStatus = providerOrder.status;
    orderRecord.status = 'PROVIDER_ORDER_CREATED';
    await orderRecord.save();

    return buildSafeOrderResponse(orderRecord, booking);
}

/**
 * Get the current payment status for a booking (customer-safe view).
 */
export async function getPaymentStatusForBooking(bookingId, customerId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
        const err = new Error('Booking not found.');
        err.statusCode = 404;
        err.errorCode = 'BOOKING_NOT_FOUND';
        throw err;
    }
    if (booking.customerId.toString() !== customerId) {
        const err = new Error('You do not own this booking.');
        err.statusCode = 403;
        err.errorCode = 'PAYMENT_ORDER_OWNERSHIP_ERROR';
        throw err;
    }

    const orders = await PaymentOrder.find({ bookingId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    return {
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        orders: orders.map(o => ({
            orderNumber: o.orderNumber,
            status: o.status,
            amountPaise: o.amountPaise,
            currency: o.currency,
            attemptNumber: o.attemptNumber,
            expiresAt: o.expiresAt,
            paidAt: o.paidAt,
            failedAt: o.failedAt,
            provider: o.provider,
            // Never expose: providerOrderId raw, idempotencyKey, secrets
        })),
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSafeOrderResponse(orderRecord, booking) {
    return {
        internalPaymentOrderId: orderRecord._id.toString(),
        razorpayOrderId: orderRecord.providerOrderId,
        amount: orderRecord.amountPaise,
        currency: orderRecord.currency,
        publicKeyId: config.RAZORPAY_KEY_ID,  // Public key only — safe to expose
        bookingNumber: booking.bookingNumber,
        orderNumber: orderRecord.orderNumber,
        expiresAt: orderRecord.expiresAt,
        status: orderRecord.status,
        attemptNumber: orderRecord.attemptNumber,
        // Never include: RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, idempotencyKey
    };
}
