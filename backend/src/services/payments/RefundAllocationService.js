import Booking from '../../models/Booking.js';
import WorkerEarning from '../../models/WorkerEarning.js';
import Refund from '../../models/Refund.js';

export class RefundAllocationService {
    /**
     * Map refund amounts to specific double-entry source ledger accounts.
     */
    static async allocateRefund({ bookingId, approvedRefundAmountPaise, workerLiabilityAmountPaise = 0, platformLiabilityAmountPaise = 0 }, requestMeta = {}) {
        const session = requestMeta.session || null;
        let bookingQuery = Booking.findById(bookingId);
        if (session) bookingQuery = bookingQuery.session(session);
        const booking = await bookingQuery;
        if (!booking) throw new Error('Booking not found.');

        // Cumulative Refund Invariant
        let existingRefundsQuery = Refund.find({
            bookingId: booking._id,
            status: { $in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PROVIDER_SUBMITTED', 'PROCESSED'] }
        });
        if (session) existingRefundsQuery = existingRefundsQuery.session(session);
        
        const existingRefunds = await existingRefundsQuery;
        const totalExistingRefundsPaise = existingRefunds.reduce((sum, r) => sum + (r.approvedAmountPaise || r.requestedAmountPaise), 0);
        const paidAmount = booking.pricingSnapshot?.customerTotalPaise || booking.totalAmount || 0;
        
        if (totalExistingRefundsPaise + approvedRefundAmountPaise > paidAmount) {
            return {
                status: 'INVARIANT_VIOLATION',
                error: `Cumulative refund invariant violated. Requested: ${approvedRefundAmountPaise}. Existing: ${totalExistingRefundsPaise}. Paid: ${paidAmount}`,
            };
        }

        const snap = booking.pricingSnapshot || {};
        let earningQuery = WorkerEarning.findOne({ bookingId: booking._id });
        if (session) earningQuery = earningQuery.session(session);
        const workerEarning = await earningQuery;

        let customerFundsHeldAlloc = 0;
        let workerEarningsFrozenAlloc = 0;
        let workerEarningsPendingAlloc = 0;
        let workerEarningsAvailableAlloc = 0;
        let platformCommissionRevenueAlloc = 0;
        let customerPlatformFeeRevenueAlloc = 0;
        let taxPayableAlloc = 0;
        let platformRefundExpenseAlloc = 0;

        let remainingRefundToAllocate = approvedRefundAmountPaise;

        // Scenario 1: Funds still in escrow (CUSTOMER_FUNDS_HELD)
        if (!workerEarning || booking.escrowStatus === 'HELD' || booking.escrowStatus === 'FROZEN') {
            const customerTotal = snap.customerTotalPaise || booking.totalAmount || 0;
            if (!workerEarning) {
                customerFundsHeldAlloc = Math.min(remainingRefundToAllocate, customerTotal);
                remainingRefundToAllocate -= customerFundsHeldAlloc;
            }
        }

        // Scenario 2: Earning posted, allocate based on liability
        if (remainingRefundToAllocate > 0 && workerEarning) {
            // Check where the worker's earnings are stored
            const earnAmount = workerEarning.amountPaise;
            const workerDebit = Math.min(workerLiabilityAmountPaise, earnAmount);

            if (workerEarning.status === 'FROZEN') {
                workerEarningsFrozenAlloc = Math.min(remainingRefundToAllocate, workerDebit);
                remainingRefundToAllocate -= workerEarningsFrozenAlloc;
            } else if (workerEarning.status === 'PENDING') {
                workerEarningsPendingAlloc = Math.min(remainingRefundToAllocate, workerDebit);
                remainingRefundToAllocate -= workerEarningsPendingAlloc;
            } else if (workerEarning.status === 'AVAILABLE') {
                workerEarningsAvailableAlloc = Math.min(remainingRefundToAllocate, workerDebit);
                remainingRefundToAllocate -= workerEarningsAvailableAlloc;
            }
        }

        // Allocate remaining to platform components (commissions, platform fees, taxes)
        if (remainingRefundToAllocate > 0) {
            const platformFee = snap.platformFeeAmountPaise || booking.platformFee || 0;
            customerPlatformFeeRevenueAlloc = Math.min(remainingRefundToAllocate, platformFee);
            remainingRefundToAllocate -= customerPlatformFeeRevenueAlloc;
        }

        if (remainingRefundToAllocate > 0) {
            const commission = snap.commissionAmountPaise || Math.round((snap.baseAmountPaise || booking.baseAmount) * 0.1) || 0;
            platformCommissionRevenueAlloc = Math.min(remainingRefundToAllocate, commission);
            remainingRefundToAllocate -= platformCommissionRevenueAlloc;
        }

        if (remainingRefundToAllocate > 0) {
            const tax = snap.taxAmountPaise || booking.taxAmount || 0;
            taxPayableAlloc = Math.min(remainingRefundToAllocate, tax);
            remainingRefundToAllocate -= taxPayableAlloc;
        }

        // Any excess is treated as a platform refund expense (e.g. dispute compensation)
        if (remainingRefundToAllocate > 0) {
            platformRefundExpenseAlloc = remainingRefundToAllocate;
            remainingRefundToAllocate = 0;
        }

        const totalAllocated =
            customerFundsHeldAlloc +
            workerEarningsFrozenAlloc +
            workerEarningsPendingAlloc +
            workerEarningsAvailableAlloc +
            platformCommissionRevenueAlloc +
            customerPlatformFeeRevenueAlloc +
            taxPayableAlloc +
            platformRefundExpenseAlloc;

        if (totalAllocated !== approvedRefundAmountPaise) {
            return {
                status: 'REFUND_ALLOCATION_NOT_BALANCED',
                error: `Total allocated (${totalAllocated}) does not equal approved refund amount (${approvedRefundAmountPaise}).`,
            };
        }

        return {
            status: 'SUCCESS',
            allocation: {
                customerFundsHeldAlloc,
                workerEarningsFrozenAlloc,
                workerEarningsPendingAlloc,
                workerEarningsAvailableAlloc,
                platformCommissionRevenueAlloc,
                customerPlatformFeeRevenueAlloc,
                taxPayableAlloc,
                platformRefundExpenseAlloc,
            }
        };
    }
}

export default RefundAllocationService;
