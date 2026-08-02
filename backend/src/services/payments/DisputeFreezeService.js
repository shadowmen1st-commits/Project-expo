import mongoose from 'mongoose';
import LedgerPostingService from './LedgerPostingService.js';
import Booking from '../../models/Booking.js';
import WorkerEarning from '../../models/WorkerEarning.js';
import DisputeCase from '../../models/DisputeCase.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';

export class DisputeFreezeService {
    /**
     * Freeze worker earnings or held funds related to a disputed booking.
     */
    static async freezeDisputeFunds(disputeCase, requestMeta = {}) {
        const executeFreeze = async (session) => {
            const disputeId = disputeCase._id;
            const booking = await Booking.findById(disputeCase.bookingId).session(session);
            if (!booking) throw new Error('Booking not found in DisputeFreezeService.');

            const workerId = booking.workerId;
            const idempotencyKey = `DISPUTE_FREEZE:${disputeId}`;

            // Find earning record
            const earning = await WorkerEarning.findOne({ bookingId: booking._id }).session(session);

            let freezeTx = null;
            const metaWithSession = { ...requestMeta, session };

            // Determine freeze scenario
            if (!earning) {
                // Scenario A: Funds remain in CUSTOMER_FUNDS_HELD (escrowStatus is HELD)
                // No ledger postings are needed, funds are locked within CUSTOMER_FUNDS_HELD
                await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'FROZEN' }, { session });
                await DisputeCase.findByIdAndUpdate(disputeId, { financialFreezeStatus: 'FROZEN' }, { session });
            } else {
                // Earning exists
                if (earning.status === 'FROZEN') {
                    return { success: true, alreadyProcessed: true };
                }

                if (earning.status === 'PENDING') {
                    // Scenario B: Worker earning is PENDING
                    const entries = [
                        {
                            code: 'WORKER_EARNINGS_PENDING',
                            ownerType: 'WORKER',
                            ownerId: workerId,
                            direction: 'DEBIT',
                            amountPaise: earning.amountPaise,
                            description: `Freeze pending earning for dispute ${disputeCase.disputeNumber}`,
                        },
                        {
                            code: 'WORKER_EARNINGS_FROZEN',
                            ownerType: 'WORKER',
                            ownerId: workerId,
                            direction: 'CREDIT',
                            amountPaise: earning.amountPaise,
                            description: `Frozen earnings for dispute ${disputeCase.disputeNumber}`,
                        }
                    ];

                    const res = await LedgerPostingService.postTransaction({
                        transactionType: 'WORKER_EARNING_RESERVED',
                        businessEvent: 'DISPUTE_FUNDS_FROZEN',
                        bookingId: booking._id,
                        workerId,
                        idempotencyKey,
                        description: `Freeze pending earning for dispute ${disputeCase.disputeNumber}`,
                        entries,
                        ...metaWithSession,
                    });

                    freezeTx = res.transaction;
                    earning.status = 'FROZEN';
                    earning.holdReason = 'Dispute opened';
                    await earning.save({ session });

                    await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'FROZEN' }, { session });
                    await DisputeCase.findByIdAndUpdate(disputeId, { financialFreezeStatus: 'FROZEN' }, { session });

                } else if (earning.status === 'AVAILABLE') {
                    // Scenario C: Worker earning is AVAILABLE
                    const entries = [
                        {
                            code: 'WORKER_EARNINGS_AVAILABLE',
                            ownerType: 'WORKER',
                            ownerId: workerId,
                            direction: 'DEBIT',
                            amountPaise: earning.amountPaise,
                            description: `Freeze available earning for dispute ${disputeCase.disputeNumber}`,
                        },
                        {
                            code: 'WORKER_EARNINGS_FROZEN',
                            ownerType: 'WORKER',
                            ownerId: workerId,
                            direction: 'CREDIT',
                            amountPaise: earning.amountPaise,
                            description: `Frozen earnings for dispute ${disputeCase.disputeNumber}`,
                        }
                    ];

                    const res = await LedgerPostingService.postTransaction({
                        transactionType: 'WORKER_EARNING_RESERVED',
                        businessEvent: 'DISPUTE_FUNDS_FROZEN',
                        bookingId: booking._id,
                        workerId,
                        idempotencyKey,
                        description: `Freeze available earning for dispute ${disputeCase.disputeNumber}`,
                        entries,
                        ...metaWithSession,
                    });

                    freezeTx = res.transaction;
                    earning.status = 'FROZEN';
                    earning.holdReason = 'Dispute opened';
                    await earning.save({ session });

                    await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'FROZEN' }, { session });
                    await DisputeCase.findByIdAndUpdate(disputeId, { financialFreezeStatus: 'FROZEN' }, { session });

                } else if (earning.status === 'PAID') {
                    // Scenario E: Worker earning is already PAID OUT
                    // Do not create negative balance. Mark dispute case recovery required.
                    await DisputeCase.findByIdAndUpdate(disputeId, {
                        financialFreezeStatus: 'FAILED',
                        internalAdminNotes: `RECOVERY_REQUIRED: Earnings already paid out to worker.`,
                    }, { session });
                }
            }

            // Sync worker wallet
            await LedgerPostingService.syncWorkerWallet(workerId, session);

            // Create Audit Log
            await new AuditLog({
                actor: requestMeta.actorId || disputeCase.customerId.toString(),
                action: 'DISPUTE_FUNDS_FROZEN',
                resourceType: 'DisputeCase',
                resourceId: disputeId.toString(),
                beforeSnapshot: { financialFreezeStatus: disputeCase.financialFreezeStatus },
                afterSnapshot: { financialFreezeStatus: 'FROZEN', ledgerTransactionId: freezeTx?._id },
                requestId: requestMeta.requestId,
            }).save({ session });

            // Notify worker
            await new Notification({
                recipientId: workerId,
                title: 'Earnings Frozen',
                message: `Earnings for booking ${booking.bookingNumber} have been frozen due to an active customer dispute.`,
                type: 'WARNING',
                bookingId: booking._id,
            }).save({ session });

            return { success: true, alreadyProcessed: false };
        };

        if (requestMeta.session) {
            return await executeFreeze(requestMeta.session);
        } else {
            const dbSession = await mongoose.startSession();
            try {
                dbSession.startTransaction();
                const res = await executeFreeze(dbSession);
                await dbSession.commitTransaction();
                return res;
            } catch (err) {
                if (dbSession.inTransaction()) {
                    await dbSession.abortTransaction();
                }
                if (err?.errorLabels?.includes('TransientTransactionError') || err?.code === 112) {
                    return await this.freezeDisputeFunds(disputeCase, requestMeta);
                }
                throw err;
            } finally {
                dbSession.endSession();
            }
        }
    }
}

export default DisputeFreezeService;

