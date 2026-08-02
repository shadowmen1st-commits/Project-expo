/**
 * webhookController — Razorpay webhook handler.
 *
 * CRITICAL: This controller operates on raw request body bytes.
 * req.rawBody must be set by the raw-body middleware BEFORE express.json() parses it.
 *
 * The Razorpay signature is verified against the raw bytes, not a reconstructed JSON string.
 * JSON.stringify(req.body) is NEVER used for signature verification.
 *
 * Authentication: Webhook signature (RAZORPAY_WEBHOOK_SECRET) — no JWT required.
 */
import { razorpayProvider } from '../services/payments/RazorpayProvider.js';
import WebhookProcessorService from '../services/webhooks/WebhookProcessorService.js';
import crypto from 'crypto';
import PayoutWebhookService from '../services/payments/PayoutWebhookService.js';
import config from '../config/env.js';

/**
 * POST /api/v1/webhooks/razorpay
 *
 * Receives a Razorpay webhook event.
 * Verifies signature against raw bytes.
 * Processes event durably via WebhookProcessorService.
 * Returns 200 on successful acceptance (even for ignored events).
 * Returns 400 on signature failure.
 */
export const handleRazorpayWebhook = async (req, res, next) => {
    // ── 1. Get raw body — MUST be set by rawBodyMiddleware ──────────────────────
    const rawBody = req.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
        // This should never happen if middleware is correctly mounted
        return res.status(500).json({
            statusCode: 500,
            errorCode: 'WEBHOOK_RAW_BODY_MISSING',
            message: 'Internal configuration error: raw body not available.',
        });
    }

    // ── 2. Get signature header ───────────────────────────────────────────────
    const signature = req.headers['x-razorpay-signature'];

    // ── 3. Verify signature against raw bytes (timing-safe) ──────────────────
    // NOTE: Never log the signature or the expected signature
    const sigVerified = signature
        ? razorpayProvider.verifyWebhookSignature(rawBody, signature)
        : false;

    // ── 4. Process through WebhookProcessorService ────────────────────────────
    try {
        let eventType = '';
        try { eventType = JSON.parse(rawBody.toString('utf8'))?.event || ''; } catch { /* handled by service */ }
        if (eventType.startsWith('payout.')) {
            const result = await PayoutWebhookService.handleWebhook({ rawBody, signature, requestId: req.requestId, serverSecret: config.RAZORPAY_WEBHOOK_SECRET, maxBytes: config.PAYMENT_WEBHOOK_MAX_BODY_BYTES });
            if (!result.accepted) return res.status(result.reason === 'PAYLOAD_TOO_LARGE' ? 413 : 400).json({ statusCode: 400, errorCode: result.reason, message: 'Payout webhook rejected.' });
            return res.status(200).json({ success: true, eventId: result.eventId, deduplicated: result.deduplicated || false });
        }
        const result = await WebhookProcessorService.process({
            rawBody,
            signature,
            sigVerified,
            requestId: req.requestId,
            ipAddress: req.ip,
        });

        if (!result.accepted) {
            // Signature failed or parse error — return 400 so Razorpay knows to retry
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'WEBHOOK_REJECTED',
                message: 'Webhook signature verification failed.',
            });
        }

        // Return 200 for all accepted events (including ignored/deduplicated ones)
        return res.status(200).json({
            success: true,
            eventId: result.eventId,
            deduplicated: result.deduplicated || false,
        });
    } catch (err) {
        // Log safely — no signature or body content
        console.error(`[Webhook] Processing error for requestId=${req.requestId}:`, err.message);
        // Return 200 on internal errors to prevent Razorpay retry storms
        // The WebhookEvent record captures the failure for manual reconciliation
        return res.status(200).json({ success: true, processingDeferred: true });
    }
};
