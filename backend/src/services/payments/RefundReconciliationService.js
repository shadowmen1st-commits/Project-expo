import Refund from '../../models/Refund.js';
import Booking from '../../models/Booking.js';
import LedgerTransaction from '../../models/LedgerTransaction.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import razorpayProvider from './RazorpayProvider.js';

export class RefundReconciliationService {
    /**
     * Audit refunds against payment provider facts and ledger state.
     * Returns list of reconciliation issues found (read-only).
     */
    static async runReconciliationAudit() {
        const issues = [];
        const refunds = await Refund.find({});

        for (const refund of refunds) {
            try {
                // 1. Cross-reference provider if ID is present
                if (refund.providerRefundId) {
                    try {
                        const providerRefund = await razorpayProvider.fetchRefund(refund.providerRefundId);
                        if (providerRefund.amount !== refund.approvedAmountPaise) {
                            issues.push({
                                type: 'AMOUNT_MISMATCH',
                                refundId: refund._id,
                                description: `Amount mismatch: Internal approved is ${refund.approvedAmountPaise} paise, provider refund is ${providerRefund.amount} paise.`,
                            });
                        }
                        if (providerRefund.currency !== refund.currency) {
                            issues.push({
                                type: 'CURRENCY_MISMATCH',
                                refundId: refund._id,
                                description: `Currency mismatch: Internal is ${refund.currency}, provider refund is ${providerRefund.currency}.`,
                            });
                        }
                        if (providerRefund.payment_id !== refund.providerPaymentId) {
                            issues.push({
                                type: 'PAYMENT_ID_MISMATCH',
                                refundId: refund._id,
                                description: `Payment ID mismatch: Internal is ${refund.providerPaymentId}, provider has ${providerRefund.payment_id}.`,
                            });
                        }
                    } catch (e) {
                        issues.push({
                            type: 'PROVIDER_FETCH_FAILED',
                            refundId: refund._id,
                            description: `Failed to fetch refund details from provider: ${e.message}`,
                        });
                    }
                }

                // 2. Check for missing approval ledger transactions
                const hasApprovalTx = await LedgerTransaction.exists({
                    bookingId: refund.bookingId,
                    transactionType: 'REFUND_APPROVED',
                });
                if (!hasApprovalTx) {
                    issues.push({
                        type: 'MISSING_APPROVAL_LEDGER',
                        refundId: refund._id,
                        description: `Refund approved but no corresponding REFUND_APPROVED ledger transaction exists.`,
                    });
                }

                // 3. Check for missing processed ledger transactions
                if (refund.status === 'PROCESSED') {
                    const hasProcessedTx = await LedgerTransaction.exists({
                        bookingId: refund.bookingId,
                        transactionType: 'REFUND_PROCESSED',
                    });
                    if (!hasProcessedTx) {
                        issues.push({
                            type: 'MISSING_PROCESSED_LEDGER',
                            refundId: refund._id,
                            description: `Refund processed but no corresponding REFUND_PROCESSED ledger transaction exists.`,
                        });
                    }
                }

                // 4. Verify booking states
                const booking = await Booking.findById(refund.bookingId);
                if (booking) {
                    if (refund.refundType === 'FULL' && refund.status === 'PROCESSED') {
                        if (booking.paymentStatus !== 'REFUNDED' || booking.escrowStatus !== 'REFUNDED') {
                            issues.push({
                                type: 'BOOKING_STATE_MISMATCH',
                                refundId: refund._id,
                                description: `Booking status mismatch for full refund: paymentStatus is ${booking.paymentStatus}, escrowStatus is ${booking.escrowStatus} (expected REFUNDED).`,
                            });
                        }
                    }
                }
            } catch (err) {
                issues.push({
                    type: 'SYSTEM_AUDIT_ERROR',
                    refundId: refund._id,
                    description: `Internal error auditing refund: ${err.message}`,
                });
            }
        }

        return {
            success: true,
            totalAudited: refunds.length,
            issues,
        };
    }
}

export default RefundReconciliationService;
