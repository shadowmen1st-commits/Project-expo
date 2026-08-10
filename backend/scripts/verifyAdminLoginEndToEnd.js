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
const results = [];

function record(name, pass, detail = '') {
    if (pass) {
        passed++;
        console.log(`✅ PASS: ${name}`);
    } else {
        failed++;
        console.error(`❌ FAIL: ${name} — ${detail}`);
    }
    results.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
}

async function main() {
    console.log("==========================================================");
    console.log("🔍 INITIATING END-TO-END ADMIN LOGIN & AUTH AUDIT SCRIPT");
    console.log("==========================================================");

    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // 1. Seed Users directly into MongoDB
        const testCredentials = [
            { name: 'System Admin', email: 'admin@test.com', password: 'Admin@12345', role: 'ADMIN' },
            { name: 'Test Customer', email: 'customer@test.com', password: 'Customer@12345', role: 'CUSTOMER' },
            { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER' },
            { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY' }
        ];

        for (const cred of testCredentials) {
            const hash = await hashPassword(cred.password);
            await User.create({
                name: cred.name,
                email: cred.email,
                passwordHash: hash,
                role: cred.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }

        // 2. MongoDB Inspection for Admin User
        const adminDoc = await User.findOne({ email: 'admin@test.com' }).select('+passwordHash');
        const adminExists = !!adminDoc;
        const roleIsAdmin = adminDoc?.role === 'ADMIN';
        const bcryptMatch = adminDoc ? await bcrypt.compare('Admin@12345', adminDoc.passwordHash) : false;

        record('MongoDB Admin Record Exists', adminExists);
        record('MongoDB Admin Role is ADMIN', roleIsAdmin);
        record('MongoDB Admin Bcrypt Password Match', bcryptMatch);

        // 3. Test POST /api/auth/login for Admin
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'Admin@12345' });
        
        record('POST /api/auth/login (Admin) Returns HTTP 200', adminLoginRes.status === 200);
        record('POST /api/auth/login (Admin) Returns JWT AccessToken', !!adminLoginRes.body.accessToken);
        record('POST /api/auth/login (Admin) Returns User Object with role ADMIN', adminLoginRes.body.user?.role === 'ADMIN');

        const adminToken = adminLoginRes.body.accessToken;

        // 4. Test GET /api/auth/me for Admin
        const adminMeRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);

        record('GET /api/auth/me (Admin) Returns HTTP 200', adminMeRes.status === 200);
        record('GET /api/auth/me (Admin) User Role is ADMIN', adminMeRes.body.user?.role === 'ADMIN');

        // 5. Test Admin Protected Endpoint
        const adminDashboardRes = await request(app)
            .get('/api/admin/companies')
            .set('Authorization', `Bearer ${adminToken}`);

        record('GET /api/admin/companies (Admin Token) Returns HTTP 200', adminDashboardRes.status === 200);

        // 6. Test All 4 Roles Login & Me Endpoint
        const tokens = {};
        for (const cred of testCredentials) {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: cred.email, password: cred.password });
            
            record(`Login API (${cred.role}) Returns HTTP 200`, loginRes.status === 200);
            if (loginRes.body.accessToken) {
                tokens[cred.role] = loginRes.body.accessToken;
            }

            const meRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
            
            record(`GET /api/auth/me (${cred.role}) Returns HTTP 200`, meRes.status === 200);
        }

        // 7. Role Authorization Matrix Verification
        const customerAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.CUSTOMER}`);
        record('CUSTOMER blocked from Admin API (403 Forbidden)', customerAdminCheck.status === 403);

        const workerAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.WORKER}`);
        record('WORKER blocked from Admin API (403 Forbidden)', workerAdminCheck.status === 403);

        const companyAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.COMPANY}`);
        record('COMPANY blocked from Admin API (403 Forbidden)', companyAdminCheck.status === 403);

        // 8. Invalid Password & Non-existent Email
        const wrongPassRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'WrongPassword' });
        record('Login with Wrong Password returns HTTP 401', wrongPassRes.status === 401);

        const noEmailRes = await request(app).post('/api/auth/login').send({ email: 'fakeadmin@test.com', password: 'Admin@12345' });
        record('Login with Non-existent Email returns HTTP 401', noEmailRes.status === 401);

    } finally {
        await stopTestEnvironment();
    }

    console.log("==========================================================");
    console.log(`📊 FINAL VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================================");
}

main();
