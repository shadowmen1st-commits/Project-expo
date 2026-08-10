process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from '../tests/helpers/testEnvironment.js';
import User from '../src/models/User.js';
import { hashPassword } from '../src/utils/authUtils.js';

let passed = 0, failed = 0;
const report = [];

function track(testName, condition, detail = '') {
    if (condition) {
        passed++;
        console.log(`✅ [PASS] ${testName}`);
    } else {
        failed++;
        console.error(`❌ [FAIL] ${testName}: ${detail}`);
    }
    report.push({ testName, status: condition ? 'PASS' : 'FAIL', detail });
}

async function runSuite() {
    console.log("==========================================================");
    console.log("🧪 STARTING COMPREHENSIVE AUTHENTICATION & MONGODB AUDIT");
    console.log("==========================================================");

    const envResult = await startReplicaSetTestEnvironment();
    track('MongoDB connection PASS/FAIL', !!envResult.uri);
    const app = await createTestApp();

    try {
        // 1. Seed/Create the exact 4 requested test users with REAL bcrypt hashes
        const targetUsers = [
            { name: 'Test Customer', email: 'user@test.com', password: 'Customer@12345', role: 'CUSTOMER' },
            { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER' },
            { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY' },
            { name: 'Test Admin', email: 'admin@test.com', password: 'Admin@12345', role: 'ADMIN' }
        ];

        for (const u of targetUsers) {
            const realBcryptHash = await hashPassword(u.password);
            assert.ok(realBcryptHash.startsWith('$2a$') || realBcryptHash.startsWith('$2b$'));
            assert.notEqual(realBcryptHash, '$2a$10$REPLACE_WITH_BCRYPT_HASH');

            await User.create({
                name: u.name,
                email: u.email,
                passwordHash: realBcryptHash,
                role: u.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }

        // Verify Direct DB Bcrypt Matches
        for (const u of targetUsers) {
            const doc = await User.findOne({ email: u.email }).select('+passwordHash');
            assert.ok(doc);
            assert.ok(doc.passwordHash);
            const matches = await bcrypt.compare(u.password, doc.passwordHash);
            assert.equal(matches, true);
        }

        // 2. Test Login API for Customer
        const customerLogin = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'Customer@12345' });
        track('Customer login PASS/FAIL', customerLogin.status === 200 && customerLogin.body.user?.role === 'CUSTOMER' && !!customerLogin.body.accessToken);

        // 3. Test Login API for Worker
        const workerLogin = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'Worker@12345' });
        track('Worker login PASS/FAIL', workerLogin.status === 200 && workerLogin.body.user?.role === 'WORKER' && !!workerLogin.body.accessToken);

        // 4. Test Login API for Company
        const companyLogin = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'Company@12345' });
        track('Company login PASS/FAIL', companyLogin.status === 200 && companyLogin.body.user?.role === 'COMPANY' && !!companyLogin.body.accessToken);

        // 5. Test Login API for Admin
        const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });
        track('Admin login PASS/FAIL', adminLogin.status === 200 && adminLogin.body.user?.role === 'ADMIN' && !!adminLogin.body.accessToken);

        // 6. Test GET /api/auth/me for each role
        const customerMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${customerLogin.body.accessToken}`);
        const workerMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${workerLogin.body.accessToken}`);
        const companyMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${companyLogin.body.accessToken}`);
        const adminMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminLogin.body.accessToken}`);

        const mePass = customerMe.body.user?.role === 'CUSTOMER' &&
                       workerMe.body.user?.role === 'WORKER' &&
                       companyMe.body.user?.role === 'COMPANY' &&
                       adminMe.body.user?.role === 'ADMIN';

        track('/auth/me PASS/FAIL', mePass);

        // 7. Test Role Authorization
        const custAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${customerLogin.body.accessToken}`);
        const wrkAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${workerLogin.body.accessToken}`);
        const cmpAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${companyLogin.body.accessToken}`);
        const admAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${adminLogin.body.accessToken}`);

        const rbacPass = custAdmin.status === 403 &&
                         wrkAdmin.status === 403 &&
                         cmpAdmin.status === 403 &&
                         admAdmin.status === 200;

        track('Role authorization PASS/FAIL', rbacPass);

        // 8. Test Wrong Password Rejection
        const wrongPass = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'WrongPassword123' });
        track('Wrong password rejection PASS/FAIL', wrongPass.status === 401);

        // 9. Test Duplicate Email Prevention
        const dupReg = await request(app).post('/api/auth/register').send({
            name: 'Duplicate Customer',
            email: 'user@test.com',
            phone: '9876543210',
            password: 'CustomerPassword123',
            role: 'CUSTOMER'
        });
        track('Duplicate email prevention PASS/FAIL', dupReg.status === 409 && dupReg.body.errorCode === 'EMAIL_EXISTS');

        // 10. Backend Tests Result
        track('Backend tests PASS/FAIL', failed === 0);

    } finally {
        await stopTestEnvironment();
    }

    console.log("==========================================================");
    console.log(`📊 FINAL REPORT: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================================");
}

runSuite();
