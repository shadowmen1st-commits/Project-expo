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
import { config } from '../config/env.js';
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

/**
 * GET /api/v1/payments/checkout/:paymentOrderId
 * Serves the official Razorpay Checkout HTML page for mobile WebBrowser / WebView.
 */
export const renderCheckoutPage = async (req, res, next) => {
    try {
        const { paymentOrderId } = req.params;
        const order = await PaymentOrder.findById(paymentOrderId).populate('customerId').lean();
        if (!order) {
            return res.status(404).send('<h1>Payment Order Not Found</h1>');
        }

        const razorpayKeyId = config.RAZORPAY_KEY_ID;
        const customerName = order.customerId?.name || 'Customer';
        const customerEmail = order.customerId?.email || 'customer@jobnest.com';
        const customerPhone = order.customerId?.phone || '9999999999';

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JobNest Razorpay Checkout</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 380px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h2 { margin: 0 0 8px; color: #f59e0b; font-size: 22px; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; }
    .amount-box {
      background: #0f172a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid #334155;
    }
    .amount-label { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .amount-val { color: #22c55e; font-size: 28px; font-weight: bold; margin-top: 4px; }
    .btn {
      background: #f59e0b;
      color: #000;
      font-weight: 700;
      border: none;
      border-radius: 8px;
      padding: 14px 20px;
      width: 100%;
      font-size: 16px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
    .btn:active { transform: scale(0.98); }
    .badge {
      display: inline-block;
      background: #334155;
      color: #cbd5e1;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>JobNest Secure Checkout</h2>
    <p>Official Razorpay Payment Gateway</p>
    <div class="amount-box">
      <div class="amount-label">Amount Payable</div>
      <div class="amount-val">&#8377;${(order.amountPaise / 100).toFixed(2)}</div>
    </div>
    <button class="btn" id="payBtn" onclick="openRazorpay()">Open Razorpay Checkout</button>
    <div id="debugMsg" style="color: #ef4444; font-size: 12px; margin-top: 10px;"></div>
  </div>

  <script>
    window.onerror = function(msg, url, line) {
      document.getElementById('debugMsg').innerText = 'Error: ' + msg + ' (L' + line + ')';
    };

    const options = {
      key: "${razorpayKeyId}",
      amount: ${order.amountPaise},
      currency: "${order.currency || 'INR'}",
      name: "JobNest Services",
      description: "Service Booking #${order.orderNumber}",
      order_id: "${order.providerOrderId}",
      callback_url: "/api/payments/callback?internalPaymentOrderId=${order._id}",
      redirect: true,
      prefill: {
        name: "${customerName}",
        email: "${customerEmail}",
        contact: "${customerPhone}"
      },
      theme: { color: "#F59E0B" },
      handler: function(response) {
        const callbackUrl = 'jobnest://payment-callback?razorpay_order_id=' + encodeURIComponent(response.razorpay_order_id) +
                            '&razorpay_payment_id=' + encodeURIComponent(response.razorpay_payment_id) +
                            '&razorpay_signature=' + encodeURIComponent(response.razorpay_signature) +
                            '&internalPaymentOrderId=${order._id}';
        window.location.replace(callbackUrl);
      },
      modal: {
        ondismiss: function() {
          window.location.replace('jobnest://payment-callback?cancelled=true');
        }
      }
    };

    function openRazorpay() {
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp) {
        alert(resp.error.description || 'Payment Failed');
        window.location.href = 'jobnest://payment-callback?error=' + encodeURIComponent(resp.error.description || 'Payment Failed');
      });
      rzp.open();
    }

    window.onload = function() {
      setTimeout(openRazorpay, 300);
    };
  </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';");
        return res.send(html);
    } catch (err) {
        next(err);
    }
};

/**
 * ALL /api/v1/payments/callback
 * Accepts Razorpay redirect callback (GET/POST) and forwards 302 to jobnest:// scheme.
 */
export const handlePaymentRedirectCallback = (req, res) => {
    const data = req.method === 'POST' ? req.body : req.query;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internalPaymentOrderId, error, cancelled } = data || {};
    const q = new URLSearchParams();
    if (razorpay_order_id) q.set('razorpay_order_id', razorpay_order_id);
    if (razorpay_payment_id) q.set('razorpay_payment_id', razorpay_payment_id);
    if (razorpay_signature) q.set('razorpay_signature', razorpay_signature);
    if (internalPaymentOrderId) q.set('internalPaymentOrderId', internalPaymentOrderId);
    if (error) q.set('error', typeof error === 'string' ? error : JSON.stringify(error));
    if (cancelled) q.set('cancelled', 'true');
    const redirectUrl = `jobnest://payment-callback?${q.toString()}`;
    return res.redirect(302, redirectUrl);
};

