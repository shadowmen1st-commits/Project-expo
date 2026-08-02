import WorkerPayout from '../../models/WorkerPayout.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import LedgerTransaction from '../../models/LedgerTransaction.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import LedgerAccount from '../../models/LedgerAccount.js';
import WorkerPayoutAccount from '../../models/WorkerPayoutAccount.js';

export class PayoutReconciliationService {
    static async runReconciliation() {
        const payouts = await WorkerPayout.find().lean();
        const issues = [];
        const duplicateProviders = await WorkerPayout.aggregate([{ $match: { providerPayoutId: { $type: 'string' } } }, { $group: { _id: '$providerPayoutId', count: { $sum: 1 }, ids: { $push: '$_id' } } }, { $match: { count: { $gt: 1 } } }]);
        for (const duplicate of duplicateProviders) issues.push({ providerPayoutId: duplicate._id, issue: 'DUPLICATE_PROVIDER_PAYOUT_ID' });
        for (const payout of payouts) {
            const id = payout._id.toString();
            const reservation = await this._validateJournal(payout.ledgerReservationTransactionId, payout, 'WORKER_EARNINGS_AVAILABLE', 'WORKER_PAYOUT_RESERVED');
            if (['RESERVED', 'PROVIDER_SUBMITTED', 'QUEUED', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(payout.status) && !reservation.exists) issues.push({ payoutId: id, issue: 'MISSING_RESERVATION_LEDGER' });
            for (const issue of reservation.issues) issues.push({ payoutId: id, issue });
            const reserveCount = await LedgerTransaction.countDocuments({ idempotencyKey: `PAYOUT_RESERVE:${payout._id}` });
            if (reserveCount > 1) issues.push({ payoutId: id, issue: 'DUPLICATE_RESERVATION' });
            const terminalMap = { PROCESSED: ['ledgerProcessedTransactionId', 'MISSING_PROCESSED_LEDGER'], FAILED: ['ledgerFailureReleaseTransactionId', 'MISSING_FAILURE_RELEASE_LEDGER'], REVERSED: ['ledgerReversalTransactionId', 'MISSING_REVERSAL_LEDGER'], CANCELLED: ['ledgerCancellationTransactionId', 'MISSING_CANCELLATION_LEDGER'] };
            const expected = terminalMap[payout.status]; if (expected && !payout[expected[0]]) issues.push({ payoutId: id, issue: expected[1] });
            const account = await WorkerPayoutAccount.findById(payout.payoutAccountId).lean();
            if (account && account.status !== 'ACTIVE' && !['FAILED', 'CANCELLED', 'REJECTED'].includes(payout.status)) issues.push({ payoutId: id, issue: 'PAYOUT_TO_DISABLED_ACCOUNT' });
            if (payout.status === 'PROCESSED' && payout.providerStatus && payout.providerStatus !== 'processed') issues.push({ payoutId: id, issue: 'INTERNAL_PROCESSED_PROVIDER_NON_TERMINAL' });
            if (['PROVIDER_SUBMITTED', 'QUEUED', 'PENDING', 'PROCESSING'].includes(payout.status) && payout.providerStatus === 'processed') issues.push({ payoutId: id, issue: 'PROVIDER_PROCESSED_INTERNAL_PROCESSING' });
        }
        const workers = [...new Set(payouts.map(p => p.workerId.toString()))];
        for (const workerId of workers) {
            const wallet = await WorkerWallet.findOne({ workerId }).lean();
            const accounts = await LedgerAccount.find({ ownerType: 'WORKER', ownerId: workerId, code: { $in: ['WORKER_EARNINGS_PENDING', 'WORKER_EARNINGS_AVAILABLE', 'WORKER_PAYOUT_RESERVED', 'WORKER_EARNINGS_FROZEN'] } }).lean();
            const byCode = Object.fromEntries(accounts.map(a => [a.code, Math.max(0, a.cachedBalancePaise)]));
            if (!wallet || wallet.pendingBalancePaise !== (byCode.WORKER_EARNINGS_PENDING || 0) || wallet.availableBalancePaise !== (byCode.WORKER_EARNINGS_AVAILABLE || 0) || wallet.reservedBalancePaise !== (byCode.WORKER_PAYOUT_RESERVED || 0) || wallet.frozenBalancePaise !== (byCode.WORKER_EARNINGS_FROZEN || 0)) issues.push({ workerId, issue: 'WALLET_PROJECTION_MISMATCH' });
        }
        return { readOnly: true, summary: { payoutCount: payouts.length, processedCount: payouts.filter(p => p.status === 'PROCESSED').length, issueCount: issues.length }, issues };
    }
    static async _validateJournal(transactionId, payout, debitCode, creditCode) {
        if (!transactionId) return { exists: false, issues: [] };
        const tx = await LedgerTransaction.findById(transactionId).lean(); if (!tx) return { exists: false, issues: [] };
        const entries = await LedgerEntry.find({ ledgerTransactionId: tx._id }).populate('accountId').lean();
        const issues = [];
        if (tx.totalDebitPaise !== tx.totalCreditPaise) issues.push('UNBALANCED_JOURNAL');
        if (tx.totalDebitPaise !== payout.amountPaise) issues.push('AMOUNT_MISMATCH');
        if (tx.currency !== payout.currency || entries.some(e => e.currency !== payout.currency)) issues.push('CURRENCY_MISMATCH');
        if (!entries.some(e => e.direction === 'DEBIT' && e.accountId?.code === debitCode) || !entries.some(e => e.direction === 'CREDIT' && e.accountId?.code === creditCode)) issues.push('FUND_ACCOUNT_MISMATCH');
        return { exists: true, issues };
    }
}
export default PayoutReconciliationService;
