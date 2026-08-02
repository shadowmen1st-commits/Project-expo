/**
 * PaymentProvider — Abstract interface contract.
 *
 * All provider implementations must expose these methods.
 * This file documents the expected interface; it is not enforced at runtime
 * (JavaScript has no abstract classes), but serves as architecture documentation.
 */

export class PaymentProvider {
    /**
     * Validate that required provider credentials are present.
     * Called at application startup.
     * @throws Error with errorCode PAYMENT_PROVIDER_NOT_CONFIGURED if missing.
     */
    validateProviderConfiguration() {
        throw new Error('Not implemented');
    }

    /**
     * Create a new payment order on the provider.
     * @param {object} params
     * @param {number}  params.amountPaise      Amount in integer paise
     * @param {string}  params.currency         ISO 4217 (e.g. 'INR')
     * @param {string}  params.receipt          Safe internal receipt reference
     * @param {object}  [params.notes]          Safe non-sensitive metadata
     * @returns {Promise<object>} Provider order object
     */
    createOrder({ amountPaise, currency, receipt, notes }) {
        throw new Error('Not implemented');
    }

    /**
     * Fetch a provider order by its provider-assigned ID.
     * @param {string} providerOrderId
     * @returns {Promise<object>}
     */
    fetchOrder(providerOrderId) {
        throw new Error('Not implemented');
    }

    /**
     * Fetch a provider payment by its provider-assigned payment ID.
     * @param {string} providerPaymentId
     * @returns {Promise<object>}
     */
    fetchPayment(providerPaymentId) {
        throw new Error('Not implemented');
    }

    /**
     * Verify a Razorpay checkout callback signature.
     * MUST use timing-safe comparison.
     * @param {string} providerOrderId
     * @param {string} providerPaymentId
     * @param {string} signature
     * @returns {boolean}
     */
    verifyCheckoutSignature(providerOrderId, providerPaymentId, signature) {
        throw new Error('Not implemented');
    }

    /**
     * Verify a webhook delivery signature against the raw request body.
     * MUST operate on raw bytes — never JSON.stringify(req.body).
     * MUST use timing-safe comparison.
     * @param {Buffer} rawBody   Exact bytes received from provider
     * @param {string} signature x-razorpay-signature header value
     * @returns {boolean}
     */
    verifyWebhookSignature(rawBody, signature) {
        throw new Error('Not implemented');
    }

    /**
     * Normalize a raw webhook event payload into a safe internal representation.
     * Must strip sensitive fields (card numbers, bank details, raw signatures).
     * @param {object} parsedPayload
     * @returns {object} Safe normalized event
     */
    normalizeWebhookEvent(parsedPayload) {
        throw new Error('Not implemented');
    }
}

export default PaymentProvider;
