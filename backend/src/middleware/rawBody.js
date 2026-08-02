/**
 * rawBodyMiddleware — Captures the exact raw request bytes.
 *
 * This is critical for webhook signature verification because:
 * - Razorpay signatures are generated against the exact original transmission bytes.
 * - JSON.parse followed by JSON.stringify reconstructs the payload, altering whitespace/ordering,
 *   which breaks the cryptographic signature match.
 *
 * Usage:
 * Mount this middleware BEFORE express.json() for the webhook route.
 */
import config from '../config/env.js';

export const rawBodyMiddleware = (req, res, next) => {
    const chunks = [];
    let bytesReceived = 0;
    const limit = config.PAYMENT_WEBHOOK_MAX_BODY_BYTES || 102400; // default 100kb

    req.on('data', (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived > limit) {
            // Destroy connection and return error
            req.destroy(new Error('Payload too large'));
            return;
        }
        chunks.push(chunk);
    });

    req.on('end', () => {
        if (bytesReceived > limit) {
            if (!res.headersSent) {
                res.status(413).json({
                    statusCode: 413,
                    errorCode: 'PAYLOAD_TOO_LARGE',
                    message: 'Webhook payload size limit exceeded.',
                });
            }
            return;
        }
        req.rawBody = Buffer.concat(chunks);
        next();
    });

    req.on('error', (err) => {
        next(err);
    });
};

export default rawBodyMiddleware;
