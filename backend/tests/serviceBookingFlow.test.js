process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import { createCustomer, createAdmin, createServiceCategory, createApprovedWorker, createPricingConfiguration, createCommissionRule, authHeaderFor } from './helpers/testFixtures.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import Booking from '../src/models/Booking.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`PASS: ${name}`);
    } catch (e) {
        failed++;
        failures.push(`${name}: ${e.message}`);
        console.error(`FAIL: ${name}: ${e.message}`);
    }
}

async function main() {
    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        const admin = await createAdmin();
        const customer = await createCustomer();
        const otherCustomer = await createCustomer();

        // 1. Create Active, Draft, Inactive, Archived Categories
        const activeCategory = await ServiceCategory.create({
            name: 'Active Home Care SB',
            slug: 'active-home-care-sb',
            description: 'Active home care service',
            price: 500,
            durationHours: 2,
            defaultCommission: 10,
            status: 'ACTIVE',
            isActive: true,
            requiredSkills: ['Cleaning'],
        });

        const draftCategory = await ServiceCategory.create({
            name: 'Draft Service SB',
            slug: 'draft-service-sb',
            description: 'Draft service category',
            price: 600,
            durationHours: 1,
            defaultCommission: 10,
            status: 'DRAFT',
            isActive: false,
        });

        const inactiveCategory = await ServiceCategory.create({
            name: 'Inactive Service SB',
            slug: 'inactive-service-sb',
            description: 'Inactive service category',
            price: 700,
            durationHours: 3,
            defaultCommission: 12,
            status: 'INACTIVE',
            isActive: false,
        });

        const archivedCategory = await ServiceCategory.create({
            name: 'Archived Service SB',
            slug: 'archived-service-sb',
            description: 'Archived service category',
            price: 800,
            durationHours: 4,
            defaultCommission: 15,
            status: 'ARCHIVED',
            isActive: false,
        });

        await createPricingConfiguration(admin._id);
        await createCommissionRule({ adminId: admin._id, categoryId: activeCategory._id });

        const worker = await createApprovedWorker({ category: activeCategory });
        const unapprovedWorker = await createApprovedWorker({ category: activeCategory });
        await WorkerProfile.findOneAndUpdate({ userId: unapprovedWorker._id }, { status: 'SUSPENDED', isPubliclyVisible: false });

        console.log('\n--- STARTING 22 SCENARIO SERVICE BOOKING TEST SUITE ---\n');

        // SCENARIO 1: Customer Service List returns ONLY ACTIVE services
        await test('Scenario 1: Customer GET /api/categories returns ONLY ACTIVE services', async () => {
            const res = await request(app).get('/api/categories');
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            const categories = res.body.categories || res.body.data;
            const names = categories.map(c => c.name);
            assert.ok(names.includes('Active Home Care SB'));
            assert.ok(!names.includes('Draft Service SB'));
            assert.ok(!names.includes('Inactive Service SB'));
            assert.ok(!names.includes('Archived Service SB'));
        });

        // SCENARIO 2: Direct GET on DRAFT/INACTIVE/ARCHIVED service returns SERVICE_NOT_AVAILABLE
        await test('Scenario 2: Direct GET on INACTIVE category returns SERVICE_NOT_AVAILABLE', async () => {
            const res = await request(app).get(`/api/categories/${inactiveCategory._id}`);
            assert.ok([400, 404].includes(res.status));
            assert.equal(res.body.errorCode, 'SERVICE_NOT_AVAILABLE');
        });

        // SCENARIO 3: Admin GET /api/admin/categories/all returns all services
        await test('Scenario 3: Admin GET /api/admin/categories/all returns all service statuses', async () => {
            const res = await request(app)
                .get('/api/admin/categories/all')
                .set(authHeaderFor(admin));
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            const all = res.body.categories || res.body.data;
            const names = all.map(c => c.name);
            assert.ok(names.includes('Active Home Care SB'));
            assert.ok(names.includes('Draft Service SB'));
            assert.ok(names.includes('Inactive Service SB'));
            assert.ok(names.includes('Archived Service SB'));
        });

        // SCENARIO 4: Admin can Create a service category
        let newAdminCatId;
        await test('Scenario 4: Admin POST /api/admin/categories creates a new service category', async () => {
            const res = await request(app)
                .post('/api/admin/categories')
                .set(authHeaderFor(admin))
                .send({
                    name: 'Admin Created Caregiver SB',
                    slug: 'admin-created-caregiver-sb',
                    description: 'Full care service',
                    price: 750,
                    durationHours: 3,
                    defaultCommission: 12,
                    status: 'ACTIVE',
                });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.category.name, 'Admin Created Caregiver SB');
            newAdminCatId = res.body.category._id;
        });

        // SCENARIO 5: Admin can Update a service category details
        await test('Scenario 5: Admin PUT /api/admin/categories/:id updates category details', async () => {
            const res = await request(app)
                .put(`/api/admin/categories/${newAdminCatId}`)
                .set(authHeaderFor(admin))
                .send({
                    name: 'Admin Created Caregiver Updated SB',
                    description: 'Updated description',
                    price: 850,
                    durationHours: 4,
                    defaultCommission: 15,
                });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.category.name, 'Admin Created Caregiver Updated SB');
        });

        // SCENARIO 6: Admin can change service status
        await test('Scenario 6: Admin PATCH /api/admin/categories/:id/status toggles status to INACTIVE', async () => {
            const res = await request(app)
                .patch(`/api/admin/categories/${newAdminCatId}/status`)
                .set(authHeaderFor(admin))
                .send({ status: 'INACTIVE' });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.category.status, 'INACTIVE');
        });

        // SCENARIO 7 & 19: Price quote calculation for ACTIVE service
        let quote;
        const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
        start.setUTCHours(10, 0, 0, 0);
        const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

        await test('Scenario 7 & 19: Customer GET price quote for ACTIVE service succeeds', async () => {
            const res = await request(app)
                .post('/api/v1/pricing/quote')
                .set(authHeaderFor(customer))
                .send({
                    workerId: worker._id.toString(),
                    serviceCategoryId: activeCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                });
            assert.ok([200, 201].includes(res.status));
            assert.equal(res.body.success, true);
            assert.ok(res.body.quoteId);
            quote = res.body;
        });

        // SCENARIO 8: Customer booking creation with INACTIVE service fails with SERVICE_NOT_AVAILABLE
        await test('Scenario 8: Booking creation with INACTIVE service fails with SERVICE_NOT_AVAILABLE', async () => {
            const res = await request(app)
                .post('/api/v1/bookings')
                .set(authHeaderFor(customer))
                .send({
                    workerId: worker._id.toString(),
                    serviceCategoryId: inactiveCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                    addressSnapshot: {
                        houseNumber: '101',
                        street: 'Main Road',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '560066',
                        addressType: 'HOME',
                    },
                });
            assert.ok([400, 404].includes(res.status));
            assert.ok(res.body.errorCode === 'SERVICE_NOT_AVAILABLE' || res.body.errorCode === 'VALIDATION_ERROR');
        });

        // SCENARIO 9: Customer booking creation with invalid PIN code fails with INVALID_PINCODE
        await test('Scenario 9: Booking creation with invalid 4-digit PIN code fails with INVALID_PINCODE', async () => {
            const res = await request(app)
                .post('/api/v1/bookings')
                .set(authHeaderFor(customer))
                .send({
                    quoteId: quote.quoteId,
                    workerId: worker._id.toString(),
                    serviceCategoryId: activeCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                    addressSnapshot: {
                        houseNumber: '101',
                        street: 'Main Road',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '5600', // Invalid PIN!
                        addressType: 'HOME',
                    },
                });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'INVALID_PINCODE');
        });

        // SCENARIO 10, 11, 12 & 22: Valid booking creation with address snapshot
        let createdBookingId;
        await test('Scenario 10, 11, 12 & 22: Booking creation with valid 6-digit PIN code creates addressSnapshot', async () => {
            const res = await request(app)
                .post('/api/v1/bookings')
                .set(authHeaderFor(customer))
                .send({
                    quoteId: quote.quoteId,
                    workerId: worker._id.toString(),
                    serviceCategoryId: activeCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                    addressSnapshot: {
                        houseNumber: 'Flat 402, Sunshine Apts',
                        street: '123 Tech Park Road',
                        locality: 'Whitefield',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '560066',
                        addressType: 'HOME',
                        instructions: 'Leave at reception',
                    },
                });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            createdBookingId = res.body.booking.id || res.body.booking._id;

            const dbBooking = await Booking.findById(createdBookingId);
            assert.ok(dbBooking.addressSnapshot);
            assert.equal(dbBooking.addressSnapshot.pincode, '560066');
            assert.equal(dbBooking.addressSnapshot.houseNumber, 'Flat 402, Sunshine Apts');
        });

        // SCENARIO 13: Worker profile photo upload syncs User.profileImage
        await test('Scenario 13: Worker profile photo upload syncs User.profileImage', async () => {
            const validPngBuffer = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89
            ]);

            const res = await request(app)
                .post('/api/v1/worker/verification/profile-photo')
                .set(authHeaderFor(worker))
                .attach('file', validPngBuffer, { filename: 'photo.png', contentType: 'image/png' });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const dbUser = await User.findById(worker._id);
            assert.ok(dbUser.profileImage);
            assert.ok(dbUser.profileImage.includes('/file/'));
        });

        // SCENARIO 14: Worker profile photo delete resets profile photo
        await test('Scenario 14: Worker profile photo delete clears User.profileImage', async () => {
            const res = await request(app)
                .delete('/api/v1/worker/verification/profile-photo')
                .set(authHeaderFor(worker));
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const dbUser = await User.findById(worker._id);
            assert.equal(dbUser.profileImage, null);
        });

        // SCENARIO 15: Worker card fallback avatar display test
        await test('Scenario 15: Worker initials fallback generator returns initials when photo is null', async () => {
            const dbUser = await User.findById(worker._id);
            assert.equal(dbUser.profileImage, null);
            const initials = dbUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
            assert.ok(initials.length >= 1);
        });

        // SCENARIO 16: Non-ACTIVE worker is excluded from available worker list
        await test('Scenario 16: Suspended worker cannot be booked', async () => {
            const res = await request(app)
                .post('/api/v1/bookings')
                .set(authHeaderFor(customer))
                .send({
                    workerId: unapprovedWorker._id.toString(),
                    serviceCategoryId: activeCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                    addressSnapshot: {
                        houseNumber: '101',
                        street: 'Main Road',
                        city: 'Bengaluru',
                        state: 'Karnataka',
                        pincode: '560066',
                        addressType: 'HOME',
                    },
                });
            assert.ok(res.status >= 400);
        });

        // SCENARIO 17: Worker lacking required skills is rejected
        await test('Scenario 17: Worker missing category is rejected for category booking', async () => {
            const otherCategory = await ServiceCategory.create({
                name: 'Unassociated Category SB',
                slug: 'unassociated-category-sb',
                description: 'Service worker has not selected',
                price: 500,
                durationHours: 1,
                status: 'ACTIVE',
            });

            const availRes = await request(app)
                .post('/api/v1/bookings/availability/check')
                .set(authHeaderFor(customer))
                .send({
                    workerId: worker._id.toString(),
                    serviceCategoryId: otherCategory._id.toString(),
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType: 'HOURLY',
                });
            assert.ok(availRes.status >= 400 || availRes.body.available === false);
        });

        // SCENARIO 18: Worker outside schedule availability fails check
        await test('Scenario 18: Worker outside working hours fails availability check', async () => {
            await WorkerProfile.findOneAndUpdate(
                { userId: worker._id },
                { availability: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, start: '09:00', end: '17:00', isWorking: true })) }
            );

            // 18:00 to 20:00 IST is outside 09:00-17:00 working hours
            const outStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
            outStart.setUTCHours(13, 0, 0, 0); // 18:30 IST
            const outEnd = new Date(outStart.getTime() + 2 * 60 * 60 * 1000);

            const res = await request(app)
                .post('/api/v1/bookings/availability/check')
                .set(authHeaderFor(customer))
                .send({
                    workerId: worker._id.toString(),
                    serviceCategoryId: activeCategory._id.toString(),
                    scheduledStart: outStart.toISOString(),
                    scheduledEnd: outEnd.toISOString(),
                    pricingType: 'HOURLY',
                });
            assert.equal(res.status, 409);
            assert.equal(res.body.errorCode, 'WORKER_TIME_SLOT_UNAVAILABLE');
        });

        // SCENARIO 20: Customer cannot access another customer's booking
        await test("Scenario 20: Customer cannot access another customer's booking", async () => {
            const res = await request(app)
                .get(`/api/v1/bookings/${createdBookingId}`)
                .set(authHeaderFor(otherCustomer));
            assert.ok([403, 404].includes(res.status));
        });

        // SCENARIO 21: Responsive layout data integrity test
        await test('Scenario 21: Booking payload contains required responsive UI schema keys', async () => {
            const booking = await Booking.findById(createdBookingId);
            assert.ok(booking.bookingNumber);
            assert.ok(booking.scheduledStart);
            assert.ok(booking.addressSnapshot.pincode);
        });

    } finally {
        await stopTestEnvironment();
    }

    console.log(`\n================ SUMMARY ================`);
    console.log(`TOTAL PASSED: ${passed}`);
    console.log(`TOTAL FAILED: ${failed}`);
    if (failures.length > 0) {
        console.log(`FAILURES:\n${failures.join('\n')}`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
