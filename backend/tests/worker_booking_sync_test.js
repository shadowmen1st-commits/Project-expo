import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import Booking from '../src/models/Booking.js';
import PaymentOrder from '../src/models/PaymentOrder.js';
import PaymentTransaction from '../src/models/PaymentTransaction.js';
import WorkerWallet from '../src/models/WorkerWallet.js';
import request from 'supertest';
import crypto from 'crypto';
import { signAccessToken } from '../src/utils/authUtils.js';

function generateToken(user) {
    return signAccessToken({
        userId: user._id.toString(),
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        tokenId: crypto.randomUUID(),
    });
}

async function runWorkerSyncTests() {
    console.log('--- STARTING WORKER BOOKING SYNC & REAL DATA TESTS ---');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hyperlocal_db');
    const app = createApp();

    const testSuffix = Date.now();
    const phoneCustomer = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneWorkerA = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneWorkerB = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

    // 1. Create Category
    const category = await ServiceCategory.create({
        name: `Electrician Pro ${testSuffix}`,
        slug: `electrician-pro-${testSuffix}`,
        description: 'Electrical and wiring repairs',
        basePricePaise: 50000,
        status: 'ACTIVE',
        isActive: true,
    });

    // 2. Create Customer
    const customer = await User.create({
        name: `Rohan Customer ${testSuffix}`,
        email: `customer_${testSuffix}@example.com`,
        phone: phoneCustomer,
        role: 'CUSTOMER',
        status: 'ACTIVE',
    });
    const customerToken = generateToken(customer);

    // 3. Create Worker A
    const workerA = await User.create({
        name: `Vikram Electrician A ${testSuffix}`,
        email: `workerA_${testSuffix}@example.com`,
        phone: phoneWorkerA,
        role: 'WORKER',
        status: 'ACTIVE',
    });
    const workerAToken = generateToken(workerA);

    await WorkerProfile.create({
        userId: workerA._id,
        serviceCategoryIds: [category._id],
        hourlyRate: 500,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
    });

    // 4. Create Worker B (for isolation check)
    const workerB = await User.create({
        name: `Amit Plumber B ${testSuffix}`,
        email: `workerB_${testSuffix}@example.com`,
        phone: phoneWorkerB,
        role: 'WORKER',
        status: 'ACTIVE',
    });
    const workerBToken = generateToken(workerB);

    await WorkerProfile.create({
        userId: workerB._id,
        serviceCategoryIds: [category._id],
        hourlyRate: 600,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
    });

    console.log('✓ Users and Profiles created successfully.');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const scheduledStart = new Date(`${dateStr}T11:00:00+05:30`).toISOString();
    const scheduledEnd = new Date(`${dateStr}T13:00:00+05:30`).toISOString();

    // 5. Customer creates booking for Worker A
    const bookingRes = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
            workerId: workerA._id.toString(),
            serviceCategoryId: category._id.toString(),
            scheduledStart,
            scheduledEnd,
            bookingDate: dateStr,
            bookingTime: '11:00 AM',
            pricingType: 'HOURLY',
            serviceAddress: 'Flat 402, Sunshine Heights, Connaught Place, New Delhi - 110001',
            addressSnapshot: {
                houseNumber: 'Flat 402',
                street: 'Sunshine Heights',
                locality: 'Connaught Place',
                city: 'New Delhi',
                state: 'Delhi',
                pincode: '110001',
                addressLine: 'Flat 402, Sunshine Heights, Connaught Place, New Delhi - 110001',
            },
            customerNotes: 'Please carry heavy duty wiring tools.',
        });

    if (bookingRes.status !== 201 || !bookingRes.body.booking) {
        throw new Error(`Booking creation failed: ${JSON.stringify(bookingRes.body)}`);
    }
    const booking = bookingRes.body.booking;
    const bookingId = booking.id || booking._id;
    console.log('✓ Booking created:', bookingId, 'Status:', booking.bookingStatus);

    // 6. Complete Payment flow for Booking
    // Create Payment Order
    const orderRes = await request(app)
        .post('/api/v1/payments/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', `idem-${Date.now()}-ord`)
        .send({ bookingId });

    if (orderRes.status !== 201) {
        throw new Error(`Payment order creation failed: ${JSON.stringify(orderRes.body)}`);
    }
    const paymentOrderData = orderRes.body.data;
    const internalPaymentOrderId = paymentOrderData.internalPaymentOrderId;
    const razorpayOrderId = paymentOrderData.razorpayOrderId;
    const razorpayPaymentId = `pay_mock_${Date.now()}`;

    // Compute signature with provider key secret
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret_key_12345';
    const bodyToSign = `${razorpayOrderId}|${razorpayPaymentId}`;
    const razorpaySignature = crypto.createHmac('sha256', keySecret).update(bodyToSign).digest('hex');

    // Verify Payment
    const verifyRes = await request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
            internalPaymentOrderId,
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
        });

    if (verifyRes.status !== 200 || !verifyRes.body.success) {
        throw new Error(`Payment verification failed: ${JSON.stringify(verifyRes.body)}`);
    }
    console.log('✓ Payment verified successfully. Booking is now PAID.');

    // 7. Verify Worker A gets the real assigned booking with all fields populated
    const workerABookingsRes = await request(app)
        .get('/api/v1/bookings/worker')
        .set('Authorization', `Bearer ${workerAToken}`);

    if (workerABookingsRes.status !== 200 || !workerABookingsRes.body.bookings) {
        throw new Error(`Worker A fetch failed: ${JSON.stringify(workerABookingsRes.body)}`);
    }

    const assignedToA = workerABookingsRes.body.bookings.find(b => (b.id || b._id) === bookingId);
    if (!assignedToA) {
        throw new Error('Worker A did not receive the assigned booking!');
    }

    if (assignedToA.customer?.name !== `Rohan Customer ${testSuffix}`) {
        throw new Error(`Customer name mismatch on Worker A panel: ${assignedToA.customer?.name}`);
    }
    if (assignedToA.customer?.phone !== phoneCustomer) {
        throw new Error(`Customer phone mismatch on Worker A panel: expected ${phoneCustomer}, got ${assignedToA.customer?.phone}`);
    }
    if (!assignedToA.category?.name.includes('Electrician Pro')) {
        throw new Error(`Category name mismatch on Worker A panel: ${assignedToA.category?.name}`);
    }
    if (assignedToA.bookingStatus !== 'PAID') {
        throw new Error(`Booking status mismatch on Worker A panel: expected PAID, got ${assignedToA.bookingStatus}`);
    }
    console.log('✓ Worker A received real booking with customer details, phone, category, and PAID status.');

    // 8. Verify Worker B does NOT see Worker A's booking (Worker Isolation Check)
    const workerBBookingsRes = await request(app)
        .get('/api/v1/bookings/worker')
        .set('Authorization', `Bearer ${workerBToken}`);

    const seenByB = workerBBookingsRes.body.bookings?.find(b => (b.id || b._id) === bookingId);
    if (seenByB) {
        throw new Error('SECURITY BREACH: Worker B saw Worker A assigned booking!');
    }
    console.log('✓ Worker B isolation confirmed (Worker B cannot see Worker A bookings).');

    // 9. Worker A accepts booking
    const acceptRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${workerAToken}`);

    if (acceptRes.status !== 200 || acceptRes.body.booking?.bookingStatus !== 'CONFIRMED') {
        throw new Error(`Accept booking failed: ${JSON.stringify(acceptRes.body)}`);
    }
    console.log('✓ Worker A accepted booking -> Status CONFIRMED.');

    // 10. Worker A marks en-route
    const enRouteRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/en-route`)
        .set('Authorization', `Bearer ${workerAToken}`);

    if (enRouteRes.status !== 200 || enRouteRes.body.booking?.bookingStatus !== 'WORKER_EN_ROUTE') {
        throw new Error(`Mark en-route failed: ${JSON.stringify(enRouteRes.body)}`);
    }
    console.log('✓ Worker A marked en-route -> Status WORKER_EN_ROUTE.');

    // 11. Worker A starts job
    const startRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/start`)
        .set('Authorization', `Bearer ${workerAToken}`);

    if (startRes.status !== 200 || startRes.body.booking?.bookingStatus !== 'STARTED') {
        throw new Error(`Start job failed: ${JSON.stringify(startRes.body)}`);
    }
    console.log('✓ Worker A started job -> Status STARTED.');

    // 12. Worker A requests completion
    const completeReqRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/request-completion`)
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ notes: 'Rewired the circuit breaker successfully.' });

    if (completeReqRes.status !== 200 || completeReqRes.body.booking?.bookingStatus !== 'COMPLETION_REQUESTED') {
        throw new Error(`Request completion failed: ${JSON.stringify(completeReqRes.body)}`);
    }
    console.log('✓ Worker A requested completion -> Status COMPLETION_REQUESTED.');

    // 13. Customer confirms completion
    const confirmRes = await request(app)
        .post(`/api/v1/bookings/${bookingId}/confirm-completion`)
        .set('Authorization', `Bearer ${customerToken}`);

    if (confirmRes.status !== 200 || confirmRes.body.booking?.bookingStatus !== 'COMPLETED') {
        throw new Error(`Confirm completion failed: ${JSON.stringify(confirmRes.body)}`);
    }
    console.log('✓ Customer confirmed completion -> Status COMPLETED.');

    // 14. Verify Worker A wallet balance & ledger history
    const walletRes = await request(app)
        .get('/api/wallet/details')
        .set('Authorization', `Bearer ${workerAToken}`);

    if (walletRes.status !== 200 || !walletRes.body.balances) {
        throw new Error(`Worker wallet fetch failed: ${JSON.stringify(walletRes.body)}`);
    }
    const totalFunds = walletRes.body.balances.available + walletRes.body.balances.pending + walletRes.body.balances.totalEarned;
    if (totalFunds <= 0) {
        throw new Error(`Worker total/pending/available balance should be > 0, got: ${JSON.stringify(walletRes.body.balances)}`);
    }
    console.log('✓ Worker A wallet updated with real completed earnings:', walletRes.body.balances);

    console.log('====================================================');
    console.log('ALL WORKER BOOKING REAL DATA SYNC TESTS PASSED 100%!');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
}

runWorkerSyncTests().catch((err) => {
    console.error('WORKER SYNC TEST FAILED:', err);
    process.exit(1);
});
