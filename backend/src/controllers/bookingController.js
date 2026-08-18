import crypto from 'crypto';
import Booking from '../models/Booking.js';
import PriceQuote from '../models/PriceQuote.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import BookingLocation from '../models/BookingLocation.js';
import { getIO } from '../socketServer.js';
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
import WorkerProfile from '../models/WorkerProfile.js';
import ServiceCategory from '../models/ServiceCategory.js';
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
                serviceCategoryId,
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
            addressSnapshot: inputAddressSnapshot,
            scheduledStart,
            scheduledEnd,
            pricingType,
            customerNotes,
            couponCode,
        } = validatedData;

        // 0. Validate Service Status (Admin Controlled)
        const serviceCat = await ServiceCategory.findById(serviceCategoryId);
        if (!serviceCat || serviceCat.status !== 'ACTIVE' || serviceCat.isActive === false) {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'SERVICE_NOT_AVAILABLE',
                message: 'This service is currently unavailable or inactive.',
            });
            return;
        }

        // Address & Pincode Validation
        let finalServiceAddress = serviceAddress;
        let finalAddressSnapshot = inputAddressSnapshot || {};

        if (inputAddressSnapshot) {
            const { houseNumber, street, locality, landmark, city, state, pincode, addressType, instructions } = inputAddressSnapshot;
            if (!pincode || !/^\d{6}$/.test(pincode)) {
                res.status(400).json({
                    statusCode: 400,
                    errorCode: 'INVALID_PINCODE',
                    message: 'PIN code must be exactly 6 digits.',
                });
                return;
            }
            finalServiceAddress = `${houseNumber}, ${street}${locality ? ', ' + locality : ''}, ${city}, ${state} - ${pincode}`;
            finalAddressSnapshot = {
                houseNumber,
                street,
                locality,
                landmark,
                city,
                state,
                pincode,
                addressType: addressType || 'HOME',
                instructions,
                addressLine: finalServiceAddress,
            };
        } else if (serviceAddress) {
            const pincodeMatch = serviceAddress.match(/\b\d{6}\b/);
            finalAddressSnapshot = {
                addressLine: serviceAddress,
                city: serviceAddress.split(',')[1]?.trim() || 'Local City',
                state: 'State',
                pincode: pincodeMatch ? pincodeMatch[0] : '100000',
            };
        } else {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'ADDRESS_REQUIRED',
                message: 'Service address is required.',
            });
            return;
        }

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
        if (!workerUser || (workerUser.role !== 'WORKER' && workerUser.role !== 'COMPANY') || workerUser.status !== 'ACTIVE') {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'WORKER_NOT_AVAILABLE',
                message: 'Target worker account is not active.',
            });
            return;
        }

        // Validate Worker Verification status & visibility
        const workerProfile = await WorkerProfile.findOne({ userId: workerId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED' || workerProfile.isPubliclyVisible === false) {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'WORKER_NOT_AVAILABLE',
                message: 'Target worker is not verified or approved to accept bookings.',
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
            serviceAddress: finalServiceAddress,
            addressSnapshot: finalAddressSnapshot,
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
    if (!user || (user.role !== 'WORKER' && user.role !== 'COMPANY')) {
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
            : (user.role === 'WORKER' || user.role === 'COMPANY')
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
 * Admin: Get All Bookings across platform with filters, search, and pagination
 * GET /api/v1/bookings/admin
 */
export const getAdminBookings = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({
            success: false,
            statusCode: 403,
            message: 'Forbidden: Admin access required.',
        });
    }

    try {
        const {
            status,
            search,
            page = 1,
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = req.query;

        const query = {};

        // Status Filter
        if (status && status !== 'ALL') {
            query.bookingStatus = status;
        }

        // Search filter (booking number, booking ID, customer name/email, worker name)
        if (search && search.trim()) {
            const term = search.trim();
            const searchRegex = new RegExp(term, 'i');

            // Find matching users (customers or workers)
            const matchedUsers = await User.find({
                $or: [
                    { name: searchRegex },
                    { email: searchRegex },
                    { phone: searchRegex },
                ],
            }).select('_id');
            const matchedUserIds = matchedUsers.map((u) => u._id);

            const searchConditions = [
                { bookingNumber: searchRegex },
                { customerId: { $in: matchedUserIds } },
                { workerId: { $in: matchedUserIds } },
            ];

            // If valid MongoDB ObjectId
            if (term.match(/^[0-9a-fA-F]{24}$/)) {
                searchConditions.push({ _id: term });
            }

            query.$or = searchConditions;
        }

        const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
        const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('customerId', 'name email phone profileImage')
                .populate('workerId', 'name email phone profileImage')
                .populate('serviceCategoryId', 'name icon description')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(take),
            Booking.countDocuments(query),
        ]);

        // Attach latest location status
        const bookingIds = bookings.map((b) => b._id);
        const latestPings = await BookingLocation.aggregate([
            { $match: { bookingId: { $in: bookingIds } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$bookingId',
                    latestLocation: { $first: '$$ROOT' },
                },
            },
        ]);

        const pingMap = new Map();
        latestPings.forEach((p) => {
            pingMap.set(p._id.toString(), p.latestLocation);
        });

        const enrichedBookings = bookings.map((b) => {
            const safeDTO = toSafeBookingDTO(b);
            const ping = pingMap.get(b._id.toString());
            return {
                ...safeDTO,
                customer: b.customerId,
                worker: b.workerId,
                category: b.serviceCategoryId,
                latestLocation: ping
                    ? {
                          latitude: ping.latitude,
                          longitude: ping.longitude,
                          heading: ping.heading,
                          speed: ping.speed,
                          accuracy: ping.accuracy,
                          timestamp: ping.timestamp || ping.createdAt,
                      }
                    : null,
                isTrackingActive: ['CONFIRMED', 'PAID', 'WORKER_EN_ROUTE', 'IN_PROGRESS', 'ARRIVED', 'STARTED'].includes(b.bookingStatus),
            };
        });

        res.status(200).json({
            success: true,
            bookings: enrichedBookings,
            pagination: {
                total,
                page: parseInt(page, 10),
                limit: take,
                totalPages: Math.ceil(total / take) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get All Active Bookings with Live GPS Tracking
 * GET /api/v1/bookings/admin/live-tracking
 */
export const getAdminLiveTracking = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return res.status(403).json({
            success: false,
            statusCode: 403,
            message: 'Forbidden: Admin access required.',
        });
    }

    try {
        const activeStatuses = ['WORKER_EN_ROUTE', 'IN_PROGRESS', 'CONFIRMED', 'PAID', 'ARRIVED', 'STARTED'];
        const activeBookings = await Booking.find({ bookingStatus: { $in: activeStatuses } })
            .populate('customerId', 'name email phone profileImage')
            .populate('workerId', 'name email phone profileImage')
            .populate('serviceCategoryId', 'name icon description')
            .sort({ updatedAt: -1 })
            .limit(100);

        const bookingIds = activeBookings.map((b) => b._id);
        const latestPings = await BookingLocation.aggregate([
            { $match: { bookingId: { $in: bookingIds } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$bookingId',
                    latestLocation: { $first: '$$ROOT' },
                },
            },
        ]);

        const pingMap = new Map();
        latestPings.forEach((p) => {
            pingMap.set(p._id.toString(), p.latestLocation);
        });

        const trackingList = activeBookings.map((b) => {
            const ping = pingMap.get(b._id.toString());
            return {
                bookingId: b._id.toString(),
                bookingNumber: b.bookingNumber || b._id.toString().substring(0, 8),
                bookingStatus: b.bookingStatus,
                paymentStatus: b.paymentStatus,
                customer: b.customerId,
                worker: b.workerId,
                category: b.serviceCategoryId,
                serviceAddress: b.serviceAddress,
                addressSnapshot: b.addressSnapshot,
                totalAmountPaise: b.totalAmountPaise,
                totalAmount: b.totalAmountPaise ? b.totalAmountPaise / 100 : b.totalAmount,
                createdAt: b.createdAt,
                updatedAt: b.updatedAt,
                latestLocation: ping
                    ? {
                          latitude: ping.latitude,
                          longitude: ping.longitude,
                          heading: ping.heading,
                          speed: ping.speed,
                          accuracy: ping.accuracy,
                          timestamp: ping.timestamp || ping.createdAt,
                      }
                    : null,
            };
        });

        res.status(200).json({
            success: true,
            count: trackingList.length,
            activeBookings: trackingList,
        });
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
        const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Your account must be APPROVED to accept bookings.'
            });
        }
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
        const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Your account must be APPROVED to start service.'
            });
        }
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
        const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Your account must be APPROVED to request completion.'
            });
        }
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

/**
 * Get Booking Tracking Data
 * GET /api/v1/bookings/:id/tracking
 */
export const getBookingTracking = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, statusCode: 401, message: 'Authentication required' });
        }

        const booking = await Booking.findById(id)
            .populate('customerId', 'name phone email profileImage')
            .populate('workerId', 'name phone email profileImage')
            .populate('serviceCategoryId', 'name icon description');

        if (!booking) {
            return res.status(404).json({ success: false, statusCode: 404, message: 'Booking not found.' });
        }

        const customerIdStr = booking.customerId?._id?.toString() || booking.customerId?.toString();
        const workerIdStr = booking.workerId?._id?.toString() || booking.workerId?.toString();
        const userIdStr = user.id || user._id || user.userId;

        const isCustomer = userIdStr === customerIdStr;
        const isWorker = userIdStr === workerIdStr;
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        const isCompany = user.role === 'COMPANY';

        if (!isCustomer && !isWorker && !isAdmin && !isCompany) {
            return res.status(403).json({ success: false, statusCode: 403, message: 'Access denied to this booking tracking.' });
        }

        // Get latest location ping
        const latestLocationDoc = await BookingLocation.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
        
        let latestLocation = null;
        if (latestLocationDoc) {
            latestLocation = {
                latitude: latestLocationDoc.latitude,
                longitude: latestLocationDoc.longitude,
                heading: latestLocationDoc.heading,
                speed: latestLocationDoc.speed,
                accuracy: latestLocationDoc.accuracy,
                timestamp: latestLocationDoc.timestamp || latestLocationDoc.createdAt,
            };
        } else {
            // Fallback to worker profile location if available
            const workerProf = await WorkerProfile.findOne({ userId: booking.workerId?._id || booking.workerId });
            if (workerProf && workerProf.location?.coordinates?.length === 2) {
                latestLocation = {
                    longitude: workerProf.location.coordinates[0],
                    latitude: workerProf.location.coordinates[1],
                    heading: 0,
                    speed: 0,
                    accuracy: 10,
                    timestamp: workerProf.updatedAt || new Date(),
                };
            }
        }

        return res.status(200).json({
            success: true,
            booking: toSafeBookingDTO(booking),
            serviceAddress: booking.serviceAddress,
            addressSnapshot: booking.addressSnapshot,
            latestLocation,
            trackingEnabled: ['PAID', 'ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'ARRIVED', 'STARTED', 'COMPLETION_REQUESTED', 'COMPLETED'].includes(booking.bookingStatus),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update Worker GPS Location
 * POST /api/v1/bookings/:id/location
 */
export const updateWorkerLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, statusCode: 401, message: 'Authentication required' });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, statusCode: 404, message: 'Booking not found.' });
        }

        const workerIdStr = booking.workerId?._id?.toString() || booking.workerId?.toString();
        const userIdStr = user.id || user._id || user.userId;

        if (userIdStr !== workerIdStr && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, statusCode: 403, message: 'Only the assigned worker can update location.' });
        }

        const { latitude, longitude, heading = 0, speed = 0, accuracy = 0 } = req.body;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ success: false, statusCode: 400, message: 'Valid latitude and longitude are required.' });
        }

        const locationPing = await BookingLocation.create({
            bookingId: booking._id,
            workerId: booking.workerId,
            latitude,
            longitude,
            heading,
            speed,
            accuracy,
            timestamp: new Date(),
        });

        // Also update WorkerProfile location for discovery
        await WorkerProfile.findOneAndUpdate(
            { userId: booking.workerId },
            {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
            }
        );

        // Emit Socket.IO event to booking tracking room
        try {
            const io = getIO();
            const payload = {
                bookingId: booking._id.toString(),
                workerId: booking.workerId?._id?.toString() || booking.workerId?.toString() || '',
                latitude,
                longitude,
                heading,
                speed,
                accuracy,
                timestamp: locationPing.timestamp,
            };
            io.to(`tracking:${booking._id.toString()}`).emit('location:updated', payload);
            io.to(`conversation:${booking._id.toString()}`).emit('location:updated', payload);
        } catch (socketErr) {
            // Non-blocking socket broadcast error
        }

        return res.status(200).json({
            success: true,
            location: {
                latitude,
                longitude,
                heading,
                speed,
                accuracy,
                timestamp: locationPing.timestamp,
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get Current Worker GPS Location Ping
 * GET /api/v1/bookings/:id/location
 */
export const getWorkerLocation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, statusCode: 401, message: 'Authentication required' });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, statusCode: 404, message: 'Booking not found.' });
        }

        const customerIdStr = booking.customerId?._id?.toString() || booking.customerId?.toString();
        const workerIdStr = booking.workerId?._id?.toString() || booking.workerId?.toString();
        const userIdStr = user.id || user._id || user.userId;

        const isCustomer = userIdStr === customerIdStr;
        const isWorker = userIdStr === workerIdStr;
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
        const isCompany = user.role === 'COMPANY';

        if (!isCustomer && !isWorker && !isAdmin && !isCompany) {
            return res.status(403).json({ success: false, statusCode: 403, message: 'Access denied.' });
        }

        const latestLocationDoc = await BookingLocation.findOne({ bookingId: booking._id }).sort({ createdAt: -1 });
        if (latestLocationDoc) {
            return res.status(200).json({
                success: true,
                location: {
                    latitude: latestLocationDoc.latitude,
                    longitude: latestLocationDoc.longitude,
                    heading: latestLocationDoc.heading,
                    speed: latestLocationDoc.speed,
                    accuracy: latestLocationDoc.accuracy,
                    timestamp: latestLocationDoc.timestamp,
                },
            });
        }

        const workerProf = await WorkerProfile.findOne({ userId: booking.workerId });
        if (workerProf && workerProf.location?.coordinates?.length === 2) {
            return res.status(200).json({
                success: true,
                location: {
                    longitude: workerProf.location.coordinates[0],
                    latitude: workerProf.location.coordinates[1],
                    heading: 0,
                    speed: 0,
                    accuracy: 10,
                    timestamp: workerProf.updatedAt,
                },
            });
        }

        return res.status(200).json({
            success: true,
            location: null,
            message: 'No location ping recorded yet.',
        });
    } catch (err) {
        next(err);
    }
};


