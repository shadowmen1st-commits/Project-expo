import mongoose from 'mongoose';
import crypto from 'crypto';
import WorkerPayout from '../../models/WorkerPayout.js';
import WorkerPayoutAccount from '../../models/WorkerPayoutAccount.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import WithdrawalEligibilityService from './WithdrawalEligibilityService.js';
import LedgerPostingService from './LedgerPostingService.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';

const fail = (code, statusCode = 400) => Object.assign(new Error('Withdrawal request could not be completed.'), { errorCode: code, statusCode });

export class PayoutReservationService {
    static async createWithdrawalRequest({ workerId, payoutAccountId, amountPaise, preferredMode, currency = 'INR', idempotencyKey, requestMeta = {} }) {
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.length > 100) throw fail('IDEMPOTENCY_KEY_REQUIRED');
        const internalKey = `PAYOUT_REQ:${workerId}:${idempotencyKey}`;
        const fingerprint = crypto.createHash('sha256').update(`${workerId}:${payoutAccountId}:${amountPaise}:${currency}:${preferredMode || 'IMPS'}`).digest('hex');
        const prior = await WorkerPayout.findOne({ idempotencyKey: internalKey });
        if (prior) {
            if (prior.requestFingerprint !== fingerprint) throw fail('IDEMPOTENCY_CONFLICT', 409);
            return prior;
        }
        const eligibility = await WithdrawalEligibilityService.evaluate({ workerId, amountPaise, payoutAccountId, currency });
        if (!eligibility.allowed) throw Object.assign(fail('ELIGIBILITY_FAILED'), { reasons: eligibility.reasons });
        const account = await WorkerPayoutAccount.findById(payoutAccountId);
        try {
            const payout = await WorkerPayout.create({ payoutNumber: `PAYOUT-${crypto.randomBytes(8).toString('hex').toUpperCase()}`, workerId, payoutAccountId, provider: account.provider, amountPaise, currency, status: 'REQUESTED', source: 'WORKER_REQUEST', mode: preferredMode || 'IMPS', purpose: 'Worker withdrawal', narrationSafe: 'Worker withdrawal request', idempotencyKey: internalKey, requestFingerprint: fingerprint, availableBalanceSnapshotPaise: eligibility.snapshot.availableBalancePaise, reservedBalanceSnapshotPaise: eligibility.snapshot.reservedBalancePaise, feeAmountPaise: 0, taxAmountPaise: 0, netTransferAmountPaise: amountPaise });
            await AuditLog.create({ actor: workerId, action: 'PAYOUT_REQUESTED', resourceType: 'WorkerPayout', resourceId: payout._id.toString(), beforeSnapshot: {}, afterSnapshot: { status: payout.status, amountPaise }, requestId: requestMeta.requestId });
            await Notification.create({ recipientId: workerId, title: 'Withdrawal Requested', message: 'Your withdrawal request has been received.', type: 'INFO', idempotencyKey: `payout-request-${payout._id}` });
            return payout;
        } catch (error) {
            if (error.code === 11000) {
                const raced = await WorkerPayout.findOne({ idempotencyKey: internalKey });
                if (raced?.requestFingerprint === fingerprint) return raced;
                throw fail('IDEMPOTENCY_CONFLICT', 409);
            }
            throw error;
        }
    }

    static async reserveFunds(payout, requestMeta = {}) {
        const session = await mongoose.startSession();
        let result;
        try {
            await session.withTransaction(async () => {
                const current = await WorkerPayout.findOneAndUpdate({ _id: payout._id, status: { $in: ['REQUESTED', 'APPROVED'] } }, { $set: { status: 'RESERVING' } }, { new: true, session });
                if (!current) {
                    const existing = await WorkerPayout.findById(payout._id).session(session);
                    result = { success: false, reason: existing?.status === 'RESERVED' ? 'ALREADY_RESERVED' : 'INVALID_STATUS', payout: existing };
                    return;
                }
                if (requestMeta.failAfter === 'status') throw fail('INJECTED_FAILURE');
                const eligibility = await WithdrawalEligibilityService.evaluate({ workerId: current.workerId, amountPaise: current.amountPaise, payoutAccountId: current.payoutAccountId, currency: current.currency, session });
                if (!eligibility.allowed) throw Object.assign(fail('ELIGIBILITY_FAILED', 409), { reasons: eligibility.reasons });
                const wallet = await WorkerWallet.findOne({ workerId: current.workerId }).session(session);
                if (!wallet || wallet.availableBalancePaise < current.amountPaise) throw fail('INSUFFICIENT_AVAILABLE_BALANCE', 409);
                if (requestMeta.failAfter === 'eligibility') throw fail('INJECTED_FAILURE');
                const ledger = await LedgerPostingService.postTransaction({ transactionType: 'WORKER_PAYOUT_RESERVATION', businessEvent: 'WORKER_PAYOUT_RESERVATION', referenceType: 'WorkerPayout', referenceId: current._id, workerId: current.workerId, idempotencyKey: `PAYOUT_RESERVE:${current._id}`, description: `Reserve funds for payout ${current.payoutNumber}`, entries: [{ code: 'WORKER_EARNINGS_AVAILABLE', ownerType: 'WORKER', ownerId: current.workerId, direction: 'DEBIT', amountPaise: current.amountPaise, description: 'Reserve payout funds' }, { code: 'WORKER_PAYOUT_RESERVED', ownerType: 'WORKER', ownerId: current.workerId, direction: 'CREDIT', amountPaise: current.amountPaise, description: 'Reserve payout funds' }], session, requestId: requestMeta.requestId });
                if (requestMeta.failAfter === 'ledger') throw fail('INJECTED_FAILURE');
                const updated = await WorkerPayout.findByIdAndUpdate(current._id, { status: 'RESERVED', reservedAt: new Date(), ledgerReservationTransactionId: ledger.transaction._id }, { new: true, session });
                if (requestMeta.failAfter === 'payout') throw fail('INJECTED_FAILURE');
                await AuditLog.create([{ actor: requestMeta.actorId || current.workerId, action: 'PAYOUT_RESERVED', resourceType: 'WorkerPayout', resourceId: current._id.toString(), beforeSnapshot: { status: payout.status }, afterSnapshot: { status: 'RESERVED', ledgerReservationTransactionId: ledger.transaction._id.toString() }, requestId: requestMeta.requestId }], { session });
                if (requestMeta.failAfter === 'audit') throw fail('INJECTED_FAILURE');
                result = { success: true, payout: updated };
            });
            return result;
        } finally { await session.endSession(); }
    }
}

export default PayoutReservationService;
