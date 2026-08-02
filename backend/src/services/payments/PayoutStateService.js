import mongoose from 'mongoose';
import WorkerPayout from '../../models/WorkerPayout.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import LedgerPostingService from './LedgerPostingService.js';
import Notification from '../../models/Notification.js';
import AuditLog from '../../models/AuditLog.js';

const allowed = { REQUESTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['APPROVED', 'REJECTED'], APPROVED: ['RESERVING', 'REJECTED'], RESERVING: ['RESERVED'], RESERVED: ['PROVIDER_SUBMITTED'], PROVIDER_SUBMITTED: ['QUEUED', 'PENDING', 'PROCESSING', 'FAILED', 'CANCELLED', 'PROCESSED'], QUEUED: ['PENDING', 'PROCESSING', 'CANCELLED', 'FAILED', 'PROCESSED'], PENDING: ['PROCESSING', 'FAILED', 'CANCELLED', 'PROCESSED'], PROCESSING: ['PROCESSED', 'FAILED', 'MANUAL_REVIEW'], PROCESSED: ['REVERSED'], FAILED: ['MANUAL_REVIEW'], CANCELLED: [], REJECTED: [], REVERSED: [], MANUAL_REVIEW: ['PROCESSED', 'FAILED'] };
const terminal = new Set(['PROCESSED', 'FAILED', 'REVERSED', 'CANCELLED']);

export class PayoutStateService {
    static async transition(payout, targetStatus, requestMeta = {}) {
        const session = await mongoose.startSession();
        let response;
        try {
            await session.withTransaction(async () => {
                const current = await WorkerPayout.findById(payout._id).session(session);
                if (!current) { response = { success: false, reason: 'NOT_FOUND' }; return; }
                if (current.status === targetStatus) { response = { success: true, payout: current, reason: 'ALREADY_IN_TARGET_STATE' }; return; }
                if (!allowed[current.status]?.includes(targetStatus)) { response = { success: false, reason: 'INVALID_TRANSITION', payout: current }; return; }
                if (terminal.has(targetStatus) && !requestMeta.providerVerified) { response = { success: false, reason: 'PROVIDER_VERIFICATION_REQUIRED', payout: current }; return; }
                const update = { status: targetStatus, providerStatus: requestMeta.providerStatus || targetStatus.toLowerCase(), reviewedAt: new Date() };
                let ledger;
                if (targetStatus === 'APPROVED') update.approvedAt = new Date();
                if (targetStatus === 'PROCESSED') {
                    if (!current.providerPayoutId || requestMeta.providerPayoutId !== current.providerPayoutId || requestMeta.amountPaise !== current.amountPaise || requestMeta.currency !== current.currency) { response = { success: false, reason: 'PROVIDER_FACT_MISMATCH', payout: current }; return; }
                    ledger = await this._post(current, session, 'WORKER_PAYOUT_RELEASE', `PAYOUT_PROCESSED:${current.providerPayoutId}`, 'WORKER_PAYOUT_RESERVED', 'PAYMENT_GATEWAY_CLEARING', current.ledgerProcessedTransactionId);
                    update.processedAt = new Date(); update.ledgerProcessedTransactionId = ledger.transaction._id;
                    await WorkerWallet.findOneAndUpdate({ workerId: current.workerId }, { $inc: { totalWithdrawnPaise: current.amountPaise } }, { session });
                } else if (targetStatus === 'FAILED') {
                    ledger = await this._post(current, session, 'WORKER_PAYOUT_FAILED_RELEASE', `PAYOUT_FAILED:${current.providerPayoutId || current._id}`, 'WORKER_PAYOUT_RESERVED', 'WORKER_EARNINGS_AVAILABLE', current.ledgerFailureReleaseTransactionId);
                    update.failedAt = new Date(); update.ledgerFailureReleaseTransactionId = ledger.transaction._id; update.failureDescriptionSafe = String(requestMeta.failureReason || 'Provider reported payout failure').slice(0, 200);
                } else if (targetStatus === 'CANCELLED') {
                    if (!requestMeta.providerCancellable) { response = { success: false, reason: 'PROVIDER_CANCELLATION_NOT_CONFIRMED', payout: current }; return; }
                    ledger = await this._post(current, session, 'WORKER_PAYOUT_CANCELLATION', `PAYOUT_CANCELLED:${current.providerPayoutId || current._id}`, 'WORKER_PAYOUT_RESERVED', 'WORKER_EARNINGS_AVAILABLE', current.ledgerCancellationTransactionId);
                    update.cancelledAt = new Date(); update.ledgerCancellationTransactionId = ledger.transaction._id;
                } else if (targetStatus === 'REVERSED') {
                    if (!current.ledgerProcessedTransactionId) { response = { success: false, reason: 'PROCESSED_LEDGER_REQUIRED', payout: current }; return; }
                    ledger = await this._post(current, session, 'WORKER_PAYOUT_REVERSAL', `PAYOUT_REVERSED:${current.providerPayoutId}`, 'PAYMENT_GATEWAY_CLEARING', 'WORKER_EARNINGS_AVAILABLE', current.ledgerReversalTransactionId, current.ledgerProcessedTransactionId);
                    update.reversedAt = new Date(); update.ledgerReversalTransactionId = ledger.transaction._id;
                    await WorkerWallet.findOneAndUpdate({ workerId: current.workerId, totalWithdrawnPaise: { $gte: current.amountPaise } }, { $inc: { totalWithdrawnPaise: -current.amountPaise } }, { session });
                } else if (targetStatus === 'PROCESSING') update.processingAt = new Date();
                const updated = await WorkerPayout.findOneAndUpdate({ _id: current._id, status: current.status }, update, { new: true, session });
                if (!updated) throw Object.assign(new Error('Concurrent payout transition.'), { errorCode: 'PAYOUT_STATE_CONFLICT' });
                await AuditLog.create([{ actor: requestMeta.actorId || current.workerId, action: `PAYOUT_${targetStatus}`, resourceType: 'WorkerPayout', resourceId: current._id.toString(), beforeSnapshot: { status: current.status }, afterSnapshot: { status: targetStatus }, requestId: requestMeta.requestId }], { session });
                if (terminal.has(targetStatus)) await Notification.create([{ recipientId: current.workerId, title: `Payout ${targetStatus.toLowerCase()}`, message: targetStatus === 'FAILED' ? 'Your payout failed and reserved funds were restored.' : `Your payout is ${targetStatus.toLowerCase()}.`, type: targetStatus === 'PROCESSED' ? 'SUCCESS' : 'INFO', idempotencyKey: `payout-${targetStatus.toLowerCase()}-${current._id}` }], { session });
                response = { success: true, payout: updated };
            });
            return response;
        } finally { await session.endSession(); }
    }

    static async _post(payout, session, type, key, debitCode, creditCode, existingId, reversalOfTransactionId) {
        if (existingId) return { transaction: { _id: existingId }, alreadyProcessed: true };
        return LedgerPostingService.postTransaction({ transactionType: type, businessEvent: type, referenceType: 'WorkerPayout', referenceId: payout._id, workerId: payout.workerId, idempotencyKey: key, reversalOfTransactionId, description: `${type} for ${payout.payoutNumber}`, entries: [{ code: debitCode, ownerType: debitCode.startsWith('WORKER_') ? 'WORKER' : 'SYSTEM', ownerId: debitCode.startsWith('WORKER_') ? payout.workerId : undefined, direction: 'DEBIT', amountPaise: payout.amountPaise }, { code: creditCode, ownerType: creditCode.startsWith('WORKER_') ? 'WORKER' : 'SYSTEM', ownerId: creditCode.startsWith('WORKER_') ? payout.workerId : undefined, direction: 'CREDIT', amountPaise: payout.amountPaise }], session });
    }
}

export default PayoutStateService;
