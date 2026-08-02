import LedgerAccount from '../../models/LedgerAccount.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import LedgerPostingService from './LedgerPostingService.js';
import mongoose from 'mongoose';

export class LedgerReconciliationService {
    /**
     * Reconcile a single worker's wallet cache against raw ledger entries.
     */
    static async reconcileWorkerWallet(workerId) {
        // Resolve accounts first to ensure they exist
        const pendingAccount = await LedgerPostingService.resolveAccount('WORKER_EARNINGS_PENDING', 'WORKER', workerId, 'INR');
        const availableAccount = await LedgerPostingService.resolveAccount('WORKER_EARNINGS_AVAILABLE', 'WORKER', workerId, 'INR');
        const reservedAccount = await LedgerPostingService.resolveAccount('WORKER_PAYOUT_RESERVED', 'WORKER', workerId, 'INR');

        // Fetch cumulative sums from LedgerEntry
        const calculateBalance = async (accountId) => {
            const result = await LedgerEntry.aggregate([
                { $match: { accountId: new mongoose.Types.ObjectId(accountId) } },
                {
                    $group: {
                        _id: null,
                        totalDebit: {
                            $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amountPaise', 0] }
                        },
                        totalCredit: {
                            $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amountPaise', 0] }
                        }
                    }
                }
            ]);
            if (result.length === 0) return 0;
            // Normal balance is CREDIT
            return Math.max(0, result[0].totalCredit - result[0].totalDebit);
        };

        const computedPending = await calculateBalance(pendingAccount._id);
        const computedAvailable = await calculateBalance(availableAccount._id);
        const computedReserved = await calculateBalance(reservedAccount._id);

        // Compute total earned
        const pendingCreditsRes = await LedgerEntry.aggregate([
            { $match: { accountId: pendingAccount._id, direction: 'CREDIT' } },
            { $group: { _id: null, total: { $sum: '$amountPaise' } } }
        ]);
        const pendingCredits = pendingCreditsRes[0]?.total || 0;

        const totalEarned = pendingCredits;

        // Fetch current cached wallet
        const wallet = await WorkerWallet.findOne({ workerId });
        if (!wallet) {
            // If no wallet exists yet, create it in reconciled state
            const newWallet = new WorkerWallet({
                workerId,
                pendingBalancePaise: computedPending,
                availableBalancePaise: computedAvailable,
                reservedBalancePaise: computedReserved,
                totalEarnedPaise: totalEarned,
                lastReconciledAt: new Date(),
                reconciliationStatus: 'RECONCILED',
            });
            await newWallet.save();
            return {
                reconciled: true,
                walletStatus: 'RECONCILED',
                cached: { pending: 0, available: 0, reserved: 0, totalEarned: 0 },
                computed: { pending: computedPending, available: computedAvailable, reserved: computedReserved, totalEarned }
            };
        }

        const isMatch =
            wallet.pendingBalancePaise === computedPending &&
            wallet.availableBalancePaise === computedAvailable &&
            wallet.reservedBalancePaise === computedReserved &&
            wallet.totalEarnedPaise === totalEarned;

        const status = isMatch ? 'RECONCILED' : 'MISMATCH';

        wallet.reconciliationStatus = status;
        wallet.lastReconciledAt = new Date();
        
        // Auto-fix options could be implemented, but we report first
        if (!isMatch) {
            // Set mismatched balances to alert admins
            wallet.reconciliationStatus = 'MISMATCH';
        } else {
            // Keep in sync
            wallet.pendingBalancePaise = computedPending;
            wallet.availableBalancePaise = computedAvailable;
            wallet.reservedBalancePaise = computedReserved;
            wallet.totalEarnedPaise = totalEarned;
        }

        await wallet.save();

        return {
            reconciled: isMatch,
            walletStatus: status,
            cached: {
                pending: wallet.pendingBalancePaise,
                available: wallet.availableBalancePaise,
                reserved: wallet.reservedBalancePaise,
                totalEarned: wallet.totalEarnedPaise,
            },
            computed: {
                pending: computedPending,
                available: computedAvailable,
                reserved: computedReserved,
                totalEarned,
            }
        };
    }
}

export default LedgerReconciliationService;
