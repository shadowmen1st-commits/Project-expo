import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import WorkerProfile from '../models/WorkerProfile.js';
import { recordTransaction } from './ledger.js';
import LedgerPostingService from './payments/LedgerPostingService.js';
import { emitToUser, emitToRoom } from '../socketServer.js';
import { toSafeBookingDTO } from '../utils/dto.js';

// Strict transition matrix per spec
const ALLOWED_TRANSITIONS = {
    REQUESTED: ['PAYMENT_PENDING', 'CANCELLED', 'REJECTED'],
    PAYMENT_PENDING: ['PAID', 'CANCELLED', 'REJECTED', 'ACCEPTED'],
    PAID: ['ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'REJECTED', 'CANCELLED', 'DISPUTED'],
    ACCEPTED: ['CONFIRMED', 'WORKER_EN_ROUTE', 'CANCELLED', 'REJECTED', 'DISPUTED'],
    REJECTED: [],
    CONFIRMED: ['WORKER_EN_ROUTE', 'STARTED', 'CANCELLED', 'DISPUTED'],
    WORKER_EN_ROUTE: ['STARTED', 'CANCELLED', 'DISPUTED'],
    STARTED: ['COMPLETION_REQUESTED', 'DISPUTED'],
    COMPLETION_REQUESTED: ['COMPLETED', 'DISPUTED'],
    COMPLETED: ['DISPUTED'],
    CANCELLED: [],
    DISPUTED: ['REFUNDED', 'COMPLETED'],
    REFUNDED: [],
};

export class BookingStatusTransitionService {
    /**
     * Transition a booking safely to a new status
     */
    static async transition({
        bookingId,
        targetStatus,
        actor, // { userId, role }
        reason = '',
        notes = '',
        ipAddress = '',
        userAgent = '',
        requestId = '',
        isOverride = false,
    }) {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            const error = new Error('Booking not found');
            error.statusCode = 404;
            error.errorCode = 'BOOKING_NOT_FOUND';
            throw error;
        }

        const previousStatus = booking.bookingStatus;

        // Idempotency check: if already in target status, return safe result
        if (previousStatus === targetStatus) {
            return booking;
        }
        // ACCEPTED is persisted as CONFIRMED; a retried accept must return the original result.
        if (targetStatus === 'ACCEPTED' && previousStatus === 'CONFIRMED' && booking.acceptedAt) {
            return booking;
        }

        const isCustomer = actor?.userId === booking.customerId.toString();
        const isWorker = actor?.userId === booking.workerId.toString();
        const isAdmin = actor?.role === 'ADMIN' || actor?.role === 'SUPER_ADMIN';

        // 1. Ownership & Authorization Check
        if (!isCustomer && !isWorker && !isAdmin) {
            const error = new Error('Unauthorized access to booking.');
            error.statusCode = 403;
            error.errorCode = 'FORBIDDEN';
            throw error;
        }

        // 2. Validate Actor Permissions for target action
        if (!isAdmin && !isOverride) {
            switch (targetStatus) {
                case 'ACCEPTED':
                case 'REJECTED':
                case 'WORKER_EN_ROUTE':
                case 'STARTED':
                case 'COMPLETION_REQUESTED':
                    if (!isWorker) {
                        const error = new Error('Only the assigned worker can perform this status action.');
                        error.statusCode = 403;
                        error.errorCode = 'WORKER_ACTION_ONLY';
                        throw error;
                    }
                    break;
                case 'COMPLETED':
                    if (!isCustomer) {
                        const error = new Error('Only the booking customer can confirm completion.');
                        error.statusCode = 403;
                        error.errorCode = 'CUSTOMER_ACTION_ONLY';
                        throw error;
                    }
                    break;
                case 'CANCELLED':
                case 'DISPUTED':
                    if (!isCustomer && !isWorker) {
                        const error = new Error('Only customer or worker can cancel/dispute.');
                        error.statusCode = 403;
                        error.errorCode = 'UNAUTHORIZED';
                        throw error;
                    }
                    break;
                default:
                    break;
            }
        } else if (isAdmin && isOverride && !reason) {
            const error = new Error('Mandatory reason required for admin override.');
            error.statusCode = 400;
            error.errorCode = 'REASON_REQUIRED';
            throw error;
        }

        // 2.5. Payment verification check for worker actions
        if (!isAdmin && !isOverride && isWorker && ['ACCEPTED', 'WORKER_EN_ROUTE', 'STARTED', 'COMPLETION_REQUESTED'].includes(targetStatus)) {
            if (booking.paymentStatus !== 'PAID') {
                const error = new Error('Worker cannot perform action on unpaid booking.');
                error.statusCode = 402;
                error.errorCode = 'PAYMENT_REQUIRED_FOR_BOOKING_ACTION';
                throw error;
            }
        }

        // 3. Transition Matrix Validation
        const validNextStates = ALLOWED_TRANSITIONS[previousStatus] || [];
        if (!isOverride && !validNextStates.includes(targetStatus)) {
            const error = new Error(`Illegal booking transition from ${previousStatus} to ${targetStatus}.`);
            error.statusCode = 409;
            error.errorCode = 'INVALID_BOOKING_TRANSITION';
            throw error;
        }

        // 4. Update Timestamps & Fields based on state
        const now = new Date();
        booking.bookingStatus = targetStatus;

        if (targetStatus === 'ACCEPTED') {
            booking.acceptedAt = now;
            booking.confirmedAt = now;
            booking.bookingStatus = 'CONFIRMED'; // Automatically transition to CONFIRMED on acceptance
        } else if (targetStatus === 'REJECTED') {
            booking.rejectedAt = now;
            booking.rejectionReason = reason || 'Worker rejected request';
        } else if (targetStatus === 'WORKER_EN_ROUTE') {
            booking.workerEnRouteAt = now;
        } else if (targetStatus === 'STARTED') {
            booking.startedAt = now;
        } else if (targetStatus === 'COMPLETION_REQUESTED') {
            booking.completionRequestedAt = now;
            if (notes) booking.workerNotes = notes;
        } else if (targetStatus === 'COMPLETED') {
            booking.completedAt = now;
            if (booking.paymentStatus === 'PAID') {
                // Post double-entry ledger allocation
                await LedgerPostingService.postBookingCompletionAllocation(
                    booking,
                    actor,
                    { ipAddress, userAgent, requestId }
                );
            } else {
                booking.escrowStatus = 'RELEASED';
            }
            await WorkerProfile.updateOne({ userId: booking.workerId }, { $inc: { completedBookings: 1 } });
        } else if (targetStatus === 'CANCELLED') {
            booking.cancelledAt = now;
            booking.cancellationReason = reason || 'User cancellation';
            booking.cancelledBy = actor.userId;
        } else if (targetStatus === 'DISPUTED') {
            booking.escrowStatus = 'FROZEN';
        } else if (targetStatus === 'REFUNDED') {
            booking.paymentStatus = 'REFUNDED';
            booking.escrowStatus = 'REFUNDED';
        }

        await booking.save();

        // 5. Create Immutable Audit Log
        await new AuditLog({
            actor: actor.userId,
            action: `BOOKING_TRANSITION_${targetStatus}`,
            resourceType: 'Booking',
            resourceId: booking._id.toString(),
            beforeSnapshot: { bookingStatus: previousStatus },
            afterSnapshot: { bookingStatus: booking.bookingStatus, reason },
            ipAddress,
            userAgent,
            requestId,
        }).save();

        // 6. Send Notifications
        const notificationRecipient = isCustomer ? booking.workerId : booking.customerId;
        await new Notification({
            recipientId: notificationRecipient,
            title: `Booking Update: ${targetStatus}`,
            message: `Booking ${booking.bookingNumber} status updated to ${booking.bookingStatus}.`,
            type: targetStatus === 'CANCELLED' || targetStatus === 'REJECTED' ? 'WARNING' : 'SUCCESS',
            bookingId: booking._id,
        }).save();

        // 7. Emit Real-Time Socket.IO Booking Update
        try {
            const populatedBooking = await Booking.findById(booking._id)
                .populate('customerId', 'name phone email profileImage')
                .populate('workerId', 'name phone email profileImage')
                .populate('serviceCategoryId', 'name icon description');
            const safeDTO = toSafeBookingDTO(populatedBooking || booking);

            if (booking.workerId) {
                emitToUser(booking.workerId.toString(), 'booking:updated', safeDTO);
            }
            if (booking.customerId) {
                emitToUser(booking.customerId.toString(), 'booking:updated', safeDTO);
            }
            emitToRoom(`tracking:${booking._id.toString()}`, 'booking:updated', safeDTO);
        } catch (socketErr) {
            console.warn('[SOCKET:EMIT_ERROR]', socketErr?.message || socketErr);
        }

        return booking;
    }
}

export default BookingStatusTransitionService;
