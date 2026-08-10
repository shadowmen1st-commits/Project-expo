import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

let passed = 0, failed = 0;
const testResults = [];

function check(name, condition, detail = '') {
    if (condition) {
        passed++;
        console.log(`✅ PASS: ${name}`);
    } else {
        failed++;
        console.error(`❌ FAIL: ${name} — ${detail}`);
    }
    testResults.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
}

async function runLiveAuthAudit() {
    console.log("=================================================");
    console.log("🚀 LIVE EXPRESS SERVER AUTHENTICATION E2E AUDIT");
    console.log("=================================================");

    await connectDB();
    const app = createApp();

    try {
        // STEP 5: Direct API Test for Admin Login
        console.log("\n--- STEP 5: DIRECT API TEST (ADMIN) ---");
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'Admin@12345' });

        check('POST /api/auth/login (Admin) HTTP Status is 200', adminLoginRes.status === 200, `Got ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.body)}`);
        check('POST /api/auth/login (Admin) Returns accessToken', !!adminLoginRes.body.accessToken);
        check('POST /api/auth/login (Admin) user.role is ADMIN', adminLoginRes.body.user?.role === 'ADMIN');

        const adminToken = adminLoginRes.body.accessToken;

        // GET /api/auth/me for Admin
        const adminMeRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);

        check('GET /api/auth/me (Admin) HTTP Status is 200', adminMeRes.status === 200);
        check('GET /api/auth/me (Admin) role is ADMIN', adminMeRes.body.user?.role === 'ADMIN');

        // Protected Admin Endpoint
        const adminProtectedRes = await request(app)
            .get('/api/admin/companies')
            .set('Authorization', `Bearer ${adminToken}`);

        check('GET /api/admin/companies (Admin) HTTP Status is 200', adminProtectedRes.status === 200);

        // STEP 6: Security Matrix & Wrong Credentials Test
        console.log("\n--- STEP 6: SECURITY MATRIX & WRONG CREDENTIALS ---");
        
        // Logins for Customer, Worker, Company
        const customerLoginRes = await request(app).post('/api/auth/login').send({ email: 'customer@test.com', password: 'Customer@12345' });
        const workerLoginRes = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'Worker@12345' });
        const companyLoginRes = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'Company@12345' });

        check('POST /api/auth/login (Customer) HTTP 200', customerLoginRes.status === 200);
        check('POST /api/auth/login (Worker) HTTP 200', workerLoginRes.status === 200);
        check('POST /api/auth/login (Company) HTTP 200', companyLoginRes.status === 200);

        const customerToken = customerLoginRes.body.accessToken;
        const workerToken = workerLoginRes.body.accessToken;
        const companyToken = companyLoginRes.body.accessToken;

        // Authorization checks on admin API
        const custAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${customerToken}`);
        check('CUSTOMER -> Admin API returns 403 Forbidden', custAdmin.status === 403);

        const wrkAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${workerToken}`);
        check('WORKER -> Admin API returns 403 Forbidden', wrkAdmin.status === 403);

        const cmpAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${companyToken}`);
        check('COMPANY -> Admin API returns 403 Forbidden', cmpAdmin.status === 403);

        const noTokAdmin = await request(app).get('/api/admin/companies');
        check('No Token -> Admin API returns 401 Unauthorized', noTokAdmin.status === 401);

        // Password & Email failure checks
        const wrongPass = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'WrongPassword' });
        check('Wrong Password returns 401 Unauthorized', wrongPass.status === 401);

        const nonExistent = await request(app).post('/api/auth/login').send({ email: 'nonexistent@test.com', password: 'Admin@12345' });
        check('Non-existent Email returns 401 Unauthorized', nonExistent.status === 401);

    } finally {
        await disconnectDB();
    }

    console.log("\n=================================================");
    console.log(`📊 LIVE SERVER AUDIT RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
        process.exitCode = 1;
    }
}

runLiveAuthAudit();
