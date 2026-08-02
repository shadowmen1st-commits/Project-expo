import mongoose from 'mongoose';
import crypto from 'crypto';
import LedgerAccount from '../../models/LedgerAccount.js';
import LedgerTransaction from '../../models/LedgerTransaction.js';
import LedgerEntry from '../../models/LedgerEntry.js';
import WorkerEarning from '../../models/WorkerEarning.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';
import Booking from '../../models/Booking.js';
import config from '../../config/env.js';

// Helper to determine if we can use MongoDB Transactions in current env
let isTransactionSupported = null;
async function checkTransactionSupport() {
    if (isTransactionSupported !== null) return isTransactionSupported;
    try {
        const session = await mongoose.startSession();
        session.startTransaction();
        // Execute a database query with session to force verification on the MongoDB server
        await LedgerAccount.findOne({}).session(session);
        await session.abortTransaction();
        session.endSession();
        isTransactionSupported = true;
    } catch (e) {
        isTransactionSupported = false;
        if (process.env.NODE_ENV === 'test') {
            throw new Error(`Transaction-capable MongoDB is required for financial tests: ${e.message}`, { cause: e });
        }
        console.warn('⚠️ WARNING: MongoDB Transaction support is not available on this deployment. Falling back to non-transactional execution (durable sequential writes with idempotency).');
    }
    return isTransactionSupported;
}

export class LedgerPostingService {
    /**
     * Resolve or create a LedgerAccount deterministically.
     */
    static async resolveAccount(code, ownerType, ownerId = null, currency = 'INR', session = null) {
        const query = { code, ownerType, ownerId: ownerId || null, currency };
        let account = await LedgerAccount.findOne(query).session(session);
        if (!account) {
            // Generate deterministic unique account number
            const hashSource = `${code}::${ownerType}::${ownerId ? ownerId.toString() : 'SYSTEM'}::${currency}`;
            const accountNumber = crypto.createHash('md5').update(hashSource).digest('hex').substring(0, 16).toUpperCase();
            
            // Determine account type and normal balance
            let accountType = 'LIABILITY';
            let normalBalance = 'CREDIT';

            if (code === 'PAYMENT_GATEWAY_RECEIVABLE' || code === 'PAYMENT_GATEWAY_CLEARING') {
                accountType = 'ASSET';
                normalBalance = 'DEBIT';
            } else if (
                code === 'PLATFORM_FUNDED_DISCOUNT_EXPENSE' ||
                code === 'REVERSAL_ADJUSTMENT' ||
                code === 'PLATFORM_REFUND_EXPENSE' ||
                code === 'DISPUTE_COMPENSATION_EXPENSE'
            ) {
                accountType = 'EXPENSE';
                normalBalance = 'DEBIT';
            } else if (code === 'PLATFORM_COMMISSION_REVENUE' || code === 'CUSTOMER_PLATFORM_FEE_REVENUE') {
                accountType = 'REVENUE';
                normalBalance = 'CREDIT';
            }

            const name = `${code.replace(/_/g, ' ')} (${ownerType})`;
            
            account = new LedgerAccount({
                accountNumber,
                code,
                name,
                description: `System resolved account for ${code}`,
                accountType,
                normalBalance,
                ownerType,
                ownerId: ownerId || undefined,
                currency,
                status: 'ACTIVE',
                systemManaged: true,
            });
            await account.save({ session });
        }
        return account;
    }

    /**
     * Post a raw balanced ledger transaction.
     */
    static async postTransaction({
        transactionType,
        businessEvent,
        referenceType,
        referenceId,
        bookingId,
        paymentOrderId,
        paymentTransactionId,
        workerId,
        customerId,
        idempotencyKey,
        reversalOfTransactionId,
        description,
        entries, // Array of { code, ownerType, ownerId, direction, amountPaise, description }
        postedByType = 'SYSTEM',
        postedById = null,
        requestId = '',
        ipAddress = '',
        userAgent = '',
        session = null,
    }) {
        // 1. Enforce unique idempotencyKey
        const existingTx = await LedgerTransaction.findOne({ idempotencyKey }).session(session);
        if (existingTx) {
            return { transaction: existingTx, alreadyProcessed: true };
        }

        // 2. Validate entry values and match debits/credits
        let totalDebit = 0;
        let totalCredit = 0;
        const processedEntries = [];
        
        for (const entry of entries) {
            const { amountPaise, direction } = entry;
            if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
                const err = new Error('Amount must be a positive safe integer paise.');
                err.statusCode = 400;
                err.errorCode = 'INVALID_AMOUNT';
                throw err;
            }
            if (direction === 'DEBIT') {
                totalDebit += amountPaise;
            } else if (direction === 'CREDIT') {
                totalCredit += amountPaise;
            } else {
                const err = new Error('Invalid entry direction.');
                err.statusCode = 400;
                err.errorCode = 'INVALID_DIRECTION';
                throw err;
            }
        }

        if (totalDebit !== totalCredit) {
            const err = new Error('Unbalanced transaction: sum of DEBITS must equal sum of CREDITS.');
            err.statusCode = 400;
            err.errorCode = 'TRANSACTION_UNBALANCED';
            throw err;
        }

        const transactionNumber = `TXN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const hasTxSupport = await checkTransactionSupport();
        const shouldUseTransactions = hasTxSupport;
        
        const executePosting = async (session) => {
            // Save transaction in DRAFT/POSTING state first
            const transaction = new LedgerTransaction({
                transactionNumber,
                transactionType,
                status: 'POSTING',
                currency: 'INR',
                businessEvent,
                referenceType,
                referenceId,
                bookingId,
                paymentOrderId,
                paymentTransactionId,
                workerId,
                customerId,
                idempotencyKey,
                reversalOfTransactionId,
                totalDebitPaise: totalDebit,
                totalCreditPaise: totalCredit,
                description,
                postedByType,
                postedById,
                requestId,
            });
            await transaction.save({ session });

            let lineNum = 1;
            for (const entry of entries) {
                const account = await LedgerPostingService.resolveAccount(
                    entry.code,
                    entry.ownerType,
                    entry.ownerId,
                    'INR',
                    session
                );

                if (account.status === 'FROZEN') {
                    const err = new Error(`Cannot post to frozen account: ${account.accountNumber}`);
                    err.statusCode = 400;
                    err.errorCode = 'ACCOUNT_FROZEN';
                    throw err;
                }

                // Balance before and after projection calculations
                const balanceBefore = account.cachedBalancePaise;
                let balanceAfter = balanceBefore;
                const change = entry.amountPaise;

                if (account.normalBalance === 'DEBIT') {
                    balanceAfter = entry.direction === 'DEBIT' ? balanceBefore + change : balanceBefore - change;
                } else {
                    balanceAfter = entry.direction === 'CREDIT' ? balanceBefore + change : balanceBefore - change;
                }

                // Update account balances
                const updateQuery = {};
                if (entry.direction === 'DEBIT') {
                    updateQuery.$inc = { cachedDebitTotalPaise: change, cachedBalancePaise: account.normalBalance === 'DEBIT' ? change : -change };
                } else {
                    updateQuery.$inc = { cachedCreditTotalPaise: change, cachedBalancePaise: account.normalBalance === 'CREDIT' ? change : -change };
                }
                updateQuery.lastPostedAt = new Date();

                await LedgerAccount.findByIdAndUpdate(account._id, updateQuery, { session });

                const ledgerEntry = new LedgerEntry({
                    ledgerTransactionId: transaction._id,
                    lineNumber: lineNum++,
                    accountId: account._id,
                    direction: entry.direction,
                    amountPaise: change,
                    currency: 'INR',
                    bookingId,
                    workerId: entry.ownerType === 'WORKER' ? entry.ownerId : undefined,
                    customerId: entry.ownerType === 'CUSTOMER' ? entry.ownerId : undefined,
                    balanceBeforePaise: balanceBefore,
                    balanceAfterPaise: balanceAfter,
                    description: entry.description || description,
                    effectiveAt: transaction.effectiveAt,
                });
                await ledgerEntry.save({ session });
                processedEntries.push(ledgerEntry);
            }

            // Update transaction to POSTED
            transaction.status = 'POSTED';
            transaction.postedAt = new Date();
            await transaction.save({ session });

            // Trigger worker wallet projection update if applicable
            if (workerId) {
                await LedgerPostingService.syncWorkerWallet(workerId, session);
            }

            return { transaction, entries: processedEntries, alreadyProcessed: false };
        };

        if (session) {
            return await executePosting(session);
        } else if (shouldUseTransactions) {
            const dbSession = await mongoose.startSession();
            try {
                dbSession.startTransaction();
                const res = await executePosting(dbSession);
                await dbSession.commitTransaction();
                return res;
            } catch (err) {
                if (dbSession.inTransaction()) {
                    await dbSession.abortTransaction();
                }
                throw err;
            } finally {
                dbSession.endSession();
            }
        } else {
            // Fallback non-transactional
            return await executePosting(null);
        }
    }

    /**
     * Post PAYMENT_CAPTURED funding transaction.
     */
    static async postPaymentCaptured(booking, paymentOrderId, paymentTransactionId, providerPaymentId, requestMeta = {}) {
        const amountPaise = booking.pricingSnapshot?.customerTotalPaise || booking.totalAmount;
        const idempotencyKey = `PAYMENT_CAPTURED:${providerPaymentId}`;

        const entries = [
            {
                code: 'PAYMENT_GATEWAY_RECEIVABLE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise,
                description: `Razorpay Payment Gateway Receivable for booking ${booking.bookingNumber}`,
            },
            {
                code: 'CUSTOMER_FUNDS_HELD',
                ownerType: 'SYSTEM',
                direction: 'CREDIT',
                amountPaise,
                description: `Customer funds held internally for booking ${booking.bookingNumber}`,
            }
        ];

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'PAYMENT_CAPTURED',
            businessEvent: 'PAYMENT_CAPTURED',
            referenceType: 'PaymentTransaction',
            referenceId: paymentTransactionId,
            bookingId: booking._id,
            paymentOrderId,
            paymentTransactionId,
            customerId: booking.customerId,
            idempotencyKey,
            description: `Payment captured for booking ${booking.bookingNumber}`,
            entries,
            ...requestMeta,
        });

        if (!res.alreadyProcessed) {
            await AuditLog.create({
                actor: requestMeta.actorId || booking.customerId.toString(),
                action: 'LEDGER_PAYMENT_CAPTURED_POSTED',
                resourceType: 'Booking',
                resourceId: booking._id.toString(),
                beforeSnapshot: { escrowStatus: 'NOT_FUNDED' },
                afterSnapshot: { escrowStatus: 'HELD', ledgerTransactionId: res.transaction._id.toString() },
                requestId: requestMeta.requestId,
                ipAddress: requestMeta.ipAddress,
                userAgent: requestMeta.userAgent,
            });
        }
        return res;
    }

    /**
     * Post BOOKING_COMPLETION_ALLOCATION transaction.
     */
    static async postBookingCompletionAllocation(booking, actor, requestMeta = {}) {
        const snap = booking.pricingSnapshot;
        if (!snap) {
            const err = new Error('Booking pricing snapshot is missing.');
            err.statusCode = 400;
            err.errorCode = 'BOOKING_SNAPSHOT_MISSING';
            throw err;
        }

        const totalAmount = snap.customerTotalPaise || booking.totalAmount;
        const workerEarning = snap.workerEarningPaise || booking.workerEarning;
        const commissionAmount = snap.commissionAmountPaise || booking.commissionAmount;
        const platformFee = snap.platformFeeAmountPaise || booking.platformFee || 0;
        const taxAmount = snap.taxAmountPaise || booking.taxAmount || 0;
        const discountAmount = snap.discountAmountPaise || booking.discountAmount || 0;

        // Verify total formula debits vs credits
        const totalDebits = totalAmount + discountAmount;
        const totalCredits = workerEarning + commissionAmount + platformFee + taxAmount;

        if (totalDebits !== totalCredits) {
            await AuditLog.create({
                actor: actor?.userId || 'SYSTEM',
                action: 'FINANCIAL_SNAPSHOT_NOT_BALANCED',
                resourceType: 'Booking',
                resourceId: booking._id.toString(),
                beforeSnapshot: { totalDebits, totalCredits },
                afterSnapshot: { pricingSnapshot: snap },
                requestId: requestMeta.requestId,
            });
            const err = new Error(`Financial snapshot not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`);
            err.statusCode = 400;
            err.errorCode = 'FINANCIAL_SNAPSHOT_NOT_BALANCED';
            throw err;
        }

        const idempotencyKey = `BOOKING_COMPLETION_ALLOCATION:${booking._id}`;
        
        // Assemble balanced entries
        const entries = [
            {
                code: 'CUSTOMER_FUNDS_HELD',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: totalAmount,
                description: `Customer funds held release for booking ${booking.bookingNumber}`,
            }
        ];

        if (discountAmount > 0) {
            entries.push({
                code: 'PLATFORM_FUNDED_DISCOUNT_EXPENSE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: discountAmount,
                description: `Platform funded coupon discount for booking ${booking.bookingNumber}`,
            });
        }

        entries.push({
            code: 'WORKER_EARNINGS_PENDING',
            ownerType: 'WORKER',
            ownerId: booking.workerId,
            direction: 'CREDIT',
            amountPaise: workerEarning,
            description: `Worker pending earnings for booking ${booking.bookingNumber}`,
        });

        entries.push({
            code: 'PLATFORM_COMMISSION_REVENUE',
            ownerType: 'SYSTEM',
            direction: 'CREDIT',
            amountPaise: commissionAmount,
            description: `Platform commission revenue for booking ${booking.bookingNumber}`,
        });

        if (platformFee > 0) {
            entries.push({
                code: 'CUSTOMER_PLATFORM_FEE_REVENUE',
                ownerType: 'SYSTEM',
                direction: 'CREDIT',
                amountPaise: platformFee,
                description: `Platform customer fee revenue for booking ${booking.bookingNumber}`,
            });
        }

        if (taxAmount > 0) {
            entries.push({
                code: 'TAX_PAYABLE',
                ownerType: 'SYSTEM',
                direction: 'CREDIT',
                amountPaise: taxAmount,
                description: `Tax payable for booking ${booking.bookingNumber}`,
            });
        }

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'BOOKING_COMPLETION_ALLOCATION',
            businessEvent: 'BOOKING_COMPLETION_ALLOCATION',
            bookingId: booking._id,
            workerId: booking.workerId,
            customerId: booking.customerId,
            idempotencyKey,
            description: `Completion financial allocation for booking ${booking.bookingNumber}`,
            entries,
            ...requestMeta,
        });

        if (!res.alreadyProcessed) {
            // Update booking escrow status to RELEASE_PENDING
            await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'RELEASE_PENDING' });

            // Create WorkerEarning record
            const holdHours = config.PAYMENT_SETTLEMENT_HOLD_HOURS || 24;
            const availableAt = new Date(Date.now() + holdHours * 60 * 60 * 1000);
            const earningNumber = `ERN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

            const workerEarningRecord = new WorkerEarning({
                earningNumber,
                workerId: booking.workerId,
                bookingId: booking._id,
                ledgerTransactionId: res.transaction._id,
                amountPaise: workerEarning,
                currency: 'INR',
                status: 'PENDING',
                earnedAt: new Date(),
                availableAt,
                idempotencyKey: `WORKER_EARNING:${booking._id}`,
            });
            await workerEarningRecord.save();

            // Create audit log
            await AuditLog.create({
                actor: actor?.userId || 'SYSTEM',
                action: 'LEDGER_COMPLETION_ALLOCATION_POSTED',
                resourceType: 'Booking',
                resourceId: booking._id.toString(),
                beforeSnapshot: { escrowStatus: 'HELD' },
                afterSnapshot: { escrowStatus: 'RELEASE_PENDING', workerEarningId: workerEarningRecord._id.toString() },
                requestId: requestMeta.requestId,
            });

            // Send notification to worker
            await new Notification({
                recipientId: booking.workerId,
                title: 'Pending Earning Credited',
                message: `Booking ${booking.bookingNumber} is completed. Expected earning of ₹${(workerEarning / 100).toFixed(2)} is pending and will be available on ${availableAt.toLocaleString()}.`,
                type: 'SUCCESS',
                bookingId: booking._id,
            }).save();
        }

        return res;
    }

    /**
     * Post Settlement RELEASE transaction (PENDING to AVAILABLE).
     */
    static async postSettlementRelease(workerEarning, requestMeta = {}) {
        const idempotencyKey = `SETTLEMENT_RELEASE:${workerEarning._id}`;
        
        const entries = [
            {
                code: 'WORKER_EARNINGS_PENDING',
                ownerType: 'WORKER',
                ownerId: workerEarning.workerId,
                direction: 'DEBIT',
                amountPaise: workerEarning.amountPaise,
                description: `Release hold on pending earnings for earning ${workerEarning.earningNumber}`,
            },
            {
                code: 'WORKER_EARNINGS_AVAILABLE',
                ownerType: 'WORKER',
                ownerId: workerEarning.workerId,
                direction: 'CREDIT',
                amountPaise: workerEarning.amountPaise,
                description: `Add to available earnings for earning ${workerEarning.earningNumber}`,
            }
        ];

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'SETTLEMENT_HOLD_RELEASE',
            businessEvent: 'SETTLEMENT_HOLD_RELEASE',
            bookingId: workerEarning.bookingId,
            workerId: workerEarning.workerId,
            idempotencyKey,
            description: `Settlement release for earning ${workerEarning.earningNumber}`,
            entries,
            ...requestMeta,
        });

        if (!res.alreadyProcessed) {
            // Update WorkerEarning status
            await WorkerEarning.findByIdAndUpdate(workerEarning._id, {
                status: 'AVAILABLE',
                availableAt: new Date(),
            });

            // Notify worker
            await new Notification({
                recipientId: workerEarning.workerId,
                title: 'Earnings Available',
                message: `Your pending earning of ₹${(workerEarning.amountPaise / 100).toFixed(2)} is now available for withdrawal.`,
                type: 'SUCCESS',
            }).save();
        }

        return res;
    }

    /**
     * Post CORRECTIVE_REVERSAL transaction.
     */
    static async postReversal(originalTx, reason, actor, requestMeta = {}) {
        if (originalTx.status !== 'POSTED') {
            const err = new Error('Only POSTED transactions can be reversed.');
            err.statusCode = 400;
            err.errorCode = 'INVALID_TRANSACTION_STATUS';
            throw err;
        }

        // Prevent double reversals
        if (originalTx.reversedByTransactionId) {
            const err = new Error('This transaction has already been reversed.');
            err.statusCode = 400;
            err.errorCode = 'ALREADY_REVERSED';
            throw err;
        }

        const originalEntries = await LedgerEntry.find({ ledgerTransactionId: originalTx._id });
        const entries = [];

        // Build opposite direction entries
        for (const entry of originalEntries) {
            const account = await LedgerAccount.findById(entry.accountId);
            entries.push({
                code: account.code,
                ownerType: account.ownerType,
                ownerId: account.ownerId,
                direction: entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
                amountPaise: entry.amountPaise,
                description: `Reversal entry: ${entry.description}`,
            });
        }

        const idempotencyKey = `REVERSAL:${originalTx._id}`;

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'CORRECTIVE_REVERSAL',
            businessEvent: 'CORRECTIVE_REVERSAL',
            referenceType: 'LedgerTransaction',
            referenceId: originalTx._id,
            bookingId: originalTx.bookingId,
            workerId: originalTx.workerId,
            customerId: originalTx.customerId,
            idempotencyKey,
            description: `Reversal of transaction ${originalTx.transactionNumber}. Reason: ${reason}`,
            entries,
            postedByType: 'ADMIN',
            postedById: actor?.userId,
            ...requestMeta,
        });

        if (!res.alreadyProcessed) {
            // Update original transaction links
            await LedgerTransaction.findByIdAndUpdate(originalTx._id, {
                status: 'REVERSED',
                reversedByTransactionId: res.transaction._id,
                reversedAt: new Date(),
            });

            // If it was a completion allocation reversal, update WorkerEarning status
            if (originalTx.transactionType === 'BOOKING_COMPLETION_ALLOCATION') {
                const earning = await WorkerEarning.findOne({ bookingId: originalTx.bookingId });
                if (earning) {
                    await WorkerEarning.findByIdAndUpdate(earning._id, {
                        status: 'REVERSED',
                        reversedAt: new Date(),
                        reversalReason: reason,
                    });
                }
            }

            // Create Audit Log
            await AuditLog.create({
                actor: actor?.userId || 'SYSTEM',
                action: 'LEDGER_TRANSACTION_REVERSED',
                resourceType: 'LedgerTransaction',
                resourceId: originalTx._id.toString(),
                beforeSnapshot: { status: 'POSTED' },
                afterSnapshot: { status: 'REVERSED', reversalTransactionId: res.transaction._id.toString(), reason },
                requestId: requestMeta.requestId,
            });

            if (originalTx.workerId) {
                // Send notification to worker
                await new Notification({
                    recipientId: originalTx.workerId,
                    title: 'Financial Correction Notice',
                    message: `A financial correction was posted affecting transaction ${originalTx.transactionNumber}.`,
                    type: 'WARNING',
                }).save();
            }
        }

        return res;
    }

    /**
     * Rebuild and synchronize cached balance values in WorkerWallet from ledger entries.
     */
    static async syncWorkerWallet(workerId, session = null) {
        // Find worker's accounts
        const pendingAccount = await LedgerPostingService.resolveAccount('WORKER_EARNINGS_PENDING', 'WORKER', workerId, 'INR', session);
        const availableAccount = await LedgerPostingService.resolveAccount('WORKER_EARNINGS_AVAILABLE', 'WORKER', workerId, 'INR', session);
        const reservedAccount = await LedgerPostingService.resolveAccount('WORKER_PAYOUT_RESERVED', 'WORKER', workerId, 'INR', session);
        const frozenAccount = await LedgerPostingService.resolveAccount('WORKER_EARNINGS_FROZEN', 'WORKER', workerId, 'INR', session);

        // Fetch cumulative total earned: sum of all non-reversed completion credit entries
        const earningsEntries = await LedgerEntry.aggregate([
            { $match: { workerId: new mongoose.Types.ObjectId(workerId), accountId: availableAccount._id } }
        ]);
        // Also fetch from pending account for total earned
        const pendingEarningEntries = await LedgerEntry.aggregate([
            { $match: { workerId: new mongoose.Types.ObjectId(workerId), accountId: pendingAccount._id, direction: 'CREDIT' } }
        ]);

        const totalEarned = pendingEarningEntries.reduce((sum, e) => sum + e.amountPaise, 0);

        // Find or create WorkerWallet
        await WorkerWallet.findOneAndUpdate(
            { workerId },
            {
                pendingBalancePaise: Math.max(0, pendingAccount.cachedBalancePaise),
                availableBalancePaise: Math.max(0, availableAccount.cachedBalancePaise),
                reservedBalancePaise: Math.max(0, reservedAccount.cachedBalancePaise),
                frozenBalancePaise: Math.max(0, frozenAccount.cachedBalancePaise),
                totalEarnedPaise: totalEarned,
                lastReconciledAt: new Date(),
                reconciliationStatus: 'RECONCILED',
            },
            { upsert: true, new: true, session }
        );
    }

    /**
     * Post REFUND_APPROVED journal entry.
     */
    static async postRefundApproval(refund, requestMeta = {}) {
        const idempotencyKey = `REFUND_APPROVAL:${refund._id}`;
        const snap = refund.allocationSnapshot || {};

        const entries = [];
        const customerId = refund.customerId;
        const workerId = refund.workerId;

        // Debits
        if (snap.customerFundsHeldAlloc > 0) {
            entries.push({
                code: 'CUSTOMER_FUNDS_HELD',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: snap.customerFundsHeldAlloc,
                description: `Debit customer funds held for refund ${refund.refundNumber}`,
            });
        }
        if (snap.workerEarningsFrozenAlloc > 0) {
            entries.push({
                code: 'WORKER_EARNINGS_FROZEN',
                ownerType: 'WORKER',
                ownerId: workerId,
                direction: 'DEBIT',
                amountPaise: snap.workerEarningsFrozenAlloc,
                description: `Debit worker earnings frozen for refund ${refund.refundNumber}`,
            });
        }
        if (snap.workerEarningsPendingAlloc > 0) {
            entries.push({
                code: 'WORKER_EARNINGS_PENDING',
                ownerType: 'WORKER',
                ownerId: workerId,
                direction: 'DEBIT',
                amountPaise: snap.workerEarningsPendingAlloc,
                description: `Debit worker earnings pending for refund ${refund.refundNumber}`,
            });
        }
        if (snap.workerEarningsAvailableAlloc > 0) {
            entries.push({
                code: 'WORKER_EARNINGS_AVAILABLE',
                ownerType: 'WORKER',
                ownerId: workerId,
                direction: 'DEBIT',
                amountPaise: snap.workerEarningsAvailableAlloc,
                description: `Debit worker earnings available for refund ${refund.refundNumber}`,
            });
        }
        if (snap.platformCommissionRevenueAlloc > 0) {
            entries.push({
                code: 'PLATFORM_COMMISSION_REVENUE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: snap.platformCommissionRevenueAlloc,
                description: `Debit platform commission revenue for refund ${refund.refundNumber}`,
            });
        }
        if (snap.customerPlatformFeeRevenueAlloc > 0) {
            entries.push({
                code: 'CUSTOMER_PLATFORM_FEE_REVENUE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: snap.customerPlatformFeeRevenueAlloc,
                description: `Debit platform fee revenue for refund ${refund.refundNumber}`,
            });
        }
        if (snap.taxPayableAlloc > 0) {
            entries.push({
                code: 'TAX_PAYABLE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: snap.taxPayableAlloc,
                description: `Debit tax payable for refund ${refund.refundNumber}`,
            });
        }
        if (snap.platformRefundExpenseAlloc > 0) {
            entries.push({
                code: 'PLATFORM_REFUND_EXPENSE',
                ownerType: 'SYSTEM',
                direction: 'DEBIT',
                amountPaise: snap.platformRefundExpenseAlloc,
                description: `Debit platform refund expense for refund ${refund.refundNumber}`,
            });
        }

        // Credit REFUND_PAYABLE (Liability)
        entries.push({
            code: 'REFUND_PAYABLE',
            ownerType: 'CUSTOMER',
            ownerId: customerId,
            direction: 'CREDIT',
            amountPaise: refund.approvedAmountPaise,
            description: `Credit refund payable to customer for refund ${refund.refundNumber}`,
        });

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'REFUND_APPROVED',
            businessEvent: 'REFUND_APPROVED',
            bookingId: refund.bookingId,
            customerId,
            workerId,
            idempotencyKey,
            description: `Refund approved for booking ${refund.bookingId}`,
            entries,
            ...requestMeta,
        });

        await LedgerPostingService.syncWorkerWallet(workerId);
        return res;
    }

    /**
     * Post REFUND_PROVIDER_PROCESSED journal entry.
     */
    static async postRefundProcessed(refund, requestMeta = {}) {
        const idempotencyKey = `REFUND_PROVIDER_PROCESSED:${refund.providerRefundId}`;
        const customerId = refund.customerId;
        const workerId = refund.workerId;

        const entries = [
            {
                code: 'REFUND_PAYABLE',
                ownerType: 'CUSTOMER',
                ownerId: customerId,
                direction: 'DEBIT',
                amountPaise: refund.approvedAmountPaise,
                description: `Debit refund payable for processed refund ${refund.refundNumber}`,
            },
            {
                code: 'PAYMENT_GATEWAY_CLEARING',
                ownerType: 'SYSTEM',
                direction: 'CREDIT',
                amountPaise: refund.approvedAmountPaise,
                description: `Credit payment gateway clearing for processed refund ${refund.refundNumber}`,
            }
        ];

        const res = await LedgerPostingService.postTransaction({
            transactionType: 'REFUND_PROCESSED',
            businessEvent: 'REFUND_PROVIDER_PROCESSED',
            bookingId: refund.bookingId,
            customerId,
            workerId,
            idempotencyKey,
            description: `Refund processed by payment gateway for booking ${refund.bookingId}`,
            entries,
            ...requestMeta,
        });

        await LedgerPostingService.syncWorkerWallet(workerId);
        return res;
    }
}

export default LedgerPostingService;
