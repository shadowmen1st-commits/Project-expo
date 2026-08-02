import crypto from 'crypto';
import WorkerPayout from '../../models/WorkerPayout.js';
import WebhookEvent from '../../models/WebhookEvent.js';
import PayoutStateService from './PayoutStateService.js';

const stateMap = { queued: 'QUEUED', pending: 'PENDING', processing: 'PROCESSING', processed: 'PROCESSED', failed: 'FAILED', reversed: 'REVERSED', cancelled: 'CANCELLED' };
const safeEqual = (a, b) => { const x = Buffer.from(a || '', 'utf8'); const y = Buffer.from(b || '', 'utf8'); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export class PayoutWebhookService {
    static sign(rawBody, secret) { return crypto.createHmac('sha256', secret).update(rawBody).digest('hex'); }
    static async handleWebhook({ rawBody, signature, requestId, serverSecret, maxBytes = 102400 }) {
        if (!Buffer.isBuffer(rawBody)) return { accepted: false, reason: 'RAW_BODY_REQUIRED' };
        if (rawBody.length > maxBytes) return { accepted: false, reason: 'PAYLOAD_TOO_LARGE' };
        if (!signature) return { accepted: false, reason: 'SIGNATURE_REQUIRED' };
        const expected = this.sign(rawBody, serverSecret || '');
        if (!safeEqual(signature, expected)) return { accepted: false, reason: 'INVALID_SIGNATURE' };
        let payload;
        try { payload = JSON.parse(rawBody.toString('utf8')); } catch { return { accepted: false, reason: 'MALFORMED_JSON' }; }
        const entity = payload?.payload?.payout?.entity || payload?.payload?.payout || {};
        const providerPayoutId = entity.id;
        const eventType = payload.event || `payout.${entity.status || 'unknown'}`;
        const providerEventId = payload.id || `derived:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
        const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        let event;
        try {
            event = await WebhookEvent.create({ provider: 'razorpay', providerEventId, eventType, payloadHash, signatureHash: crypto.createHash('sha256').update(signature).digest('hex'), signatureVerified: true, processingStatus: 'PROCESSING', normalizedPayload: { eventType, providerPayoutId, amountPaise: entity.amount, currency: entity.currency, status: entity.status } });
        } catch (error) {
            if (error.code === 11000) return { accepted: true, deduplicated: true, reason: 'DUPLICATE_WEBHOOK' };
            throw error;
        }
        const statusName = String(entity.status || eventType.split('.').pop()).toLowerCase();
        const target = stateMap[statusName];
        if (!target) { await WebhookEvent.findByIdAndUpdate(event._id, { processingStatus: 'IGNORED', processedAt: new Date() }); return { accepted: true, ignored: true, eventId: event._id }; }
        const payout = await WorkerPayout.findOne({ providerPayoutId });
        if (!payout) { await WebhookEvent.findByIdAndUpdate(event._id, { processingStatus: 'IGNORED', processedAt: new Date() }); return { accepted: true, reason: 'UNKNOWN_PAYOUT', eventId: event._id }; }
        const result = await PayoutStateService.transition(payout, target, { requestId, actorId: payout.workerId, providerVerified: true, providerPayoutId, amountPaise: entity.amount, currency: entity.currency || 'INR', providerStatus: statusName, providerCancellable: target === 'CANCELLED', failureReason: entity.failure_reason || entity.error_description });
        await WebhookEvent.findByIdAndUpdate(event._id, { processingStatus: result.success ? 'PROCESSED' : 'FAILED', processedAt: new Date(), errorCode: result.success ? undefined : result.reason, errorMessageSafe: result.success ? undefined : 'Payout event could not be applied.' });
        return { accepted: true, eventId: event._id, payout, result };
    }
}

export default PayoutWebhookService;
