import LedgerAccount from '../models/LedgerAccount.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import WorkerWallet from '../models/WorkerWallet.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import LedgerReconciliationService from '../services/payments/LedgerReconciliationService.js';

export const getLedgerAccounts = async (req, res, next) => {
    try {
        const accounts = await LedgerAccount.find().sort({ code: 1 });
        res.status(200).json({ success: true, accounts });
    } catch (error) {
        next(error);
    }
};

export const getLedgerTransactions = async (req, res, next) => {
    try {
        const transactions = await LedgerTransaction.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, transactions });
    } catch (error) {
        next(error);
    }
};

export const reconcileWorkerWallet = async (req, res, next) => {
    const { workerId } = req.params;
    try {
        const reconciliation = await LedgerReconciliationService.reconcileWorkerWallet(workerId);
        res.status(200).json({ success: true, reconciliation });
    } catch (error) {
        next(error);
    }
};

export const reconcileAllWallets = async (req, res, next) => {
    try {
        const wallets = await WorkerWallet.find();
        const results = [];
        for (const w of wallets) {
            const recon = await LedgerReconciliationService.reconcileWorkerWallet(w.workerId);
            results.push({ workerId: w.workerId, reconciled: recon.reconciled, status: recon.walletStatus });
        }
        res.status(200).json({ success: true, results });
    } catch (error) {
        next(error);
    }
};

export const reverseLedgerTransaction = async (req, res, next) => {
    const { transactionId } = req.params;
    const { reason } = req.body;
    if (!reason) {
        res.status(400).json({ success: false, message: 'Reason for reversal is required.' });
        return;
    }
    try {
        const transaction = await LedgerTransaction.findById(transactionId);
        if (!transaction) {
            res.status(404).json({ success: false, message: 'Transaction not found.' });
            return;
        }

        const actor = { userId: req.user.userId, role: req.user.role };
        const requestMeta = {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.headers['x-request-id'] || '',
        };

        const result = await LedgerPostingService.postReversal(transaction, reason, actor, requestMeta);
        res.status(200).json({ success: true, transaction: result.transaction });
    } catch (error) {
        next(error);
    }
};

export const postManualJournalEntry = async (req, res, next) => {
    const { businessEvent, description, entries } = req.body;
    if (!businessEvent || !entries || !Array.isArray(entries)) {
        res.status(400).json({ success: false, message: 'Invalid journal entry body.' });
        return;
    }
    try {
        const actor = { userId: req.user.userId, role: req.user.role };
        const requestMeta = {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.headers['x-request-id'] || '',
        };

        // Validate admin auth already done by route middleware
        const result = await LedgerPostingService.postTransaction({
            transactionType: 'ADMIN_CORRECTIVE_JOURNAL',
            businessEvent,
            idempotencyKey: `MANUAL-JOURNAL-${Date.now()}-${Math.random()}`,
            description,
            entries,
            postedByType: 'ADMIN',
            postedById: actor.userId,
            ...requestMeta,
        });

        res.status(200).json({ success: true, transaction: result.transaction });
    } catch (error) {
        next(error);
    }
};
