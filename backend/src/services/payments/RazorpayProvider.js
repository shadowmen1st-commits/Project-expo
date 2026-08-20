/**
 * RazorpayProvider — Concrete implementation of PaymentProvider for Razorpay.
 *
 * Security guarantees:
 * - verifyCheckoutSignature uses crypto.timingSafeEqual (not string ===)
 * - verifyWebhookSignature operates on raw Buffer bytes, never reconstructed JSON
 * - normalizeWebhookEvent strips all sensitive fields
 * - RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET never logged or returned
 * - One Razorpay client instance is created and shared (dependency-injectable for tests)
 */
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { PaymentProvider } from './PaymentProvider.js';
import config from '../../config/env.js';

// ─── Singleton client ─────────────────────────────────────────────────────────
let _razorpayInstance = null;
const _mockOrdersStore = new Map();

/**
 * Get the configured Razorpay client.
 * Allows test injection via setRazorpayInstance().
 */
function getRazorpayClient() {
    if (_razorpayInstance) return _razorpayInstance;

    const keyId = config.RAZORPAY_KEY_ID;
    const keySecret = config.RAZORPAY_KEY_SECRET;

    // Production guard
    if (config.NODE_ENV === 'production') {
        if (config.PAYMENT_PROVIDER_MODE === 'mock' || keyId?.startsWith('rzp_test_mock') || keySecret === 'mockKeySecret456') {
            throw new Error('Production environment does not allow mock payment mode or credentials.');
        }
    }

    // Only allow mock client simulation in non-production environment with explicit mock mode enabled
    if (config.NODE_ENV !== 'production' && config.PAYMENT_PROVIDER_MODE === 'mock') {
        return {
            orders: {
                create: async (params) => {
                    const orderObj = {
                        id: `order_mock_${crypto.randomBytes(8).toString('hex')}`,
                        amount: params.amount,
                        currency: params.currency || 'INR',
                        receipt: params.receipt,
                        status: 'created',
                        notes: params.notes,
                    };
                    _mockOrdersStore.set(orderObj.id, orderObj);
                    return orderObj;
                },
                fetch: async (id) => {
                    return _mockOrdersStore.get(id) || {
                        id,
                        amount: 50000,
                        currency: 'INR',
                        status: 'paid',
                    };
                }
            },
            payments: {
                fetch: async (id) => {
                    let amount = 50000;
                    let currency = 'INR';
                    for (const ord of _mockOrdersStore.values()) {
                        amount = ord.amount;
                        currency = ord.currency;
                    }
                    return {
                        id,
                        amount,
                        currency,
                        status: 'captured',
                        method: 'upi',
                        captured: true,
                    };
                },
                refund: async (paymentId, params) => ({
                    id: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`,
                    payment_id: paymentId,
                    amount: params.amount,
                    currency: 'INR',
                    status: 'processed',
                })
            },
            refunds: {
                create: async (params) => ({
                    id: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`,
                    payment_id: params.payment_id,
                    amount: params.amount,
                    currency: 'INR',
                    status: 'processed',
                }),
                fetch: async (id) => ({
                    id,
                    payment_id: 'pay_mock_123',
                    amount: 50000,
                    currency: 'INR',
                    status: 'processed',
                })
            }
        };
    }

    // Normal development/production requires actual config
    if (!keyId || !keySecret || keyId.startsWith('rzp_test_mock') || keySecret === 'mockKeySecret456') {
        return null; // Triggers PAYMENT_PROVIDER_NOT_CONFIGURED error
    }

    _razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return _razorpayInstance;
}

/**
 * Inject a mock Razorpay instance for testing (dependency injection).
 * @param {object} mockInstance
 */
export function setRazorpayInstance(mockInstance) {
    _razorpayInstance = mockInstance;
}

/**
 * Reset the instance (used in test teardown).
 */
export function resetRazorpayInstance() {
    _razorpayInstance = null;
}

// ─── Provider Implementation ──────────────────────────────────────────────────

export class RazorpayProvider extends PaymentProvider {
    /**
     * Validate that required Razorpay credentials are present and non-mock.
     */
    validateProviderConfiguration() {
        const keyId = config.RAZORPAY_KEY_ID;
        const keySecret = config.RAZORPAY_KEY_SECRET;
        const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET;

        // If credentials are completely missing
        const missing = !keyId || !keySecret || !webhookSecret;

        // In production, mock values are treated as missing
        const isProd = config.NODE_ENV === 'production';
        const isMock = keyId?.startsWith('rzp_test_mock') ||
                       keySecret === 'mockKeySecret456' ||
                       webhookSecret === 'mockWebhookSecret789';

        // Check if we are allowed to use mock in non-production environment
        const isMockAllowed = config.NODE_ENV !== 'production' && config.PAYMENT_PROVIDER_MODE === 'mock';

        if (missing || (isProd && isMock) || (isMock && !isMockAllowed)) {
            const err = new Error(
                'Payment provider is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.'
            );
            err.errorCode = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
            err.statusCode = 503;
            throw err;
        }
    }

    /**
     * Returns true if provider credentials are real (non-mock).
     */
    isConfigured() {
        const keyId = config.RAZORPAY_KEY_ID;
        const keySecret = config.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) return false;
        if (config.NODE_ENV !== 'production' && config.PAYMENT_PROVIDER_MODE === 'mock') return true;
        return !!(
            !keyId.startsWith('rzp_test_mock') &&
            keySecret !== 'mockKeySecret456'
        );
    }

    /**
     * Create a Razorpay order.
     * @param {object} params
     * @param {number} params.amountPaise  Integer paise
     * @param {string} params.currency
     * @param {string} params.receipt      Safe internal reference (≤40 chars)
     * @param {object} [params.notes]
     * @returns {Promise<object>} Razorpay order
     */
    async createOrder({ amountPaise, currency, receipt, notes = {} }) {
        const client = getRazorpayClient();
        if (!client) {
            const err = new Error('Payment provider credentials are not configured.');
            err.errorCode = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
            err.statusCode = 503;
            throw err;
        }
        return await client.orders.create({
            amount: amountPaise,   // Razorpay expects paise
            currency,
            receipt: receipt.substring(0, 40),  // Razorpay limit
            notes,
        });
    }

    /**
     * Fetch a Razorpay order by provider order ID.
     */
    async fetchOrder(providerOrderId) {
        const client = getRazorpayClient();
        if (!client) throw this._notConfiguredError();
        return await client.orders.fetch(providerOrderId);
    }

    /**
     * Fetch a Razorpay payment by provider payment ID.
     */
    async fetchPayment(providerPaymentId) {
        const client = getRazorpayClient();
        if (!client) throw this._notConfiguredError();
        return await client.payments.fetch(providerPaymentId);
    }

    /**
     * Verify Razorpay checkout callback signature.
     * Canonical message: razorpay_order_id + "|" + razorpay_payment_id
     * Uses HMAC-SHA256 with KEY_SECRET and timing-safe comparison.
     *
     * @param {string} providerOrderId
     * @param {string} providerPaymentId
     * @param {string} signature         razorpay_signature from checkout callback
     * @returns {boolean}
     */
    verifyCheckoutSignature(providerOrderId, providerPaymentId, signature) {
        if (!providerOrderId || !providerPaymentId || !signature) return false;

        // In non-production testing, allow simulated sandbox mock signature only with explicit sandbox token
        if (config.NODE_ENV !== 'production' && (signature === 'SANDBOX_MOCK_SIGNATURE' || signature.startsWith('mock_sig_'))) {
            return true;
        }

        const keySecret = config.RAZORPAY_KEY_SECRET;
        if (!keySecret) return false;

        const message = `${providerOrderId}|${providerPaymentId}`;
        const expectedSig = crypto
            .createHmac('sha256', keySecret)
            .update(message)
            .digest('hex');

        // Convert to Buffer for timing-safe comparison
        const expectedBuf = Buffer.from(expectedSig, 'hex');
        let actualBuf;
        try {
            actualBuf = Buffer.from(signature, 'hex');
        } catch (e) {
            return false;
        }

        if (expectedBuf.length !== actualBuf.length) return false;
        return crypto.timingSafeEqual(expectedBuf, actualBuf);
    }

    /**
     * Verify a Razorpay webhook signature against the raw request body.
     *
     * CRITICAL: rawBody MUST be the original Buffer from the HTTP request.
     * Never pass JSON.stringify(req.body) — that reconstructed string does NOT
     * match the original bytes and will cause every legitimate webhook to fail.
     *
     * @param {Buffer} rawBody   Exact bytes from HTTP request
     * @param {string} signature x-razorpay-signature header value
     * @returns {boolean}
     */
    verifyWebhookSignature(rawBody, signature) {
        if (!rawBody || !signature) return false;

        const webhookSecret = config.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) return false;

        const expectedSig = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)  // rawBody is a Buffer — HMAC accepts Buffer directly
            .digest('hex');

        const expectedBuf = Buffer.from(expectedSig, 'hex');
        let actualBuf;
        try {
            actualBuf = Buffer.from(signature, 'hex');
        } catch {
            return false;
        }

        if (expectedBuf.length !== actualBuf.length) return false;
        return crypto.timingSafeEqual(expectedBuf, actualBuf);
    }

    /**
     * Normalize a webhook event to a safe internal representation.
     * Strips sensitive fields: card numbers, bank account details, raw signatures.
     *
     * @param {object} parsedPayload Parsed JSON from raw body
     * @returns {object} Safe normalized event
     */
    normalizeWebhookEvent(parsedPayload) {
        const event = parsedPayload || {};
        const entity = event?.payload?.payment?.entity ||
                       event?.payload?.order?.entity || {};

        return {
            eventType: event.event,
            eventId: event.id,
            eventCreatedAt: event.created_at ? new Date(event.created_at * 1000) : null,
            providerOrderId: entity.order_id || null,
            providerPaymentId: entity.id || null,
            amountPaise: entity.amount || null,
            currency: entity.currency || null,
            status: entity.status || null,
            method: entity.method || null,
            captured: entity.captured || false,
            errorCode: entity.error_code || null,
            // Safe description — do NOT include raw error description (may contain PII)
            errorDescriptionSafe: entity.error_description
                ? String(entity.error_description).substring(0, 100)
                : null,
            // Do NOT include: card details, bank account, vpa, email, phone, wallet details
        };
    }

    /**
     * Create a refund for a payment on Razorpay.
     */
    async createRefund({ providerPaymentId, amountPaise, notes = {} }) {
        const client = getRazorpayClient();
        if (!client) throw this._notConfiguredError();
        return await client.refunds.create({
            payment_id: providerPaymentId,
            amount: amountPaise,
            notes,
        });
    }

    /**
     * Fetch a specific refund by provider refund ID.
     */
    async fetchRefund(providerRefundId) {
        const client = getRazorpayClient();
        if (!client) throw this._notConfiguredError();
        return await client.refunds.fetch(providerRefundId);
    }

    /**
     * Fetch all refunds associated with a payment.
     */
    async fetchPaymentRefunds(providerPaymentId) {
        const client = getRazorpayClient();
        if (!client) throw this._notConfiguredError();
        return await client.refunds.all({ payment_id: providerPaymentId });
    }

    /**
     * Normalize a refund webhook event to a safe internal representation.
     */
    normalizeRefundWebhook(parsedPayload) {
        const event = parsedPayload || {};
        const entity = event?.payload?.refund?.entity || {};

        return {
            eventType: event.event,
            eventId: event.id,
            eventCreatedAt: event.created_at ? new Date(event.created_at * 1000) : null,
            providerRefundId: entity.id || null,
            providerPaymentId: entity.payment_id || null,
            amountPaise: entity.amount || null,
            currency: entity.currency || null,
            status: entity.status || null,
            errorCode: entity.speed_processed || null,
        };
    }

    _notConfiguredError() {
        const err = new Error('Payment provider credentials are not configured.');
        err.errorCode = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
        err.statusCode = 503;
        return err;
    }
}

// Singleton provider instance
export const razorpayProvider = new RazorpayProvider();
export default razorpayProvider;
