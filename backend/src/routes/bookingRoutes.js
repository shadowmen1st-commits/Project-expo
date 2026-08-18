import { Router } from 'express';
import {
    checkAvailability,
    createBooking,
    getCustomerBookings,
    getWorkerBookings,
    getBookings,
    getBookingDetails,
    acceptBooking,
    rejectBooking,
    markEnRoute,
    startBooking,
    requestCompletion,
    confirmCompletion,
    cancelBooking,
    disputeBooking,
    overrideBookingStatus,
    updateBookingStatus,
    getBookingTracking,
    updateWorkerLocation,
    getWorkerLocation,
    getAdminBookings,
    getAdminLiveTracking,
} from '../controllers/bookingController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Availability & Creation
router.post('/availability/check', checkAvailability);
router.post('/create', createBooking);
router.post('/', createBooking);

// Admin Routes (Placed before :id parameters)
router.get('/admin/live-tracking', getAdminLiveTracking);
router.get('/admin', getAdminBookings);

// Listing & Details
router.get('/customer', getCustomerBookings);
router.get('/worker', getWorkerBookings);
router.get('/list', getBookings);
router.get('/', getBookings);

// Live Tracking & GPS
router.get('/:id/tracking', getBookingTracking);
router.get('/:id/location', getWorkerLocation);
router.post('/:id/location', updateWorkerLocation);
router.patch('/:id/location', updateWorkerLocation);

router.get('/details/:id', getBookingDetails);
router.get('/:id', getBookingDetails);

// Intention-based action endpoints
router.post('/:id/accept', acceptBooking);
router.post('/:id/reject', rejectBooking);
router.post('/:id/en-route', markEnRoute);
router.post('/:id/start', startBooking);
router.post('/:id/request-completion', requestCompletion);
router.post('/:id/confirm-completion', confirmCompletion);
router.post('/:id/cancel', cancelBooking);
router.post('/:id/dispute', disputeBooking);
router.post('/:id/override', overrideBookingStatus);

// Backwards compatibility route
router.post('/update/:id', updateBookingStatus);

export default router;
