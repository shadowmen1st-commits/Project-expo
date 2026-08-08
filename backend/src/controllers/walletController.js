import WorkerWallet from '../models/WorkerWallet.js';
import WorkerEarning from '../models/WorkerEarning.js';
import LedgerEntry from '../models/LedgerEntry.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import Notification from '../models/Notification.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import PayoutReservationService from '../services/payments/PayoutReservationService.js';

export const getWalletDetails = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    try {
        // Ensure wallet projection is in sync
        await LedgerPostingService.syncWorkerWallet(user.userId);
        const wallet = await WorkerWallet.findOne({ workerId: user.userId });

        // Retrieve entries for history
        const entries = await LedgerEntry.find({ workerId: user.userId })
            .populate('ledgerTransactionId')
            .sort({ createdAt: -1 });

        const history = entries.map(e => ({
            id: e._id,
            reference: e.ledgerTransactionId?.transactionNumber || 'TXN-UNKNOWN',
            bookingId: e.bookingId,
            amount: e.amountPaise,
            direction: e.direction,
            transactionType: e.ledgerTransactionId?.transactionType || 'UNKNOWN',
            description: e.description,
            createdAt: e.createdAt,
        }));

        res.status(200).json({
            success: true,
            balances: {
                available: wallet?.availableBalancePaise || 0,
                pending: wallet?.pendingBalancePaise || 0,
                reserved: wallet?.reservedBalancePaise || 0,
                totalEarned: wallet?.totalEarnedPaise || 0,
            },
            history,
        });
    }
    catch (error) {
        next(error);
    }
};

export const requestWithdrawal = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'WORKER' && user.role !== 'COMPANY')) {
        res.status(403).json({
            statusCode: 403,
            errorCode: 'FORBIDDEN',
            message: 'Only workers can request withdrawals.',
        });
        return;
    }
    try {
        const { amount, payoutAccountId, preferredMode } = req.body;
        const payout = await PayoutReservationService.createWithdrawalRequest({
            workerId: user.userId,
            payoutAccountId,
            amountPaise: Number(amount),
            preferredMode,
            requestMeta: { actorId: user.userId, requestId: req.requestId },
        });
        res.status(200).json({ success: true, message: 'Withdrawal requested successfully. Pending admin review.', data: payout });
    }
    catch (error) {
        next(error);
    }
};
