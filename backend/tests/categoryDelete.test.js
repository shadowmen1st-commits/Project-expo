process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startStandaloneTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import Booking from '../src/models/Booking.js';
import { hashPassword } from '../src/utils/authUtils.js';

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`PASS ${name}`);
    } catch (err) {
        failed++;
        failures.push(`${name}: ${err.message}`);
        console.error(`FAIL ${name}: ${err.message}`);
    }
}

async function loginAs(app, email, password) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.accessToken;
}

async function createCategory(name) {
    return ServiceCategory.create({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: `${name} services`,
        icon: 'Zap',
        defaultCommission: 10,
        isActive: true,
    });
}

async function main() {
    await startStandaloneTestEnvironment();
    const app = await createTestApp();

    try {
        // ── Create test users ─────────────────────────────────────────────
        const adminUser = await User.create({
            name: 'Admin User', email: 'admin.cat@test.local', phone: '8100000001',
            passwordHash: await hashPassword('AdminPass123'), role: 'ADMIN', status: 'ACTIVE',
        });
        const customerUser = await User.create({
            name: 'Customer User', email: 'customer.cat@test.local', phone: '8100000002',
            passwordHash: await hashPassword('CustomerPass123'), role: 'CUSTOMER', status: 'ACTIVE',
        });
        const workerUser = await User.create({
            name: 'Worker User', email: 'worker.cat@test.local', phone: '8100000003',
            passwordHash: await hashPassword('WorkerPass123'), role: 'WORKER', status: 'ACTIVE',
        });
        const companyUser = await User.create({
            name: 'Company User', email: 'company.cat@test.local', phone: '8100000004',
            passwordHash: await hashPassword('CompanyPass123'), role: 'COMPANY', status: 'ACTIVE',
        });

        // Create a worker profile for the worker user
        await WorkerProfile.create({ userId: workerUser._id, hourlyRate: 10000, dailyRate: 80000 });

        const adminToken = await loginAs(app, adminUser.email, 'AdminPass123');
        const customerToken = await loginAs(app, customerUser.email, 'CustomerPass123');
        const workerToken = await loginAs(app, workerUser.email, 'WorkerPass123');
        const companyToken = await loginAs(app, companyUser.email, 'CompanyPass123');

        // ── Test 1: Admin can remove a category ───────────────────────────
        await test('Admin can soft-delete a category', async () => {
            const cat = await createCategory('Test Cleaning');
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
            assert.equal(res.body.success, true);
            assert.ok(res.body.message.includes('removed successfully'));
            // Verify soft-delete in DB
            const updated = await ServiceCategory.findById(cat._id);
            assert.equal(updated.isActive, false);
            assert.ok(updated.deletedAt instanceof Date);
            assert.equal(updated.deletedBy.toString(), adminUser._id.toString());
        });

        // ── Test 2: Customer cannot delete categories ─────────────────────
        await test('Customer cannot delete a category (403)', async () => {
            const cat = await createCategory('Customer Test Category');
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${customerToken}`);
            assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
            // Verify it was NOT deleted
            const check = await ServiceCategory.findById(cat._id);
            assert.equal(check.isActive, true);
        });

        // ── Test 3: Worker cannot delete categories ───────────────────────
        await test('Worker cannot delete a category (403)', async () => {
            const cat = await createCategory('Worker Test Category');
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${workerToken}`);
            assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
        });

        // ── Test 4: Company cannot delete categories ──────────────────────
        await test('Company cannot delete a category (403)', async () => {
            const cat = await createCategory('Company Test Category');
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${companyToken}`);
            assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
        });

        // ── Test 5: Unauthenticated request rejected ──────────────────────
        await test('Unauthenticated request rejected (401)', async () => {
            const cat = await createCategory('Unauth Test Category');
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`);
            assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
        });

        // ── Test 6: Invalid category ID format ────────────────────────────
        await test('Invalid category ID returns 400', async () => {
            const res = await request(app)
                .delete('/api/admin/categories/not-a-valid-id')
                .set('Authorization', `Bearer ${adminToken}`);
            assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
            assert.equal(res.body.success, false);
        });

        // ── Test 7: Non-existent category ID returns 404 ──────────────────
        await test('Non-existent category ID returns 404', async () => {
            const fakeId = '000000000000000000000099';
            const res = await request(app)
                .delete(`/api/admin/categories/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            assert.equal(res.status, 404, `Expected 404, got ${res.status}`);
        });

        // ── Test 8: Already removed category returns 409 ──────────────────
        await test('Deleting already-removed category returns 409', async () => {
            const cat = await createCategory('Already Removed Category');
            // First delete
            await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            // Second delete attempt
            const res = await request(app)
                .delete(`/api/admin/categories/${cat._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            assert.equal(res.status, 409, `Expected 409, got ${res.status}`);
            assert.ok(res.body.message.includes('already been removed'));
        });

        // ── Test 9: getCategories only returns active categories ──────────
        await test('GET /categories/all only returns isActive=true categories', async () => {
            const activeCat = await createCategory('Active Category Test');
            const inactiveCat = await createCategory('Inactive Category Test');
            // Soft-delete the inactive one
            await request(app)
                .delete(`/api/admin/categories/${inactiveCat._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            const res = await request(app)
                .get('/api/admin/categories/all')
                .set('Authorization', `Bearer ${adminToken}`);
            assert.equal(res.status, 200);
            const ids = res.body.categories.map(c => c._id.toString());
            assert.ok(ids.includes(activeCat._id.toString()), 'Active category should appear');
            assert.ok(!ids.includes(inactiveCat._id.toString()), 'Deleted category should not appear');
        });

        // ── Summary ───────────────────────────────────────────────────────
        console.log(`\nCATEGORY_DELETE_TESTS_EXECUTED=${passed + failed} PASSED=${passed} FAILED=${failed}`);
        if (failed > 0) throw new Error(failures.join('\n'));

    } finally {
        await stopTestEnvironment();
    }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
