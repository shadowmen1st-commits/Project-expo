/**
 * Payment routes — Customer-facing payment endpoints.
 * All routes require JWT authentication via authMiddleware.
 */
import { Router } from 'express';
import {
    createOrder,
    verifyPayment,
    getPaymentByBooking,
    getPaymentOrderById,
} from '../controllers/paymentOrderController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All customer payment routes require authentication
router.use(authMiddleware);

// Create a Razorpay payment order for a PAYMENT_PENDING booking
router.post('/orders', createOrder);
router.post('/create-order', createOrder);

// Verify Razorpay checkout callback signature
router.post('/verify', verifyPayment);

// Get payment status for a booking (customer's own)
router.get('/booking/:bookingId', getPaymentByBooking);

// Get a specific payment order (customer's own)
router.get('/orders/:paymentOrderId', getPaymentOrderById);

export default router;
