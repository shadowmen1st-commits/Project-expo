import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import { recordTransaction } from '../services/ledger.js';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockWebhookSecret789';
export const initializePayment = async (req, res, next) => {
    const { bookingId } = req.body;
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found.' });
            return;
        }
        if (booking.bookingStatus !== 'REQUESTED') {
            res.status(400).json({ success: false, message: 'Booking is not in payable state.' });
            return;
        }
        // Generate simulated order details
        const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
        booking.bookingStatus = 'PAYMENT_PENDING';
        await booking.save();
        res.status(200).json({
            success: true,
            orderId,
            amount: booking.totalAmount, // in paise
            currency: booking.currency,
            bookingNumber: booking.bookingNumber,
        });
    }
    catch (error) {
        next(error);
    }
};
export const verifyPaymentWebhook = async (req, res, next) => {
    const signature = req.headers['x-razorpay-signature'];
    const payloadBody = JSON.stringify(req.body);
    try {
        // 1. Webhook Signature Verification using HMAC-SHA256
        const expectedSignature = crypto
            .createHmac('sha256', WEBHOOK_SECRET)
            .update(payloadBody)
            .digest('hex');
        // In local testing/mock environments, allow verification if signatures match,
        // or if a header flag bypasses it for simple mock triggers.
        const isMockBypass = req.headers['x-mock-payment'] === 'true';
        if (!isMockBypass && signature !== expectedSignature) {
            res.status(400).json({
                statusCode: 400,
                errorCode: 'SIGNATURE_VERIFICATION_FAILED',
                message: 'Invalid webhook signature.',
            });
            return;
        }
        const { event, payload } = req.body;
        // We process only payment captured events
        if (event === 'payment.captured' || isMockBypass) {
            const paymentDetails = isMockBypass ? req.body : payload.payment.entity;
            const bookingNumber = paymentDetails.notes?.bookingNumber || paymentDetails.description;
            const booking = await Booking.findOne({ bookingNumber });
            if (!booking) {
                res.status(404).json({ success: false, message: 'Booking not found for payment webhook' });
                return;
            }
            if (booking.bookingStatus === 'PAYMENT_PENDING' || booking.bookingStatus === 'REQUESTED') {
                booking.bookingStatus = 'PAID';
                booking.paymentStatus = 'PAID';
                booking.escrowStatus = 'FUNDED';
                await booking.save();
                // Double-entry record: Hold funds in platform escrow
                await recordTransaction({
                    userId: booking.customerId.toString(),
                    bookingId: booking._id.toString(),
                    debitAccount: 'CUSTOMER_BANK',
                    creditAccount: 'PLATFORM_ESCROW',
                    amount: booking.totalAmount,
                    transactionType: 'HOLD',
                    idempotencyKey: `PAY-CAPTURE-${booking._id}`,
                    status: 'COMPLETED',
                });
                // Notify customer
                await new Notification({
                    recipientId: booking.customerId,
                    title: 'Payment Successful',
                    message: `Your payment of ${(booking.totalAmount / 100).toFixed(2)} INR for booking ${booking.bookingNumber} was successful.`,
                    type: 'SUCCESS',
                    bookingId: booking._id,
                }).save();
                // Notify worker
                await new Notification({
                    recipientId: booking.workerId,
                    title: 'New Booking Request',
                    message: `You have received a paid booking request ${booking.bookingNumber}. Please review and accept.`,
                    type: 'INFO',
                    bookingId: booking._id,
                }).save();
            }
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        next(error);
    }
};
