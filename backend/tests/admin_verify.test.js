process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import { hashPassword } from '../src/utils/authUtils.js';

async function run() {
    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        console.log('--- ADMIN VERIFICATION TEST ---');

        // 1. Setup Admin Account
        const adminEmail = 'admin@test.com';
        const adminPass = 'Admin@12345';
        await User.deleteMany({ email: adminEmail });
        await User.create({
            name: 'System Admin',
            email: adminEmail,
            phone: '8999999999',
            passwordHash: await hashPassword(adminPass),
            role: 'ADMIN',
            status: 'ACTIVE'
        });
        console.log('[1] Admin account created in test DB.');

        // 2. Test Success Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: adminEmail, password: adminPass });

        assert.equal(loginRes.status, 200, 'Admin login should return 200');
        assert.equal(loginRes.body.success, true);
        assert.ok(loginRes.body.accessToken, 'Should return access token');
        assert.equal(loginRes.body.user.role, 'ADMIN', 'Role should be ADMIN');
        const token = loginRes.body.accessToken;
        console.log('[2] Admin login successful. Token received.');

        // 3. Test Protected Admin API
        const adminApiRes = await request(app)
            .get('/api/admin/payouts')
            .set('Authorization', `Bearer ${token}`);

        assert.equal(adminApiRes.status, 200, 'Admin should have access to admin API');
        console.log('[3] Admin protected API (/api/admin/payouts) access granted (200).');

        // 4. Test Role Regression (Wrong Password)
        const wrongPassRes = await request(app)
            .post('/api/auth/login')
            .send({ email: adminEmail, password: 'WrongPassword123' });

        assert.equal(wrongPassRes.status, 401, 'Wrong password should return 401');
        assert.equal(wrongPassRes.body.errorCode, 'INVALID_CREDENTIALS');
        console.log('[4] Wrong password correctly rejected with 401 INVALID_CREDENTIALS.');

        // 5. Test Role Regression (Non-existent Account)
        const missingRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'doesnotexist@test.com', password: adminPass });

        assert.equal(missingRes.status, 401, 'Missing account should return 401');
        assert.equal(missingRes.body.errorCode, 'INVALID_CREDENTIALS');
        console.log('[5] Non-existent account correctly rejected with 401 INVALID_CREDENTIALS.');

        // 6. Test Authorization Isolation
        await User.deleteMany({ email: 'customer.iso@test.local' });
        await User.create({
            name: 'Test Customer',
            email: 'customer.iso@test.local',
            phone: '8111111111',
            passwordHash: await hashPassword('Customer@12345'),
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });
        const custLogin = await request(app).post('/api/auth/login').send({ email: 'customer.iso@test.local', password: 'Customer@12345' });
        const cToken = custLogin.body.accessToken;

        const custAccessAdmin = await request(app)
            .get('/api/admin/payouts')
            .set('Authorization', `Bearer ${cToken}`);

        assert.equal(custAccessAdmin.status, 403, 'Customer should be forbidden from Admin API');
        console.log('[6] Role isolation verified: Customer denied access to Admin API (403).');

        // 7. Test Logout logic
        const logoutRes = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);
        assert.equal(logoutRes.status, 200);
        console.log('[7] Logout endpoint returned 200.');

        console.log('\n--- ALL ADMIN VERIFICATION TESTS PASSED ---');
    } catch (err) {
        console.error('\n--- ADMIN VERIFICATION TEST FAILED ---');
        console.error(err);
        process.exit(1);
    } finally {
        await stopTestEnvironment();
    }
}

run();
