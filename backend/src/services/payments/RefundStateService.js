import Refund from '../../models/Refund.js';

export class RefundStateService {
    static ALLOWED_TRANSITIONS = {
        'REQUESTED': ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
        'UNDER_REVIEW': ['APPROVED', 'REJECTED'],
        'APPROVED': ['PROCESSING', 'PROCESSED', 'CANCELLED'],
        'PROCESSING': ['PROVIDER_SUBMITTED', 'PROCESSED', 'FAILED'],
        'PROVIDER_SUBMITTED': ['PROCESSED', 'FAILED'],
        'FAILED': ['PROCESSING', 'CANCELLED'],
        'PROCESSED': [],
        'REJECTED': [],
        'CANCELLED': [],
    };

    /**
     * Transition a Refund record to a new status securely.
     */
    static async transitionStatus(refundId, nextStatus, updates = {}, requestMeta = {}) {
        const session = requestMeta.session || null;
        let query = Refund.findById(refundId);
        if (session) {
            query = query.session(session);
        }
        const refund = await query;
        if (!refund) throw new Error('Refund record not found.');

        const currentStatus = refund.status;
        const allowed = this.ALLOWED_TRANSITIONS[currentStatus] || [];

        if (!allowed.includes(nextStatus)) {
            const err = new Error(`Invalid refund state transition from ${currentStatus} to ${nextStatus}.`);
            err.statusCode = 400;
            throw err;
        }

        // Apply state updates
        refund.status = nextStatus;
        Object.assign(refund, updates);
        
        if (nextStatus === 'APPROVED') refund.approvedAt = new Date();
        if (nextStatus === 'PROVIDER_SUBMITTED') refund.providerSubmittedAt = new Date();
        if (nextStatus === 'PROCESSED') refund.processedAt = new Date();
        if (nextStatus === 'FAILED') refund.failedAt = new Date();
        if (nextStatus === 'CANCELLED') refund.cancelledAt = new Date();

        await refund.save({ session });
        return refund;
    }
}

export default RefundStateService;
