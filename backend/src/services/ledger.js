import { WalletLedger } from '../models/WalletLedger.js';
import crypto from 'crypto';
export const recordTransaction = async (params) => {
    const { userId, bookingId, debitAccount, creditAccount, amount, transactionType, idempotencyKey, auditReference, status = 'PENDING', metadata, } = params;
    // 1. Idempotency Check: check if transaction with key already exists
    const existing = await WalletLedger.findOne({ idempotencyKey });
    if (existing) {
        return existing;
    }
    // 2. Generate unique reference
    const reference = `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    // 3. Create ledger entry
    const newEntry = new WalletLedger({
        reference,
        bookingId,
        userId,
        debitAccount,
        creditAccount,
        amount,
        transactionType,
        status,
        idempotencyKey,
        auditReference,
        metadata,
    });
    await newEntry.save();
    return newEntry;
};
export const getWalletBalances = async (userId) => {
    // Fetch all transactions for this user
    const txns = await WalletLedger.find({ userId });
    let availableCredits = 0;
    let availableDebits = 0;
    let pendingCredits = 0;
    let reservedDebits = 0;
    let totalEarned = 0;
    let totalWithdrawn = 0;
    for (const t of txns) {
        const isCredit = t.creditAccount === 'USER_WALLET';
        const isDebit = t.debitAccount === 'USER_WALLET';
        if (t.status === 'COMPLETED') {
            if (isCredit) {
                availableCredits += t.amount;
                if (t.transactionType === 'EARNING') {
                    totalEarned += t.amount;
                }
            }
            if (isDebit) {
                availableDebits += t.amount;
                if (t.transactionType === 'WITHDRAWAL') {
                    totalWithdrawn += t.amount;
                }
            }
        }
        else if (t.status === 'PENDING') {
            if (isCredit) {
                pendingCredits += t.amount;
            }
            if (isDebit) {
                reservedDebits += t.amount;
            }
        }
    }
    return {
        available: Math.max(0, availableCredits - availableDebits - reservedDebits), // available is net completed minus what's reserved/withdrawn
        pending: pendingCredits,
        reserved: reservedDebits,
        totalEarned,
        totalWithdrawn,
    };
};
