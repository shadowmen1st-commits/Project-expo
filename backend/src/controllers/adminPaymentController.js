/**
 * adminPaymentController — Admin-only payment management endpoints.
 *
 * Exposes:
 * GET  /api/v1/admin/payments                       — list payment orders
 * GET  /api/v1/admin/payments/:paymentId            — payment order detail
 * POST /api/v1/admin/payments/:paymentId/reconcile  — provider-backed reconciliation
 * GET  /api/v1/admin/webhook-events                 — list webhook events
 * GET  /api/v1/admin/webhook-events/:eventId        — webhook event detail
 *
 * Security:
 * - Requires authenticated ADMIN/SUPER_ADMIN role
 * - Requires payments.read or payments.manage permission
 * - No "Mark Paid" endpoint — reconciliation must verify through provider
 * - Never returns: key secret, webhook secret, full signatures, raw card/bank details
 */
import {
    listPaymentOrders,
    getPaymentOrderDetail,
    reconcilePaymentOrder,
} from '../services/payments/paymentReconciliationService.js';
import WebhookEvent from '../models/WebhookEvent.js';

/**
 * GET /api/v1/admin/payments
 */
export const listPayments = async (req, res, next) => {
    try {
        // Allow-listed query params only
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const status = req.query.status || undefined;
        const bookingId = req.query.bookingId || undefined;

        const result = await listPaymentOrders({ status, page, limit, bookingId });

        return res.status(200).json({
            success: true,
            ...result,
            requestId: req.requestId,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/v1/admin/payments/:paymentId
 */
export const getPaymentDetail = async (req, res, next) => {
    try {
        const data = await getPaymentOrderDetail(req.params.paymentId);
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
 * POST /api/v1/admin/payments/:paymentId/reconcile
 * Runs provider-backed reconciliation. Cannot force payment success.
 */
export const reconcilePayment = async (req, res, next) => {
    try {
        const report = await reconcilePaymentOrder(
            req.params.paymentId,
            { userId: req.user.id || req.user._id, role: req.user.role },
            {
                requestId: req.requestId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            }
        );
        return res.status(200).json({
            success: true,
            report,
            requestId: req.requestId,
        });
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
 * GET /api/v1/admin/webhook-events
 */
export const listWebhookEvents = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const processingStatus = req.query.processingStatus || undefined;
        const eventType = req.query.eventType || undefined;

        const query = {};
        if (processingStatus) query.processingStatus = processingStatus;
        if (eventType) query.eventType = eventType;

        const [events, total] = await Promise.all([
            WebhookEvent.find(query)
                .sort({ receivedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('-normalizedPayload -payloadHash -signatureHash') // Omit hashes and payload from list
                .lean(),
            WebhookEvent.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            events,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            requestId: req.requestId,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/v1/admin/webhook-events/:eventId
 */
export const getWebhookEventDetail = async (req, res, next) => {
    try {
        const event = await WebhookEvent.findById(req.params.eventId)
            .select('-payloadHash -signatureHash') // Never expose raw hashes in detail
            .lean();

        if (!event) {
            return res.status(404).json({
                statusCode: 404,
                errorCode: 'WEBHOOK_EVENT_NOT_FOUND',
                message: 'Webhook event not found.',
                requestId: req.requestId,
            });
        }

        return res.status(200).json({ success: true, data: event, requestId: req.requestId });
    } catch (err) {
        next(err);
    }
};
