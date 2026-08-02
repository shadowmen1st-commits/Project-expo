import WorkerEarning from '../../models/WorkerEarning.js';
import LedgerPostingService from './LedgerPostingService.js';
import DisputeCase from '../../models/DisputeCase.js';

export class SettlementReleaseService {
    /**
     * Sweep pending earnings that are past their hold periods and release them.
     */
    static async releaseEligibleEarnings(requestMeta = {}) {
        const now = new Date();
        const pendingEarnings = await WorkerEarning.find({
            status: 'PENDING',
            availableAt: { $lte: now },
        });

        let processedCount = 0;
        let totalReleasedAmount = 0;

        for (const earning of pendingEarnings) {
            try {
                // Check if there is an active dispute case for this booking
                const hasActiveDispute = await DisputeCase.exists({
                    bookingId: earning.bookingId,
                    status: { $in: ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'CUSTOMER_RESPONSE_REQUIRED', 'WORKER_RESPONSE_REQUIRED', 'RESOLUTION_PENDING'] },
                });
                if (hasActiveDispute) {
                    console.log(`Skipping settlement release for earning ${earning.earningNumber} due to active dispute.`);
                    continue;
                }

                const res = await LedgerPostingService.postSettlementRelease(earning, requestMeta);
                if (res) {
                    processedCount++;
                    totalReleasedAmount += earning.amountPaise;
                }
            } catch (err) {
                console.error(`Failed to release earning ${earning.earningNumber}:`, err);
                // Continue with next earning to prevent single-failure blocking
            }
        }

        return {
            processedCount,
            totalReleasedAmount,
        };
    }
}

export default SettlementReleaseService;
