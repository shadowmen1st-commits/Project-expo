/**
 * Webhook routes — Razorpay webhook endpoint.
 *
 * CRITICAL ARCHITECTURE NOTE:
 * This router must be mounted BEFORE express.json() in index.js.
 * The rawBodyMiddleware captures the exact request bytes for signature verification.
 *
 * Mounting order in index.js:
 *   app.use('/api/v1/webhooks', rawBodyMiddleware, webhookRoutes); // FIRST
 *   app.use(express.json());                                        // THEN
 *
 * Authentication: Razorpay signature verification (no JWT required on webhook routes).
 */
import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/webhookController.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Dedicated rate limit for webhook endpoint to prevent DoS
const webhookRateLimit = rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 100,               // Max 100 webhook deliveries per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, errorCode: 'WEBHOOK_RATE_LIMIT', message: 'Too many webhook requests.' },
});

router.post('/razorpay', webhookRateLimit, handleRazorpayWebhook);

export default router;
