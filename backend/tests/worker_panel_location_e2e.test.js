/**
 * Worker Panel Real-Time Location & Dynamic GPS End-to-End Test Suite
 * Tests worker real GPS location synchronization, discovery updates, privacy gates, and validation.
 */
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import Booking from '../src/models/Booking.js';
import BookingLocation from '../src/models/BookingLocation.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import config from '../src/config/env.js';

const app = createApp();

async function runWorkerLocationAudit() {
    console.log('================================================================');
    console.log('🚀 WORKER PANEL REAL-TIME LOCATION & GPS E2E AUDIT');
    console.log('================================================================\n');

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(config.MONGODB_URI);
    }

    const timestamp = Date.now();
    let passedCount = 0;
    let totalCount = 0;

    function record(name, isPass, detail) {
        totalCount++;
        if (isPass) {
            passedCount++;
            console.log(`✓ TEST ${totalCount} PASSED: ${name} (${detail})`);
        } else {
            console.error(`✗ TEST ${totalCount} FAILED: ${name} (${detail})`);
        }
    }

    const jwtSecret = config.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'test_jwt_secret_dev_12345';

    // 1. Create Worker User & Profile
    const workerUser = await User.create({
        name: `Worker GPS ${timestamp}`,
        email: `worker_gps_${timestamp}@example.com`,
        phone: `+9199${String(timestamp).slice(-8)}`,
        role: 'WORKER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
    });

    const workerToken = jwt.sign(
        { userId: workerUser._id.toString(), id: workerUser._id.toString(), role: 'WORKER', email: workerUser.email },
        jwtSecret,
        { expiresIn: '1h' }
    );

    let category = await ServiceCategory.findOne({ isActive: true });
    if (!category) {
        category = await ServiceCategory.create({
            name: 'AC Cleaning Service',
            slug: `ac-cleaning-${timestamp}`,
            icon: 'air-conditioner',
            description: 'Professional AC maintenance',
            basePrice: 49900,
            priceUnit: 'HOURLY',
            isActive: true,
        });
    }

    await WorkerProfile.create({
        userId: workerUser._id,
        serviceCategoryIds: [category._id],
        skills: ['AC Repair', 'Cleaning'],
        hourlyRate: 35000,
        dailyRate: 250000,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        verificationBadge: true,
    });

    await WorkerProfile.syncIndexes();

    // 2. Create Customer User
    const customerUser = await User.create({
        name: `Customer GPS ${timestamp}`,
        email: `customer_gps_${timestamp}@example.com`,
        phone: `+9188${String(timestamp).slice(-8)}`,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
    });

    const customerToken = jwt.sign(
        { userId: customerUser._id.toString(), id: customerUser._id.toString(), role: 'CUSTOMER', email: customerUser.email },
        jwtSecret,
        { expiresIn: '1h' }
    );

    // 3. Other User
    const otherUser = await User.create({
        name: `Other User ${timestamp}`,
        email: `other_gps_${timestamp}@example.com`,
        phone: `+9177${String(timestamp).slice(-8)}`,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
    });

    const otherToken = jwt.sign(
        { userId: otherUser._id.toString(), id: otherUser._id.toString(), role: 'CUSTOMER', email: otherUser.email },
        jwtSecret,
        { expiresIn: '1h' }
    );

    try {
        // TEST 1: Worker updates physical GPS location (New Delhi, Delhi)
        const updateLocRes = await request(app)
            .post('/api/v1/worker/location')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({
                latitude: 28.6139,
                longitude: 77.2090,
                city: 'New Delhi',
                state: 'Delhi',
                address: 'Connaught Place, New Delhi, Delhi',
            });

        const profile = await WorkerProfile.findOne({ userId: workerUser._id });
        const pass1 = updateLocRes.status === 200 &&
                      updateLocRes.body.success &&
                      updateLocRes.body.location.latitude === 28.6139 &&
                      profile.location?.coordinates?.[0] === 77.2090 &&
                      profile.location?.coordinates?.[1] === 28.6139 &&
                      profile.city === 'New Delhi';
        record('Worker GPS Location Synchronization', pass1, `lat=28.6139, lng=77.2090, city=${profile.city}`);

        // TEST 2: Customer discovery of worker near updated coordinates
        const searchRes = await request(app)
            .get('/api/v1/workers/search')
            .query({
                categoryId: category._id.toString(),
                latitude: 28.6140,
                longitude: 77.2095,
                maxDistanceKm: 25,
                limit: 50,
            });

        const directMatches = await WorkerProfile.find({
            location: {
                $geoWithin: {
                    $centerSphere: [[77.2095, 28.6140], 25 / 6378.1],
                },
            },
        }).lean();

        console.log('SEARCH_STATUS:', searchRes.status);
        console.log('SEARCH_COUNT:', searchRes.body?.data?.length);
        if (searchRes.body?.data?.length > 0) {
            console.log('FIRST_WORKER_ID:', searchRes.body.data[0].workerId);
        }
        console.log('EXPECTED_WORKER_ID:', workerUser._id.toString());

        const foundWorker = searchRes.body?.data?.find(w => {
            const wid = w.workerId?._id || w.workerId || w.userId || w.id;
            return wid?.toString() === workerUser._id.toString();
        });
        const pass2 = searchRes.status === 200 && Boolean(foundWorker);
        record('Worker Discovery by Real GPS Coordinates', pass2, `Found worker in New Delhi cluster (count=${searchRes.body?.data?.length || 0})`);

        // TEST 3: Invalid GPS Coordinates Rejection
        const invalidRes = await request(app)
            .post('/api/v1/worker/location')
            .set('Authorization', `Bearer ${workerToken}`)
            .send({
                latitude: 150.0000,
                longitude: 77.2090,
            });

        const pass3 = invalidRes.status === 400 && invalidRes.body.success === false;
        record('Invalid Coordinate Rejection', pass3, `HTTP 400 on out-of-range latitude`);

        // TEST 4: Role-based Authorization Guard (Non-Worker blocked)
        const nonWorkerRes = await request(app)
            .post('/api/v1/worker/location')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
                latitude: 28.6139,
                longitude: 77.2090,
            });

        const pass4 = nonWorkerRes.status === 403;
        record('Role-based Location Guard', pass4, `HTTP 403 on non-worker caller`);

        // TEST 5: Privacy Guard: Customer cannot track worker location on PAYMENT_PENDING booking
        const dateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const pendingBooking = await Booking.create({
            bookingNumber: `HLM-TEST-PRIV-${timestamp}`,
            customerId: customerUser._id,
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            serviceAddress: '404 Janpath, New Delhi',
            scheduledStart: new Date(`${dateStr}T11:00:00+05:30`),
            scheduledEnd: new Date(`${dateStr}T13:00:00+05:30`),
            bookingDate: dateStr,
            bookingTime: '11:00 AM',
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 50000,
            platformFee: 5000,
            taxAmount: 4950,
            discountAmount: 0,
            totalAmount: 59950,
            commissionPercentage: 10,
            commissionAmount: 5000,
            workerEarning: 45000,
            bookingStatus: 'PAYMENT_PENDING',
            paymentStatus: 'PENDING',
            escrowStatus: 'NOT_FUNDED',
        });

        const trackResPending = await request(app)
            .get(`/api/v1/bookings/${pendingBooking._id}/location`)
            .set('Authorization', `Bearer ${customerToken}`);

        const pass5 = trackResPending.status === 200 && trackResPending.body.location === null;
        record('Pre-Payment Location Privacy Guard', pass5, `Worker location hidden from customer during PAYMENT_PENDING`);

        // TEST 6: Customer CAN track worker live location once booking is CONFIRMED / WORKER_EN_ROUTE
        const activeBooking = await Booking.create({
            bookingNumber: `HLM-TEST-ACT-${timestamp}`,
            customerId: customerUser._id,
            workerId: workerUser._id,
            serviceCategoryId: category._id,
            serviceAddress: '404 Janpath, New Delhi',
            scheduledStart: new Date(`${dateStr}T11:00:00+05:30`),
            scheduledEnd: new Date(`${dateStr}T13:00:00+05:30`),
            bookingDate: dateStr,
            bookingTime: '11:00 AM',
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 50000,
            platformFee: 5000,
            taxAmount: 4950,
            discountAmount: 0,
            totalAmount: 59950,
            commissionPercentage: 10,
            commissionAmount: 5000,
            workerEarning: 45000,
            bookingStatus: 'WORKER_EN_ROUTE',
            paymentStatus: 'PAID',
            escrowStatus: 'HELD',
        });

        // Worker sends location ping for this active booking
        const pingRes = await request(app)
            .post(`/api/v1/bookings/${activeBooking._id}/location`)
            .set('Authorization', `Bearer ${workerToken}`)
            .send({
                latitude: 28.6150,
                longitude: 77.2100,
                heading: 45,
                speed: 30,
                accuracy: 5,
            });

        // Customer retrieves live location
        const trackResActive = await request(app)
            .get(`/api/v1/bookings/${activeBooking._id}/location`)
            .set('Authorization', `Bearer ${customerToken}`);

        const pass6 = pingRes.status === 200 &&
                      trackResActive.status === 200 &&
                      trackResActive.body.location?.latitude === 28.6150 &&
                      trackResActive.body.location?.longitude === 77.2100;
        record('Authorized Live Tracking', pass6, `Live GPS telemetry streamed to customer (lat=28.6150, lng=77.2100)`);

        // TEST 7: Unauthorized Customer Access Blocked (IDOR Guard)
        const unauthRes = await request(app)
            .get(`/api/v1/bookings/${activeBooking._id}/location`)
            .set('Authorization', `Bearer ${otherToken}`);

        const pass7 = unauthRes.status === 403;
        record('Cross-Customer IDOR Location Guard', pass7, `HTTP 403 Forbidden on unauthorized customer`);

    } finally {
        await User.deleteMany({ _id: { $in: [workerUser._id, customerUser._id, otherUser._id] } });
        await WorkerProfile.deleteMany({ userId: workerUser._id });
        await Booking.deleteMany({ workerId: workerUser._id });
        await BookingLocation.deleteMany({ workerId: workerUser._id });
        await mongoose.disconnect();
    }

    console.log('\n================================================================');
    console.log(`AUDIT SCORE: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
    console.log('================================================================\n');

    if (passedCount === totalCount) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runWorkerLocationAudit().catch((err) => {
    console.error('Fatal Error during audit:', err);
    process.exit(1);
});
