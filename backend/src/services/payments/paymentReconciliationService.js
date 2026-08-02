/**
 * paymentReconciliationService — Admin-only payment reconciliation.
 *
 * Compares internal records against live Razorpay API data.
 * All reconciliation actions are audited and idempotent.
 * Admin cannot manually force payment success — only provider verification triggers state changes.
 */
import PaymentOrder from '../../models/PaymentOrder.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import Booking from '../../models/Booking.js';
import AuditLog from '../../models/AuditLog.js';
import { razorpayProvider } from './RazorpayProvider.js';
import VerifiedPaymentService from './VerifiedPaymentService.js';

/**
 * Reconcile a single PaymentOrder against live Razorpay data.
 *
 * @param {string} paymentOrderId  Internal MongoDB _id
 * @param {object} adminUser       { userId, role }
 * @param {object} requestMeta     { requestId, ipAddress, userAgent }
 * @returns {object} Reconciliation report
 */
export async function reconcilePaymentOrder(paymentOrderId, adminUser, requestMeta = {}) {
    const paymentOrder = await PaymentOrder.findById(paymentOrderId).lean();
    if (!paymentOrder) {
        const err = new Error('Payment order not found.');
        err.statusCode = 404;
        err.errorCode = 'PAYMENT_ORDER_NOT_FOUND';
        throw err;
    }

    const report = {
        internalOrderNumber: paymentOrder.orderNumber,
        internalStatus: paymentOrder.status,
        providerOrderId: paymentOrder.providerOrderId,
        amountPaise: paymentOrder.amountPaise,
        currency: paymentOrder.currency,
        discrepancies: [],
        actionsApplied: [],
    };

    // ── Record that reconciliation was attempted ────────────────────────────────
    await AuditLog.create({
        actor: adminUser.userId,
        action: 'PAYMENT_RECONCILIATION_STARTED',
        resourceType: 'PaymentOrder',
        resourceId: paymentOrder._id.toString(),
        beforeSnapshot: { status: paymentOrder.status },
        afterSnapshot: { reconciledBy: adminUser.userId },
        ipAddress: requestMeta.ipAddress || '',
        userAgent: requestMeta.userAgent || '',
        requestId: requestMeta.requestId || '',
    });

    // ── If no provider order exists yet, nothing to reconcile ──────────────────
    if (!paymentOrder.providerOrderId) {
        report.discrepancies.push('NO_PROVIDER_ORDER_ID');
        return report;
    }

    // ── Fetch provider order ───────────────────────────────────────────────────
    let providerOrder;
    try {
        providerOrder = await razorpayProvider.fetchOrder(paymentOrder.providerOrderId);
    } catch (err) {
        if (err.errorCode === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
            report.discrepancies.push('PROVIDER_NOT_CONFIGURED');
            report.note = 'Razorpay credentials not configured. Cannot perform live reconciliation.';
            return report;
        }
        report.discrepancies.push('PROVIDER_FETCH_FAILED');
        return report;
    }

    report.providerStatus = providerOrder.status;
    report.providerAmount = providerOrder.amount;
    report.providerCurrency = providerOrder.currency;

    // ── Amount mismatch ────────────────────────────────────────────────────────
    if (providerOrder.amount !== paymentOrder.amountPaise) {
        report.discrepancies.push('AMOUNT_MISMATCH');
    }

    // ── Currency mismatch ──────────────────────────────────────────────────────
    if (providerOrder.currency !== paymentOrder.currency) {
        report.discrepancies.push('CURRENCY_MISMATCH');
    }

    // ── Provider says paid but internal says not ───────────────────────────────
    if (providerOrder.status === 'paid' && paymentOrder.status !== 'PAID') {
        report.discrepancies.push('PROVIDER_PAID_INTERNAL_PENDING');

        // Fetch provider payment to apply verified payment
        const transactions = await razorpayProvider.isConfigured()
            ? await razorpayProvider.fetchOrder(paymentOrder.providerOrderId)
            : null;

        // Apply verified payment through the authorised service
        const freshOrder = await PaymentOrder.findById(paymentOrder._id);
        if (freshOrder) {
            try {
                const result = await VerifiedPaymentService.applyVerifiedPayment({
                    paymentOrder: freshOrder,
                    verifiedFacts: {
                        providerOrderId: providerOrder.id,
                        providerPaymentId: `reconcile-${providerOrder.id}`,
                        providerSignatureHash: null,
                        amountPaise: providerOrder.amount,
                        currency: providerOrder.currency,
                        method: null,
                        captured: true,
                        verificationSource: 'RECONCILIATION',
                        signatureVerified: false,  // Not from checkout — from admin reconciliation
                    },
                    requestMeta: { ...requestMeta, actorId: adminUser.userId },
                });
                report.actionsApplied.push('PAYMENT_APPLIED_VIA_RECONCILIATION');
            } catch (e) {
                report.discrepancies.push(`RECONCILIATION_APPLY_FAILED: ${e.message.substring(0, 100)}`);
            }
        }
    }

    // ── Internal says paid but provider says failed ────────────────────────────
    if (providerOrder.status !== 'paid' && paymentOrder.status === 'PAID') {
        report.discrepancies.push('INTERNAL_PAID_PROVIDER_NOT_PAID');
        // Flag for manual review — do not auto-reverse without human oversight
        await AuditLog.create({
            actor: adminUser.userId,
            action: 'PAYMENT_RECONCILIATION_CRITICAL_MISMATCH',
            resourceType: 'PaymentOrder',
            resourceId: paymentOrder._id.toString(),
            beforeSnapshot: { internalStatus: 'PAID' },
            afterSnapshot: { providerStatus: providerOrder.status },
            ipAddress: requestMeta.ipAddress || '',
            requestId: requestMeta.requestId || '',
        });
    }

    return report;
}

/**
 * List payment orders with pagination and filters (admin view).
 */
export async function listPaymentOrders({ status, page = 1, limit = 20, bookingId } = {}) {
    const query = {};
    if (status) query.status = status;
    if (bookingId) query.bookingId = bookingId;

    const [orders, total] = await Promise.all([
        PaymentOrder.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('bookingId', 'bookingNumber bookingStatus paymentStatus')
            .populate('customerId', 'name email')
            .lean(),
        PaymentOrder.countDocuments(query),
    ]);

    // Sanitize output — remove idempotency keys from admin list
    return {
        orders: orders.map(o => sanitizeOrderForAdmin(o)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * Get full payment order details for admin.
 */
export async function getPaymentOrderDetail(paymentOrderId) {
    const order = await PaymentOrder.findById(paymentOrderId)
        .populate('bookingId', 'bookingNumber bookingStatus paymentStatus pricingSnapshot')
        .populate('customerId', 'name email phone')
        .lean();

    if (!order) {
        const err = new Error('Payment order not found.');
        err.statusCode = 404;
        err.errorCode = 'PAYMENT_ORDER_NOT_FOUND';
        throw err;
    }

    const transactions = await PaymentTransaction.find({ paymentOrderId })
        .sort({ createdAt: -1 })
        .lean();

    return {
        ...sanitizeOrderForAdmin(order),
        transactions: transactions.map(t => sanitizeTransactionForAdmin(t)),
    };
}

// ─── Sanitization helpers ─────────────────────────────────────────────────────

function sanitizeOrderForAdmin(order) {
    const { idempotencyKey, metadata, ...safe } = order;
    return safe;
}

function sanitizeTransactionForAdmin(txn) {
    const { idempotencyKey, providerSignatureHash, ...safe } = txn;
    // providerSignatureHash is already a SHA-256 hash, not the raw signature
    // We still omit it from admin API responses as extra caution
    return {
        ...safe,
        signatureVerifiedIndicator: txn.signatureVerified,  // Boolean only
    };
}
