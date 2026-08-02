import mongoose from 'mongoose';
import LedgerPostingService from './LedgerPostingService.js';
import Booking from '../../models/Booking.js';
import WorkerEarning from '../../models/WorkerEarning.js';
import DisputeCase from '../../models/DisputeCase.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';

export class DisputeReleaseService {
    /**
     * Release frozen dispute funds back to the worker.
     */
    static async releaseDisputeFunds(disputeCase, requestMeta = {}) {
        const executeRelease = async (session) => {
            const disputeId = disputeCase._id;
            const booking = await Booking.findById(disputeCase.bookingId).session(session);
            if (!booking) throw new Error('Booking not found in DisputeReleaseService.');

            const workerId = booking.workerId;
            const idempotencyKey = `DISPUTE_RELEASE:${disputeId}`;

            // Find earning record
            const earning = await WorkerEarning.findOne({ bookingId: booking._id }).session(session);

            let releaseTx = null;
            const metaWithSession = { ...requestMeta, session };

            if (earning && earning.status === 'FROZEN') {
                // Determine if it should go to AVAILABLE or PENDING
                const targetAccount = Date.now() >= new Date(earning.availableAt).getTime()
                    ? 'WORKER_EARNINGS_AVAILABLE'
                    : 'WORKER_EARNINGS_PENDING';

                const entries = [
                    {
                        code: 'WORKER_EARNINGS_FROZEN',
                        ownerType: 'WORKER',
                        ownerId: workerId,
                        direction: 'DEBIT',
                        amountPaise: earning.amountPaise,
                        description: `Release frozen earning for dispute ${disputeCase.disputeNumber}`,
                    },
                    {
                        code: targetAccount,
                        ownerType: 'WORKER',
                        ownerId: workerId,
                        direction: 'CREDIT',
                        amountPaise: earning.amountPaise,
                        description: `Restore released earning for dispute ${disputeCase.disputeNumber}`,
                    }
                ];

                const res = await LedgerPostingService.postTransaction({
                    transactionType: 'WORKER_EARNING_AVAILABLE',
                    businessEvent: 'DISPUTE_FUNDS_RELEASED',
                    bookingId: booking._id,
                    workerId,
                    idempotencyKey,
                    description: `Release frozen earning for dispute ${disputeCase.disputeNumber}`,
                    entries,
                    ...metaWithSession,
                });

                releaseTx = res.transaction;
                earning.status = targetAccount === 'WORKER_EARNINGS_AVAILABLE' ? 'AVAILABLE' : 'PENDING';
                earning.holdReason = null;
                await earning.save({ session });

                await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'RELEASED' }, { session });
                await DisputeCase.findByIdAndUpdate(disputeId, { financialFreezeStatus: 'RELEASED' }, { session });
            } else {
                // No earning or not frozen
                await Booking.findByIdAndUpdate(booking._id, { escrowStatus: 'RELEASED' }, { session });
                await DisputeCase.findByIdAndUpdate(disputeId, { financialFreezeStatus: 'RELEASED' }, { session });
            }

            // Sync worker wallet
            await LedgerPostingService.syncWorkerWallet(workerId, session);

            // Create Audit Log
            await new AuditLog({
                actor: requestMeta.actorId || 'SYSTEM',
                action: 'DISPUTE_FUNDS_RELEASED',
                resourceType: 'DisputeCase',
                resourceId: disputeId.toString(),
                beforeSnapshot: { financialFreezeStatus: disputeCase.financialFreezeStatus },
                afterSnapshot: { financialFreezeStatus: 'RELEASED', ledgerTransactionId: releaseTx?._id },
                requestId: requestMeta.requestId,
            }).save({ session });

            // Notify worker
            await new Notification({
                recipientId: workerId,
                title: 'Earnings Released',
                message: `Your frozen earnings for booking ${booking.bookingNumber} have been released.`,
                type: 'SUCCESS',
                bookingId: booking._id,
            }).save({ session });

            return { success: true };
        };

        if (requestMeta.session) {
            return await executeRelease(requestMeta.session);
        } else {
            const dbSession = await mongoose.startSession();
            try {
                dbSession.startTransaction();
                const res = await executeRelease(dbSession);
                await dbSession.commitTransaction();
                return res;
            } catch (err) {
                if (dbSession.inTransaction()) {
                    await dbSession.abortTransaction();
                }
                if (err?.errorLabels?.includes('TransientTransactionError') || err?.code === 112) {
                    return await this.releaseDisputeFunds(disputeCase, requestMeta);
                }
                throw err;
            } finally {
                dbSession.endSession();
            }
        }
    }
}

export default DisputeReleaseService;
