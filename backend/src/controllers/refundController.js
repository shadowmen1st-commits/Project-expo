import Booking from '../models/Booking.js';
import Refund from '../models/Refund.js';
import DisputeCase from '../models/DisputeCase.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import RefundEligibilityService from '../services/payments/RefundEligibilityService.js';
import RefundAllocationService from '../services/payments/RefundAllocationService.js';
import RefundStateService from '../services/payments/RefundStateService.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import DisputeReleaseService from '../services/payments/DisputeReleaseService.js';
import razorpayProvider from '../services/payments/RazorpayProvider.js';
import RefundReconciliationService from '../services/payments/RefundReconciliationService.js';
import crypto from 'crypto';
import { sanitizeRefundDto } from '../utils/financialDto.js';

export const getCancellationQuote = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        if (booking.customerId.toString() !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        const quote = await RefundEligibilityService.calculateEligibility({
            bookingId: booking._id,
            refundSource: 'CUSTOMER_CANCELLATION',
        });

        return res.json({ success: true, quote });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        if (booking.customerId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        if (booking.bookingStatus === 'CANCELLED') {
            return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
        }

        const quote = await RefundEligibilityService.calculateEligibility({
            bookingId: booking._id,
            refundSource: 'CUSTOMER_CANCELLATION',
        });

        const paymentTx = await PaymentTransaction.findOne({ bookingId: booking._id, status: 'VERIFIED' });
        if (!paymentTx && booking.paymentStatus === 'PAID') {
            return res.status(400).json({ success: false, message: 'No verified payment transaction found.' });
        }

        booking.bookingStatus = 'CANCELLED';
        booking.cancelledAt = new Date();
        booking.cancellationReason = req.body.reason || 'Customer cancellation';
        booking.cancelledBy = req.user.userId;

        let refund = null;
        if (booking.paymentStatus === 'PAID' && quote.approvedRefundAmountPaise > 0) {
            const refundNumber = `REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
            const idempotencyKey = `REFUND_CANCELLATION:${booking._id}`;

            const allocRes = await RefundAllocationService.allocateRefund({
                bookingId: booking._id,
                approvedRefundAmountPaise: quote.approvedRefundAmountPaise,
                workerLiabilityAmountPaise: quote.workerCompensationPaise,
                platformLiabilityAmountPaise: quote.cancellationFeePaise,
            });

            if (allocRes.status !== 'SUCCESS') {
                return res.status(400).json({ success: false, message: allocRes.error });
            }

            refund = new Refund({
                refundNumber,
                bookingId: booking._id,
                customerId: booking.customerId,
                workerId: booking.workerId,
                paymentOrderId: paymentTx.paymentOrderId,
                paymentTransactionId: paymentTx._id,
                providerPaymentId: paymentTx.providerPaymentId,
                refundType: quote.approvedRefundAmountPaise === quote.bookingPaidAmountPaise ? 'FULL' : 'PARTIAL',
                refundReason: booking.cancellationReason,
                requestedAmountPaise: quote.approvedRefundAmountPaise,
                approvedAmountPaise: quote.approvedRefundAmountPaise,
                currency: 'INR',
                status: 'APPROVED',
                source: 'CUSTOMER_CANCELLATION',
                eligibilitySnapshot: quote,
                allocationSnapshot: allocRes.allocation,
                idempotencyKey,
                requestedByType: 'CUSTOMER',
                requestedById: req.user.userId,
            });

            await refund.save();

            // Post double-entry refund approval entry
            await LedgerPostingService.postRefundApproval(refund, {
                actorId: req.user.userId,
                requestId: req.headers['x-request-id'] || '',
            });

            // Submit refund request to Razorpay
            try {
                const rpRefund = await razorpayProvider.createRefund({
                    providerPaymentId: refund.providerPaymentId,
                    amountPaise: refund.approvedAmountPaise,
                    notes: { refundNumber: refund.refundNumber },
                });
                refund.providerRefundId = rpRefund.id;
                refund.status = 'PROVIDER_SUBMITTED';
                await refund.save();
                booking.paymentStatus = 'REFUNDED';
                booking.escrowStatus = 'REFUNDED';
            } catch (err) {
                console.error('Razorpay refund submission failed:', err);
                refund.status = 'FAILED';
                refund.failureCode = err.errorCode || 'PROVIDER_SUBMISSION_FAILED';
                refund.failureDescriptionSafe = err.message;
                await refund.save();
            }
        }

        await booking.save();

        await new AuditLog({
            actor: req.user.userId,
            action: 'BOOKING_CANCELLED',
            resourceType: 'Booking',
            resourceId: booking._id.toString(),
            afterSnapshot: booking.toObject(),
        }).save();

        return res.json({ success: true, booking, refund });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getCustomerRefunds = async (req, res) => {
    try {
        const refunds = await Refund.find({ customerId: req.user.userId });
        return res.json({ success: true, refunds });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getRefundDetails = async (req, res) => {
    try {
        const refund = await Refund.findById(req.params.id);
        if (!refund) return res.status(404).json({ success: false, message: 'Refund not found.' });

        if (refund.customerId.toString() !== req.user.userId && req.user.role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        return res.json({ success: true, refund: sanitizeRefundDto(refund.toObject(), { role: req.user.role }) });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const resolveDispute = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, message: 'Unauthorized admin role required.' });
        }

        const { resolutionType, approvedRefundAmountPaise, workerLiabilityAmountPaise, platformLiabilityAmountPaise, resolutionSummary, internalAdminNotes } = req.body;
        const dispute = await DisputeCase.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

        dispute.resolutionType = resolutionType;
        dispute.resolutionSummary = resolutionSummary;
        dispute.internalAdminNotes = internalAdminNotes;
        dispute.resolvedAt = new Date();
        dispute.status = 'CLOSED';

        const booking = await Booking.findById(dispute.bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        let refund = null;
        if (resolutionType === 'FULL_REFUND' || resolutionType === 'PARTIAL_REFUND') {
            const paymentTx = await PaymentTransaction.findOne({ bookingId: dispute.bookingId, status: 'VERIFIED' });
            if (!paymentTx) return res.status(400).json({ success: false, message: 'No payment transaction found.' });

            const quote = await RefundEligibilityService.calculateEligibility({
                bookingId: dispute.bookingId,
                refundSource: 'ADMIN_DISPUTE_RESOLUTION',
                customClaimAmountPaise: approvedRefundAmountPaise,
            });

            if (!Number.isInteger(approvedRefundAmountPaise) || approvedRefundAmountPaise < 1) {
                return res.status(400).json({ success: false, message: 'Approved refund amount must be a positive integer paise.' });
            }
            if (approvedRefundAmountPaise > quote.maximumRefundableAmountPaise) {
                return res.status(400).json({ success: false, message: 'Approved refund amount exceeds eligible limits.' });
            }

            const allocRes = await RefundAllocationService.allocateRefund({
                bookingId: dispute.bookingId,
                approvedRefundAmountPaise,
                workerLiabilityAmountPaise,
                platformLiabilityAmountPaise,
            });

            if (allocRes.status !== 'SUCCESS') {
                return res.status(400).json({ success: false, message: allocRes.error });
            }

            const refundNumber = `REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
            const idempotencyKey = `REFUND_DISPUTE:${dispute._id}`;

            refund = new Refund({
                refundNumber,
                bookingId: dispute.bookingId,
                customerId: dispute.customerId,
                workerId: dispute.workerId,
                disputeId: dispute._id,
                paymentOrderId: paymentTx.paymentOrderId,
                paymentTransactionId: paymentTx._id,
                providerPaymentId: paymentTx.providerPaymentId,
                refundType: resolutionType === 'FULL_REFUND' ? 'FULL' : 'PARTIAL',
                refundReason: resolutionSummary,
                requestedAmountPaise: approvedRefundAmountPaise,
                approvedAmountPaise,
                currency: 'INR',
                status: 'APPROVED',
                source: 'ADMIN_DISPUTE_RESOLUTION',
                eligibilitySnapshot: quote,
                allocationSnapshot: allocRes.allocation,
                idempotencyKey,
                requestedByType: 'ADMIN',
                requestedById: req.user.userId,
            });

            await refund.save();

            // Post refund approval entry
            await LedgerPostingService.postRefundApproval(refund, {
                actorId: req.user.userId,
                requestId: req.headers['x-request-id'] || '',
            });

            // Submit to Razorpay
            try {
                const rpRefund = await razorpayProvider.createRefund({
                    providerPaymentId: refund.providerPaymentId,
                    amountPaise: refund.approvedAmountPaise,
                    notes: { refundNumber: refund.refundNumber },
                });
                refund.providerRefundId = rpRefund.id;
                refund.status = 'PROVIDER_SUBMITTED';
                await refund.save();

                booking.paymentStatus = resolutionType === 'FULL_REFUND' ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
                booking.escrowStatus = resolutionType === 'FULL_REFUND' ? 'REFUNDED' : 'RELEASED';
            } catch (err) {
                console.error('Razorpay dispute refund failed:', err);
                refund.status = 'FAILED';
                refund.failureCode = err.errorCode || 'PROVIDER_SUBMISSION_FAILED';
                refund.failureDescriptionSafe = err.message;
                await refund.save();
            }
        } else {
            // No refund / worker favoured - release frozen earning back to worker
            await DisputeReleaseService.releaseDisputeFunds(dispute, {
                actorId: req.user.userId,
                requestId: req.headers['x-request-id'] || '',
            });
            booking.bookingStatus = 'COMPLETED';
        }

        await dispute.save();
        await booking.save();

        await new AuditLog({
            actor: req.user.userId,
            action: 'DISPUTE_RESOLVED',
            resourceType: 'DisputeCase',
            resourceId: dispute._id.toString(),
            afterSnapshot: dispute.toObject(),
        }).save();

        return res.json({ success: true, dispute, refund });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getReconciliationIssues = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }
        const audit = await RefundReconciliationService.runReconciliationAudit();
        return res.json(audit);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
