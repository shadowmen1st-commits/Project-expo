import Booking from '../../models/Booking.js';
import Refund from '../../models/Refund.js';
import CancellationPolicy from '../../models/CancellationPolicy.js';

export class RefundEligibilityService {
    /**
     * Determine the refund eligibility and calculate amounts authoritatively.
     */
    static async calculateEligibility({ bookingId, refundSource = 'CUSTOMER_CANCELLATION', customClaimAmountPaise = null }) {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            const err = new Error('Booking not found.');
            err.statusCode = 404;
            err.errorCode = 'BOOKING_NOT_FOUND';
            throw err;
        }

        // Fetch existing refunds
        const existingRefunds = await Refund.find({ bookingId: booking._id });
        const previouslyRefundedAmountPaise = existingRefunds
            .filter(r => r.status === 'PROCESSED' || r.status === 'PARTIALLY_PROCESSED')
            .reduce((sum, r) => sum + r.approvedAmountPaise, 0);

        const pendingRefundAmountPaise = existingRefunds
            .filter(r => ['REQUESTED', 'APPROVED', 'PROCESSING', 'PROVIDER_SUBMITTED'].includes(r.status))
            .reduce((sum, r) => sum + r.approvedAmountPaise, 0);

        const snap = booking.pricingSnapshot || {};
        const bookingPaidAmountPaise = snap.customerTotalPaise || booking.totalAmount;
        
        // Load active cancellation policy or use fallback development default
        let policy = await CancellationPolicy.findOne({
            serviceCategoryId: booking.serviceCategoryId,
            isActive: true,
        });

        let policyId = null;
        let policyVersion = 1;
        let freeCancellationBeforeMinutes = 120; // 2 hours default
        let customerCancellationFeeBps = 1000;   // 10% default
        let workerCompensationBps = 5000;         // 50% default
        let platformFeeRefundable = false;
        let taxRefundable = true;

        if (policy) {
            policyId = policy._id;
            freeCancellationBeforeMinutes = policy.freeCancellationBeforeMinutes;
            customerCancellationFeeBps = policy.customerCancellationFeeBps;
            workerCompensationBps = policy.workerCompensationBps;
            platformFeeRefundable = policy.platformFeeRefundable;
            taxRefundable = policy.taxRefundable;
        } else {
            console.warn('⚠️ WARNING: Using configurable development default cancellation policy. Awaiting business approved CancellationPolicy setup.');
        }

        let cancellationFeePaise = 0;
        let workerCompensationPaise = 0;
        let platformFeeRefundAmountPaise = 0;
        let taxRefundAmountPaise = 0;
        let serviceRefundAmountPaise = 0;

        const scheduledStart = new Date(booking.scheduledStart);
        const minutesToStart = (scheduledStart.getTime() - Date.now()) / (1000 * 60);

        const isFreeCancellation = minutesToStart >= freeCancellationBeforeMinutes;

        // Perform eligibility calculation based on source
        if (refundSource === 'CUSTOMER_CANCELLATION') {
            if (!isFreeCancellation) {
                // Calculate cancellation fee on base amount
                const baseAmount = snap.baseAmountPaise || booking.baseAmount;
                cancellationFeePaise = Math.round((baseAmount * customerCancellationFeeBps) / 10000);
                workerCompensationPaise = Math.round((cancellationFeePaise * workerCompensationBps) / 10000);
            }
            
            // Platform fee is non-refundable by default
            if (platformFeeRefundable) {
                platformFeeRefundAmountPaise = snap.platformFeeAmountPaise || booking.platformFee || 0;
            }

            // Tax is refundable for the refunded taxable portion
            if (taxRefundable) {
                taxRefundAmountPaise = snap.taxAmountPaise || booking.taxAmount || 0;
            }

            const baseAmount = snap.baseAmountPaise || booking.baseAmount;
            serviceRefundAmountPaise = Math.max(0, baseAmount - cancellationFeePaise);
        } else if (refundSource === 'WORKER_REJECTION' || refundSource === 'WORKER_NO_SHOW' || refundSource === 'SERVICE_FAILURE') {
            // Full refund
            serviceRefundAmountPaise = snap.baseAmountPaise || booking.baseAmount;
            platformFeeRefundAmountPaise = snap.platformFeeAmountPaise || booking.platformFee || 0;
            taxRefundAmountPaise = snap.taxAmountPaise || booking.taxAmount || 0;
            cancellationFeePaise = 0;
            workerCompensationPaise = 0;
        } else if (refundSource === 'ADMIN_DISPUTE_RESOLUTION') {
            // Dispute approved refund
            if (customClaimAmountPaise !== null) {
                serviceRefundAmountPaise = customClaimAmountPaise;
            } else {
                serviceRefundAmountPaise = snap.baseAmountPaise || booking.baseAmount;
            }
            platformFeeRefundAmountPaise = snap.platformFeeAmountPaise || booking.platformFee || 0;
            taxRefundAmountPaise = snap.taxAmountPaise || booking.taxAmount || 0;
        }

        // approved refund amount
        let approvedRefundAmountPaise = serviceRefundAmountPaise + platformFeeRefundAmountPaise + taxRefundAmountPaise;
        
        // Bound calculation
        const maximumRefundableAmountPaise = Math.max(0, bookingPaidAmountPaise - previouslyRefundedAmountPaise);
        if (approvedRefundAmountPaise > maximumRefundableAmountPaise) {
            approvedRefundAmountPaise = maximumRefundableAmountPaise;
        }

        return {
            bookingPaidAmountPaise,
            previouslyRefundedAmountPaise,
            pendingRefundAmountPaise,
            maximumRefundableAmountPaise,
            cancellationFeePaise,
            workerCompensationPaise,
            platformFeeRefundAmountPaise,
            taxRefundAmountPaise,
            serviceRefundAmountPaise,
            approvedRefundAmountPaise,
            calculationVersion: 1,
            calculatedAt: new Date(),
            policyId,
            policyVersion,
            reason: refundSource,
        };
    }
}

export default RefundEligibilityService;
