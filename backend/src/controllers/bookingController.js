import crypto from 'crypto';
import Booking from '../models/Booking.js';
import PriceQuote from '../models/PriceQuote.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {
    availabilityCheckSchema,
    bookingCreateSchema,
    bookingCancelSchema,
    bookingRejectSchema,
    bookingDisputeSchema,
    bookingOverrideSchema,
} from '../utils/validation.js';
import PricingService from '../services/PricingService.js';
import AvailabilityService from '../services/availabilityService.js';
import BookingStatusTransitionService from '../services/BookingStatusTransitionService.js';
import { toSafeBookingDTO } from '../utils/dto.js';

/**
 * Check Worker Availability & Calculate Price Preview
 * POST /api/v1/bookings/availability/check
 */
export const checkAvailability = async (req, res, next) => {
    try {
        const validated = availabilityCheckSchema.parse(req.body);
        const { workerId, serviceCategoryId, scheduledStart, scheduledEnd, pricingType } = validated;

        const availabilityResult = await AvailabilityService.validateAvailability({
            workerId,
            serviceCategoryId,
            scheduledStart,
            scheduledEnd,
            pricingType,
        });

        let pricePreview = null;
        if (serviceCategoryId) {
            pricePreview = await PricingService.calculatePrice({
                workerId,
                categoryId: serviceCategoryId,
                scheduledStart,
                scheduledEnd,
                pricingType: pricingType || 'HOURLY',
            });
        }

        res.status(200).json({
            success: true,
            available: true,
            bufferMinutes: availabilityResult.bufferMinutes,
            durationMinutes: availabilityResult.durationMinutes,
            pricePreview,
        });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({
                success: false,
                statusCode: error.statusCode,
                errorCode: error.errorCode || 'AVAILABILITY_ERROR',
                message: error.message,
            });
            return;
        }
        next(error);
    }
};

/**
 * Create New Secure Booking with Atomic Server PriceQuote Consumption
 * POST /api/v1/bookings
 */
export const createBooking = async (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'CUSTOMER') {
        res.status(403).json({
            statusCode: 403,
            errorCode: 'FORBIDDEN',
            message: 'Only customers can book services.',
        });
        return;
    }

    try {
        const validatedData = bookingCreateSchema.parse(req.body);
        const {
            quoteId,
            workerId,
            serviceCategoryId,
            serviceAddress,
            scheduledStart,
            scheduledEnd,
            pricingType,
            customerNotes,
            couponCode,
        } = validatedData;

        // 1. Prevent Self-Booking
        if (workerId === user.userId) {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'SELF_BOOKING_PREVENTED',
                message: 'You cannot book yourself as a worker.',
            });
            return;
        }

        // 2. Validate Target Worker
        const workerUser = await User.findById(workerId);
        if (!workerUser || workerUser.role !== 'WORKER' || workerUser.status !== 'ACTIVE') {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'WORKER_NOT_AVAILABLE',
                message: 'Target worker account is not active.',
            });
            return;
        }

        // 3. Validate Backend Availability & Double-Booking Overlap
        await AvailabilityService.validateAvailability({
            workerId,
            serviceCategoryId,
            scheduledStart,
            scheduledEnd,
            pricingType,
        });

        // 4. Resolve Authoritative Pricing Snapshot (via server-side quoteId or live PricingService)
        let priceDetails;
        let activeQuote = null;

        if (quoteId) {
            activeQuote = await PriceQuote.findById(quoteId);
            if (!activeQuote) {
                res.status(404).json({
                    statusCode: 404,
                    errorCode: 'PRICE_QUOTE_NOT_FOUND',
                    message: 'Server price quote not found.',
                });
                return;
            }

            if (activeQuote.customerId.toString() !== user.userId) {
                res.status(403).json({
                    statusCode: 403,
                    errorCode: 'PRICE_QUOTE_OWNERSHIP_ERROR',
                    message: 'Price quote belongs to another customer.',
                });
                return;
            }

            if (activeQuote.status === 'CONSUMED') {
                res.status(409).json({
                    statusCode: 409,
                    errorCode: 'PRICE_QUOTE_ALREADY_USED',
                    message: 'This price quote has already been consumed.',
                });
                return;
            }

            if (activeQuote.status !== 'ACTIVE' || activeQuote.expiresAt < new Date()) {
                activeQuote.status = 'EXPIRED';
                await activeQuote.save();
                res.status(409).json({
                    statusCode: 409,
                    errorCode: 'PRICE_QUOTE_EXPIRED',
                    message: 'Price quote has expired. Please recalculate price.',
                });
                return;
            }

            priceDetails = {
                baseAmount: activeQuote.pricingSnapshot.baseAmountPaise,
                platformFee: activeQuote.pricingSnapshot.platformFeeAmountPaise,
                taxAmount: activeQuote.pricingSnapshot.taxAmountPaise,
                discountAmount: activeQuote.pricingSnapshot.discountAmountPaise,
                totalAmount: activeQuote.pricingSnapshot.customerTotalPaise,
                commissionPercentage: (activeQuote.pricingSnapshot.commissionPercentageBps || 1000) / 100,
                commissionAmount: activeQuote.pricingSnapshot.commissionAmountPaise,
                workerEarning: activeQuote.pricingSnapshot.workerEarningPaise,
                pricingSnapshot: activeQuote.pricingSnapshot,
            };
        } else {
            // Direct Authoritative Calculation Fallback
            priceDetails = await PricingService.calculatePrice({
                workerId,
                serviceCategoryId,
                scheduledStart,
                scheduledEnd,
                pricingType,
                couponCode,
                customerId: user.userId,
            });
        }

        // 5. Generate Unique Booking Number
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
        const bookingNumber = `HLM-${dateStr}-${rand}`;

        const startDate = new Date(scheduledStart);
        const endDate = new Date(scheduledEnd);
        const durationMinutes = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60));

        // 6. Create Booking Record in PAYMENT_PENDING state
        const booking = new Booking({
            bookingNumber,
            quoteId: activeQuote ? activeQuote._id : null,
            customerId: user.userId,
            workerId,
            serviceCategoryId,
            serviceAddress,
            scheduledStart: startDate,
            scheduledEnd: endDate,
            durationMinutes,
            pricingType,
            baseAmount: priceDetails.baseAmount,
            platformFee: priceDetails.platformFee,
            taxAmount: priceDetails.taxAmount,
            discountAmount: priceDetails.discountAmount,
            totalAmount: priceDetails.totalAmount,
            commissionPercentage: priceDetails.commissionPercentage,
            commissionAmount: priceDetails.commissionAmount,
            workerEarning: priceDetails.workerEarning,
            pricingSnapshot: priceDetails.pricingSnapshot,
            currency: 'INR',
            bookingStatus: 'PAYMENT_PENDING',
            paymentStatus: 'PENDING',
            escrowStatus: 'NOT_FUNDED',
            customerNotes,
        });

        await booking.save();

        // 7. Mark PriceQuote CONSUMED Atomically
        if (activeQuote) {
            activeQuote.status = 'CONSUMED';
            activeQuote.consumedAt = new Date();
            activeQuote.bookingId = booking._id;
            await activeQuote.save();
        }

        // 8. Create Customer Notification
        await new Notification({
            recipientId: user.userId,
            title: 'Booking Created',
            message: `Booking ${bookingNumber} created. Payment setup is pending.`,
            type: 'INFO',
            bookingId: booking._id,
        }).save();

        res.status(201).json({
            success: true,
            message: 'Booking created successfully. Secure payment setup is pending.',
            booking: toSafeBookingDTO(booking),
        });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({
                success: false,
                statusCode: error.statusCode,
                errorCode: error.errorCode || 'BOOKING_CREATION_FAILED',
                message: error.message,
            });
            return;
        }
        next(error);
    }
};

/**
 * Get Customer Bookings
 * GET /api/v1/bookings/customer
 */
export const getCustomerBookings = async (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'CUSTOMER') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = { customerId: user.userId };
        if (status) query.bookingStatus = status;

        const skip = (Number(page) - 1) * Number(limit);
        const bookings = await Booking.find(query)
            .populate('customerId', 'name profileImage')
            .populate('workerId', 'name profileImage')
            .populate('serviceCategoryId', 'name icon description')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Booking.countDocuments(query);
        res.status(200).json({
            success: true,
            bookings: bookings.map(toSafeBookingDTO),
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Worker Assigned Bookings
 * GET /api/v1/bookings/worker
 */
export const getWorkerBookings = async (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'WORKER') {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = { workerId: user.userId };
        if (status) query.bookingStatus = status;

        const skip = (Number(page) - 1) * Number(limit);
        const bookings = await Booking.find(query)
            .populate('customerId', 'name profileImage')
            .populate('workerId', 'name profileImage')
            .populate('serviceCategoryId', 'name icon description')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Booking.countDocuments(query);
        res.status(200).json({
            success: true,
            bookings: bookings.map(toSafeBookingDTO),
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get General Booking List
 * GET /api/v1/bookings
 */
export const getBookings = async (req, res, next) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    try {
        const filter = user.role === 'CUSTOMER'
            ? { customerId: user.userId }
            : user.role === 'WORKER'
            ? { workerId: user.userId }
            : {};

        const bookings = await Booking.find(filter)
            .populate('customerId', 'name profileImage')
            .populate('workerId', 'name profileImage')
            .populate('serviceCategoryId', 'name icon')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, bookings: bookings.map(toSafeBookingDTO) });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Booking Details by ID
 * GET /api/v1/bookings/:bookingId
 */
export const getBookingDetails = async (req, res, next) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const booking = await Booking.findById(id)
            .populate('customerId', 'name profileImage')
            .populate('workerId', 'name profileImage')
            .populate('serviceCategoryId', 'name icon description');

        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found.' });
            return;
        }

        const isCustomer = user?.userId === booking.customerId._id.toString();
        const isWorker = user?.userId === booking.workerId._id.toString();
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

        if (!isCustomer && !isWorker && !isAdmin) {
            res.status(403).json({ success: false, message: 'Unauthorized access to booking.' });
            return;
        }

        res.status(200).json({ success: true, booking: toSafeBookingDTO(booking) });
    } catch (error) {
        next(error);
    }
};

export const acceptBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'ACCEPTED',
            actor: req.user,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Booking accepted.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const rejectBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = bookingRejectSchema.parse(req.body);
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'REJECTED',
            actor: req.user,
            reason: validated.reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Booking rejected.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const markEnRoute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'WORKER_EN_ROUTE',
            actor: req.user,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Worker is en route.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const startBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'STARTED',
            actor: req.user,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Service started.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const requestCompletion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'COMPLETION_REQUESTED',
            actor: req.user,
            notes: req.body?.notes || '',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Completion requested. Awaiting customer confirmation.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const confirmCompletion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'COMPLETED',
            actor: req.user,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Job completion confirmed.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const cancelBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = bookingCancelSchema.parse(req.body);
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'CANCELLED',
            actor: req.user,
            reason: validated.reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Booking cancelled.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const disputeBooking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const validated = bookingDisputeSchema.parse(req.body);
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: 'DISPUTED',
            actor: req.user,
            reason: validated.reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Dispute raised.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const overrideBookingStatus = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    try {
        const { id } = req.params;
        const validated = bookingOverrideSchema.parse(req.body);
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: validated.status,
            actor: req.user,
            reason: validated.reason,
            isOverride: true,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, message: 'Admin override applied.', booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'TRANSITION_ERROR', message: error.message });
            return;
        }
        next(error);
    }
};

export const updateBookingStatus = async (req, res, next) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    try {
        const updated = await BookingStatusTransitionService.transition({
            bookingId: id,
            targetStatus: status,
            actor: req.user,
            reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.status(200).json({ success: true, booking: toSafeBookingDTO(updated) });
    } catch (error) {
        if (error.statusCode) {
            res.status(error.statusCode).json({ success: false, statusCode: error.statusCode, errorCode: error.errorCode || 'INVALID_TRANSITION', message: error.message });
            return;
        }
        next(error);
    }
};
