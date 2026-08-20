/**
 * paymentOrderController — Customer-facing payment endpoints.
 *
 * POST /api/v1/payments/orders   — Create a payment order
 * POST /api/v1/payments/verify   — Verify checkout callback
 * GET  /api/v1/payments/booking/:bookingId — Get payment status
 * GET  /api/v1/payments/orders/:paymentOrderId — Get payment order detail
 *
 * Security rules enforced here:
 * - Customer JWT authentication required on all routes
 * - Booking ownership verified in service layer
 * - Amount is loaded from Booking snapshot, never from request body
 * - Idempotency-Key header validated and scoped to customer
 * - No secrets, signatures, or raw provider data returned to client
 */
import { createPaymentOrder, getPaymentStatusForBooking } from '../services/payments/paymentService.js';
import { verifyCheckoutCallback } from '../services/payments/paymentSignatureService.js';
import PaymentOrder from '../models/PaymentOrder.js';
import { z } from 'zod';

const createOrderSchema = z.object({
    bookingId: z.string().min(24).max(24),
});

const verifySchema = z.object({
    internalPaymentOrderId: z.string().min(24).max(24),
    razorpay_order_id: z.string().min(1).max(100),
    razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().min(1).max(256),
});

/**
 * POST /api/v1/payments/orders
 * Creates a real Razorpay order for a PAYMENT_PENDING booking.
 */
export const createOrder = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'CUSTOMER') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'FORBIDDEN',
                message: 'Only customers can initiate payments.',
                requestId: req.requestId,
            });
        }

        const validated = createOrderSchema.parse(req.body);

        // Validate Idempotency-Key header
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
                message: 'A valid Idempotency-Key header (8–128 chars) is required.',
                requestId: req.requestId,
            });
        }
        // Allow only safe characters in idempotency key
        if (!/^[a-zA-Z0-9\-_:.]+$/.test(idempotencyKey)) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'IDEMPOTENCY_KEY_INVALID',
                message: 'Idempotency-Key contains invalid characters.',
                requestId: req.requestId,
            });
        }

        console.log('[PAYMENT] Creating Razorpay order for booking:', validated.bookingId);

        const result = await createPaymentOrder({
            bookingId: validated.bookingId,
            customerId: user.id || user._id,
            idempotencyKey,
            requestId: req.requestId,
        });

        console.log('[PAYMENT] Razorpay order created:', {
            bookingId: validated.bookingId,
            internalPaymentOrderId: result.internalPaymentOrderId,
            razorpayOrderId: result.razorpayOrderId,
            amount: result.amount,
            currency: result.currency,
        });

        return res.status(201).json({
            success: true,
            data: result,
            requestId: req.requestId,
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VALIDATION_ERROR',
                message: 'Invalid request body.',
                requestId: req.requestId,
            });
        }
        if (err.statusCode) {
            return res.status(err.statusCode).json({
                statusCode: err.statusCode,
                errorCode: err.errorCode || 'PAYMENT_ERROR',
                message: err.message,
                requestId: req.requestId,
            });
        }
        next(err);
    }
};

/**
 * POST /api/v1/payments/verify
 * Verifies the Razorpay checkout callback signature and applies payment state.
 */
export const verifyPayment = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'CUSTOMER') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'FORBIDDEN',
                message: 'Only customers can verify payments.',
                requestId: req.requestId,
            });
        }

        const validated = verifySchema.parse(req.body);

        console.log('[PAYMENT:VERIFY_START]', {
            internalPaymentOrderId: validated.internalPaymentOrderId,
            razorpay_order_id: validated.razorpay_order_id,
            razorpay_payment_id: validated.razorpay_payment_id,
        });

        const result = await verifyCheckoutCallback({
            internalPaymentOrderId: validated.internalPaymentOrderId,
            razorpayOrderId: validated.razorpay_order_id,
            razorpayPaymentId: validated.razorpay_payment_id,
            razorpaySignature: validated.razorpay_signature,
            customerId: user.id || user._id,
            requestMeta: {
                requestId: req.requestId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            },
        });

        return res.status(200).json({
            success: true,
            data: result,
            requestId: req.requestId,
        });
    } catch (err) {
        if (err.name === 'ZodError') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VALIDATION_ERROR',
                message: 'Invalid verification request body.',
                requestId: req.requestId,
            });
        }
        if (err.statusCode) {
            return res.status(err.statusCode).json({
                statusCode: err.statusCode,
                errorCode: err.errorCode || 'PAYMENT_VERIFICATION_ERROR',
                message: err.message,
                requestId: req.requestId,
            });
        }
        next(err);
    }
};

/**
 * GET /api/v1/payments/booking/:bookingId
 * Customer can check payment status for their own booking.
 */
export const getPaymentByBooking = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ statusCode: 401, errorCode: 'UNAUTHENTICATED' });

        const data = await getPaymentStatusForBooking(
            req.params.bookingId,
            user.id || user._id,
        );

        return res.status(200).json({ success: true, data, requestId: req.requestId });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({
                statusCode: err.statusCode,
                errorCode: err.errorCode,
                message: err.message,
                requestId: req.requestId,
            });
        }
        next(err);
    }
};

/**
 * GET /api/v1/payments/orders/:paymentOrderId
 * Customer can view their own payment order.
 */
export const getPaymentOrderById = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ statusCode: 401, errorCode: 'UNAUTHENTICATED' });

        const order = await PaymentOrder.findById(req.params.paymentOrderId).lean();
        if (!order) {
            return res.status(404).json({
                statusCode: 404,
                errorCode: 'PAYMENT_ORDER_NOT_FOUND',
                message: 'Payment order not found.',
            });
        }

        // Ownership check
        if (order.customerId.toString() !== (user.id || user._id)) {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'PAYMENT_ORDER_OWNERSHIP_ERROR',
                message: 'You do not own this payment order.',
            });
        }

        // Return safe subset only — no idempotency keys, no provider secrets
        return res.status(200).json({
            success: true,
            data: {
                orderNumber: order.orderNumber,
                bookingId: order.bookingId,
                status: order.status,
                amountPaise: order.amountPaise,
                currency: order.currency,
                provider: order.provider,
                attemptNumber: order.attemptNumber,
                expiresAt: order.expiresAt,
                paidAt: order.paidAt,
                failedAt: order.failedAt,
                createdAt: order.createdAt,
            },
            requestId: req.requestId,
        });
    } catch (err) {
        next(err);
    }
};
