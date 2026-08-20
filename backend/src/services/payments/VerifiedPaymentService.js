/**
 * VerifiedPaymentService — The ONLY service authorised to apply a successful payment.
 *
 * Called by:
 *  - paymentSignatureService (checkout callback path)
 *  - WebhookProcessorService (payment.captured / order.paid webhook path)
 *
 * This service MUST NOT be called by controllers or routes with client-supplied data.
 * All inputs must be verified provider facts, not raw client claims.
 *
 * NOTE: This project does not use a MongoDB replica set, so multi-document
 * session.withTransaction() is not available. The workflow uses an idempotency-first
 * compensating pattern. The first caller to set PaymentOrder.status = 'PAID' wins;
 * subsequent calls detect the PAID state and return without side effects.
 *
 * This service DOES NOT:
 * - Credit worker wallets
 * - Create worker earning ledger entries
 * - Release commission
 * - Create payouts
 * - Modify historical pricing snapshots
 * - Recalculate commission
 */
import crypto from 'crypto';
import PaymentOrder from '../../models/PaymentOrder.js';
import PaymentTransaction from '../../models/PaymentTransaction.js';
import Booking from '../../models/Booking.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';
import LedgerPostingService from './LedgerPostingService.js';
import { emitToUser, emitToRoom } from '../../socketServer.js';
import { toSafeBookingDTO } from '../../utils/dto.js';

class VerifiedPaymentServiceClass {
    /**
     * Apply verified payment state atomically (idempotency-first pattern).
     *
     * @param {object} params
     * @param {object} params.paymentOrder   Mongoose PaymentOrder document (loaded)
     * @param {object} params.verifiedFacts  Provider-verified facts
     * @param {object} params.requestMeta    { requestId, ipAddress, userAgent, actorId }
     * @returns {object} Result with transactionNumber
     */
    async applyVerifiedPayment({ paymentOrder, verifiedFacts, requestMeta = {} }) {
        const {
            providerOrderId,
            providerPaymentId,
            providerSignatureHash,
            amountPaise,
            currency,
            method,
            captured,
            verificationSource,
            signatureVerified,
        } = verifiedFacts;

        // ── 1. Idempotency — if already PAID, return without side effects ─────────
        const freshOrder = await PaymentOrder.findById(paymentOrder._id);
        if (!freshOrder) throw new Error('PaymentOrder not found in VerifiedPaymentService.');

        if (freshOrder.status === 'PAID') {
            // Find the existing transaction for the return value
            const existingTxn = await PaymentTransaction.findOne({
                paymentOrderId: freshOrder._id,
                status: 'VERIFIED',
            });
            return {
                transactionNumber: existingTxn?.transactionNumber || 'ALREADY_PROCESSED',
                alreadyProcessed: true,
            };
        }

        // ── 2. Load booking ───────────────────────────────────────────────────────
        const booking = await Booking.findById(freshOrder.bookingId);
        if (!booking) throw new Error('Booking not found in VerifiedPaymentService.');

        // ── 3. Cross-reference: booking must belong to payment order's customer ──
        if (booking.customerId.toString() !== freshOrder.customerId.toString()) {
            throw new Error('Booking/PaymentOrder customer mismatch detected in VerifiedPaymentService.');
        }

        // ── 4. Provider order ID reconciliation ──────────────────────────────────
        if (freshOrder.providerOrderId && freshOrder.providerOrderId !== providerOrderId) {
            throw new Error('Provider order ID mismatch in VerifiedPaymentService.');
        }

        // ── 5. Amount reconciliation ─────────────────────────────────────────────
        if (amountPaise !== freshOrder.amountPaise) {
            throw new Error(`Amount mismatch: expected ${freshOrder.amountPaise}, got ${amountPaise}.`);
        }

        // ── 6. Currency reconciliation ────────────────────────────────────────────
        if (currency !== freshOrder.currency) {
            throw new Error(`Currency mismatch: expected ${freshOrder.currency}, got ${currency}.`);
        }

        // ── 7. Check for duplicate payment ID ────────────────────────────────────
        const dupCheck = await PaymentTransaction.findOne({ providerPaymentId });
        if (dupCheck && dupCheck.status === 'VERIFIED') {
            return {
                transactionNumber: dupCheck.transactionNumber,
                alreadyProcessed: true,
            };
        }

        const now = new Date();

        // ── 8. Create PaymentTransaction (idempotencyKey prevents race duplicate) ─
        const txnIdempotencyKey = `verified-payment::${freshOrder._id}::${providerPaymentId}`;
        let transaction;
        try {
            transaction = await PaymentTransaction.create({
                bookingId: freshOrder.bookingId,
                paymentOrderId: freshOrder._id,
                customerId: freshOrder.customerId,
                provider: 'razorpay',
                providerOrderId,
                providerPaymentId,
                providerSignatureHash,
                amountPaise,
                currency,
                method,
                status: 'VERIFIED',
                verificationSource,
                signatureVerified: signatureVerified || false,
                captured: captured || false,
                verifiedAt: now,
                idempotencyKey: txnIdempotencyKey,
            });
        } catch (e) {
            if (e.code === 11000) {
                // Duplicate — find existing
                transaction = await PaymentTransaction.findOne({ idempotencyKey: txnIdempotencyKey });
                if (!transaction) {
                    transaction = await PaymentTransaction.findOne({ providerPaymentId });
                }
                return {
                    transactionNumber: transaction?.transactionNumber || 'DUPLICATE',
                    alreadyProcessed: true,
                };
            }
            throw e;
        }

        // ── 9. Update PaymentOrder → PAID ─────────────────────────────────────────
        await PaymentOrder.findByIdAndUpdate(freshOrder._id, {
            status: 'PAID',
            paidAt: now,
            lastProviderStatus: 'paid',
        });

        // ── 10. Update Booking → PAID ──────────────────────────────────────────────
        // bookingStatus: PAYMENT_PENDING → PAID
        // paymentStatus: PENDING → PAID
        // escrowStatus: NOT_FUNDED → HELD (internal platform payment-hold state)
        //
        // IMPORTANT: escrowStatus = 'HELD' is an internal platform accounting status only.
        // This does NOT represent a regulated banking escrow account.
        const updatedBooking = await Booking.findByIdAndUpdate(booking._id, {
            bookingStatus: 'PAID',
            paymentStatus: 'PAID',
            escrowStatus: 'HELD',
        }, { new: true });

        console.log('[PAYMENT] Booking marked PAID:', {
            bookingId: booking._id.toString(),
            paymentStatus: updatedBooking.paymentStatus,
            bookingStatus: updatedBooking.bookingStatus,
        });

        // Post ledger captured payment
        await LedgerPostingService.postPaymentCaptured(updatedBooking, freshOrder._id, transaction._id, providerPaymentId, requestMeta);

        // ── 11. Create immutable audit log ─────────────────────────────────────────
        const auditActor = requestMeta.actorId || freshOrder.customerId;
        await AuditLog.create({
            actor: auditActor,
            action: 'PAYMENT_VERIFIED',
            resourceType: 'Booking',
            resourceId: booking._id.toString(),
            beforeSnapshot: {
                bookingStatus: booking.bookingStatus,
                paymentStatus: booking.paymentStatus,
                escrowStatus: booking.escrowStatus,
            },
            afterSnapshot: {
                bookingStatus: 'PAID',
                paymentStatus: 'PAID',
                escrowStatus: 'HELD',
                verificationSource,
                transactionNumber: transaction.transactionNumber,
            },
            ipAddress: requestMeta.ipAddress || '',
            userAgent: requestMeta.userAgent || '',
            requestId: requestMeta.requestId || '',
        });

        // ── 12. Notify customer ────────────────────────────────────────────────────
        const notifyKey = `payment-verified-customer::${booking._id}`;
        const dupNotif = await Notification.findOne({ idempotencyKey: notifyKey });
        if (!dupNotif) {
            await Notification.create({
                recipientId: booking.customerId,
                title: 'Payment Confirmed ✓',
                message: `Your payment for booking ${booking.bookingNumber} has been verified. Your booking is now confirmed and pending worker acceptance.`,
                type: 'SUCCESS',
                bookingId: booking._id,
                idempotencyKey: notifyKey,
            });
        }

        // ── 13. Notify assigned worker ─────────────────────────────────────────────
        if (booking.workerId) {
            const workerNotifyKey = `payment-verified-worker::${booking._id}`;
            const dupWorkerNotif = await Notification.findOne({ idempotencyKey: workerNotifyKey });
            if (!dupWorkerNotif) {
                await Notification.create({
                    recipientId: booking.workerId,
                    title: 'New Paid Booking Request',
                    message: `Booking ${booking.bookingNumber} has been paid and is awaiting your acceptance. Expected earning: ₹${((booking.pricingSnapshot?.workerEarning || 0) / 100).toFixed(2)} (released only after authorised completion).`,
                    type: 'INFO',
                    bookingId: booking._id,
                    idempotencyKey: workerNotifyKey,
                });
            }
        }

        // ── 14. Emit Real-Time Socket.IO Booking Update ───────────────────────────
        try {
            const populatedBooking = await Booking.findById(booking._id)
                .populate('customerId', 'name phone email profileImage')
                .populate('workerId', 'name phone email profileImage')
                .populate('serviceCategoryId', 'name icon description');
            const safeDTO = toSafeBookingDTO(populatedBooking || updatedBooking);

            if (booking.workerId) {
                emitToUser(booking.workerId.toString(), 'booking:updated', safeDTO);
                emitToUser(booking.workerId.toString(), 'booking:created', safeDTO);
            }
            if (booking.customerId) {
                emitToUser(booking.customerId.toString(), 'booking:updated', safeDTO);
            }
            emitToRoom(`tracking:${booking._id.toString()}`, 'booking:updated', safeDTO);
        } catch (socketErr) {
            console.warn('[SOCKET:EMIT_ERROR]', socketErr?.message || socketErr);
        }

        return {
            transactionNumber: transaction.transactionNumber,
            alreadyProcessed: false,
        };
    }
}

export const VerifiedPaymentService = new VerifiedPaymentServiceClass();
export default VerifiedPaymentService;
