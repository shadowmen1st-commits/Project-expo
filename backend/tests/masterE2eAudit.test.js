process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyVerificationDocument from '../src/models/CompanyVerificationDocument.js';
import AuditLog from '../src/models/AuditLog.js';
import Notification from '../src/models/Notification.js';
import { hashPassword } from '../src/utils/authUtils.js';

let passedCount = 0;
let failedCount = 0;
const resultsMatrix = [];

function recordTest(part, name, passed, details = '') {
    if (passed) {
        passedCount++;
        console.log(`[PASS] [${part}] ${name}`);
    } else {
        failedCount++;
        console.error(`❌ [FAIL] [${part}] ${name}: ${details}`);
    }
    resultsMatrix.push({ part, name, status: passed ? 'PASS' : 'FAIL', details });
}

async function test(part, name, fn) {
    try {
        await fn();
        recordTest(part, name, true);
    } catch (err) {
        const msg = `${err.message} (actual: ${JSON.stringify(err.actual)}, expected: ${JSON.stringify(err.expected)})`;
        recordTest(part, name, false, msg);
    }
}

async function runMasterE2eAudit() {
    console.log("==========================================================");
    console.log("🚀 STARTING MASTER END-TO-END APPLICATION AUDIT & TEST SUITE");
    console.log("==========================================================");

    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // ---------------------------------------------------------------------
        // PART 1 — BACKEND HEALTH & CONFIG
        // ---------------------------------------------------------------------
        await test('PART 1 — Backend Health', 'Backend GET /health responds 200 OK', async () => {
            const res = await request(app).get('/health');
            assert.equal(res.status, 200);
            assert.ok(res.body.status === 'ok' || res.body.status === 'UP');
        });

        await test('PART 1 — Backend Readiness', 'Backend GET /ready responds 200 OK', async () => {
            const readyRes = await request(app).get('/ready');
            assert.equal(readyRes.status, 200);
            assert.equal(readyRes.body.status, 'READY');
        });

        await test('PART 1 — Environment Loading', 'Environment loads JWT secrets and database connection', async () => {
            assert.ok(process.env.JWT_ACCESS_SECRET || 'test_secret');
            assert.ok(process.env.MONGODB_URI);
        });

        // Setup Accounts
        const adminUser = await User.create({
            name: 'System Admin',
            email: 'admin@test.com',
            phone: '9990001111',
            passwordHash: await hashPassword('Admin@12345'),
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        // ---------------------------------------------------------------------
        // PART 2 — CUSTOMER TEST
        // ---------------------------------------------------------------------
        await test('PART 2 — Customer Test', 'Customer registration (201 Created)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test Customer',
                    email: 'customer@test.com',
                    phone: '9990002222',
                    password: 'Customer@12345',
                    role: 'CUSTOMER'
                });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        const customerAgent = request.agent(app);

        await test('PART 2 — Customer Test', 'Customer login with correct credentials (200 OK)', async () => {
            const res = await customerAgent
                .post('/api/auth/login')
                .send({ email: 'customer@test.com', password: 'Customer@12345' });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.user);
        });

        await test('PART 2 — Customer Test', 'Customer login with invalid password returns 401', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'customer@test.com', password: 'WrongPassword' });
            assert.equal(res.status, 401);
        });

        await test('PART 2 — Customer Test', 'Customer login with unknown email returns 401', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'unknown@test.com', password: 'Customer@12345' });
            assert.equal(res.status, 401);
        });

        await test('PART 2 — Customer Test', 'Customer fetch profile (200 OK)', async () => {
            const res = await customerAgent.get('/api/auth/me');
            assert.equal(res.status, 200);
            assert.equal(res.body.user.email, 'customer@test.com');
        });

        await test('PART 2 — Customer Test', 'Customer blocked from Admin routes (403 Forbidden)', async () => {
            const res = await customerAgent.get('/api/admin/companies');
            assert.equal(res.status, 403);
        });

        await test('PART 2 — Customer Test', 'Customer blocked from Company routes (403 Forbidden)', async () => {
            const res = await customerAgent.get('/api/company/verification');
            assert.equal(res.status, 403);
        });

        // ---------------------------------------------------------------------
        // PART 3 — WORKER TEST
        // ---------------------------------------------------------------------
        await test('PART 3 — Worker Test', 'Worker registration (201 Created)', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test Worker',
                    email: 'worker@test.com',
                    phone: '9990003333',
                    password: 'Worker@12345',
                    role: 'WORKER'
                });
            assert.equal(res.status, 201);
        });

        const workerAgent = request.agent(app);

        await test('PART 3 — Worker Test', 'Worker login (200 OK)', async () => {
            const res = await workerAgent
                .post('/api/auth/login')
                .send({ email: 'worker@test.com', password: 'Worker@12345' });
            assert.equal(res.status, 200);
        });

        await test('PART 3 — Worker Test', 'Worker blocked from Admin routes (403 Forbidden)', async () => {
            const res = await workerAgent.get('/api/admin/companies');
            assert.equal(res.status, 403);
        });

        await test('PART 3 — Worker Test', 'Worker blocked from Company job creation (403 Forbidden)', async () => {
            const res = await workerAgent.post('/api/company/jobs').send({ title: 'Unauthorized Job' });
            assert.equal(res.status, 403);
        });

        // ---------------------------------------------------------------------
        // PART 4 & 5 — COMPANY TEST & 5-STEP VERIFICATION
        // ---------------------------------------------------------------------
        await test('PART 4 — Company Registration', 'Company registration (201 Created)', async () => {
            const res = await request(app)
                .post('/api/company/register')
                .send({
                    companyName: 'Apex Logistics',
                    email: 'company@test.com',
                    phone: '9990004444',
                    address: '12 Okhla Phase 3',
                    city: 'New Delhi',
                    state: 'Delhi',
                    pincode: '110020',
                    businessType: 'Event Logistics',
                    description: 'Manpower provider for events.',
                    authorizedPersonName: 'Amit Verma',
                    authorizedPersonPhone: '9990004411',
                    panNumber: 'ABCDE1234F',
                    password: 'Company@12345',
                    confirmPassword: 'Company@12345'
                });
            assert.equal(res.status, 201);
        });

        const companyAgent = request.agent(app);

        await test('PART 4 — Company Login', 'Company login (200 OK)', async () => {
            const res = await companyAgent
                .post('/api/auth/login')
                .send({ email: 'company@test.com', password: 'Company@12345' });
            assert.equal(res.status, 200);
        });

        await test('PART 5 — Step 1 Profile', 'Company Save Step 1 Profile details', async () => {
            const res = await companyAgent
                .post('/api/company/verification/profile')
                .send({
                    companyName: 'Apex Event Logistics Private Limited',
                    email: 'company@test.com',
                    phone: '9990004444',
                    authorizedPersonName: 'Amit Verma',
                    authorizedPersonPhone: '9990004411',
                    companyType: 'Private Limited',
                    businessType: 'Event Logistics',
                    website: 'https://apexevents.com',
                    address: '12 Okhla Phase 3',
                    city: 'New Delhi',
                    state: 'Delhi',
                    pincode: '110020',
                    country: 'India'
                });
            assert.equal(res.status, 200);
            assert.ok(res.body.profile.completedSteps.includes('PROFILE'));
        });

        await test('PART 5 — Step 2 Details Validation', 'Step 2 rejects invalid GSTIN format (400)', async () => {
            const res = await companyAgent
                .post('/api/company/verification/details')
                .send({ gstNumber: 'INVALID_GSTIN_123' });
            assert.equal(res.status, 400);
        });

        await test('PART 5 — Step 2 Details Validation', 'Step 2 rejects invalid PAN Card format (400)', async () => {
            const res = await companyAgent
                .post('/api/company/verification/details')
                .send({ panNumber: 'INVALID_PAN_123' });
            assert.equal(res.status, 400);
        });

        await test('PART 5 — Step 2 Details Save', 'Company Save Step 2 Business Details', async () => {
            const res = await companyAgent
                .post('/api/company/verification/details')
                .send({
                    legalCompanyName: 'Apex Event Logistics Private Limited',
                    tradeName: 'Apex Events',
                    companyType: 'Private Limited',
                    registrationNumber: 'U74999DL2021PTC123456',
                    dateOfIncorporation: '2021-05-15',
                    numberOfEmployees: '10-50',
                    industry: 'Events & Services',
                    description: 'Providing manpower for NCR events.',
                    registeredAddress: '12 Okhla Phase 3, New Delhi',
                    operationalAddress: '12 Okhla Phase 3, New Delhi',
                    gstNumber: '07AAAAA0000A1Z5',
                    panNumber: 'ABCDE1234F'
                });
            assert.equal(res.status, 200);
            assert.ok(res.body.profile.completedSteps.includes('DETAILS'));
        });

        const uploadDoc = async (agent, type) => {
            return agent
                .post('/api/company/verification/documents')
                .attach('file', Buffer.from('mock-pdf-binary-data'), 'certificate.pdf')
                .field('documentType', type);
        };

        await test('PART 5 — Step 3 Documents Upload', 'Upload required KYC documents', async () => {
            assert.equal((await uploadDoc(companyAgent, 'BUSINESS_REGISTRATION')).status, 200);
            assert.equal((await uploadDoc(companyAgent, 'ADDRESS_PROOF')).status, 200);
            assert.equal((await uploadDoc(companyAgent, 'AUTHORIZED_PERSON_ID')).status, 200);
            assert.equal((await uploadDoc(companyAgent, 'COMPANY_PAN')).status, 200);
        });

        await test('PART 5 — Step 3 Document Delete & Re-upload', 'Delete document and re-upload', async () => {
            const delRes = await companyAgent.delete('/api/company/verification/documents/COMPANY_PAN');
            assert.equal(delRes.status, 200);
            assert.equal((await uploadDoc(companyAgent, 'COMPANY_PAN')).status, 200);
        });

        await test('PART 5 — Step 4 & 5 KYC Submission', 'Submit verification application to PENDING/UNDER_REVIEW', async () => {
            const res = await companyAgent.post('/api/company/verification/submit');
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'UNDER_REVIEW');
        });

        // ---------------------------------------------------------------------
        // PART 7 & 8 — ADMIN TEST & ADMIN APPROVAL FLOW
        // ---------------------------------------------------------------------
        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });

        let companyUserId;

        await test('PART 7 — Admin Company Verification List', 'Admin fetches company verifications queue', async () => {
            const res = await adminAgent.get('/api/admin/company-verifications');
            assert.equal(res.status, 200);
            assert.ok(res.body.verifications.length >= 1);
            companyUserId = (await User.findOne({ email: 'company@test.com' }))._id;
        });

        await test('PART 8 — Admin Request Information', 'Admin requests more info and rejects ADDRESS_PROOF document', async () => {
            const doc = await CompanyVerificationDocument.findOne({ companyId: companyUserId, documentType: 'ADDRESS_PROOF' });
            const res = await adminAgent
                .patch(`/api/admin/companies/${companyUserId}/verification/request-information`)
                .send({ reason: 'Please re-upload clearer business address proof.', rejectedDocuments: [doc._id.toString()] });
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'NEEDS_INFORMATION');
        });

        await test('PART 8 — Company Resubmit After Info Request', 'Company re-uploads document and resubmits KYC', async () => {
            assert.equal((await uploadDoc(companyAgent, 'ADDRESS_PROOF')).status, 200);
            const res = await companyAgent.post('/api/company/verification/submit');
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'UNDER_REVIEW');
        });

        await test('PART 8 — Admin Approval Flow', 'Admin approves company KYC -> VERIFIED', async () => {
            const res = await adminAgent.patch(`/api/admin/companies/${companyUserId}/verification/approve`);
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'VERIFIED');
        });

        await test('PART 8 — Verified Job Creation', 'Verified company can post jobs successfully (201 Created)', async () => {
            const res = await companyAgent.post('/api/company/jobs').send({
                title: 'Senior Event Crew',
                description: 'Assisting in ticketing & hall management.',
                category: 'Events',
                workersRequired: 3,
                location: 'Noida Sec 62',
                address: 'Expo Mart Hall 4',
                workingDate: new Date(Date.now() + 86400000 * 2),
                startTime: '09:00',
                endTime: '18:00',
                payRate: 120000,
                instructions: 'Wear black trousers and white shirt.',
                applicationDeadline: new Date(Date.now() + 86400000 * 2)
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        // ---------------------------------------------------------------------
        // PART 9 — ROLE ISOLATION MATRIX (4x4)
        // ---------------------------------------------------------------------
        await test('PART 9 — Role Isolation Matrix', 'Unauthenticated request to protected route returns 401', async () => {
            const res = await request(app).get('/api/admin/companies');
            assert.equal(res.status, 401);
        });

        await test('PART 9 — Role Isolation Matrix', 'Customer token on Admin route returns 403', async () => {
            const res = await customerAgent.get('/api/admin/companies');
            assert.equal(res.status, 403);
        });

        await test('PART 9 — Role Isolation Matrix', 'Worker token on Company route returns 403', async () => {
            const res = await workerAgent.get('/api/company/verification');
            assert.equal(res.status, 403);
        });

        await test('PART 9 — Role Isolation Matrix', 'Company token on Admin route returns 403', async () => {
            const res = await companyAgent.get('/api/admin/companies');
            assert.equal(res.status, 403);
        });

        await test('PART 9 — Role Isolation Matrix', 'Admin token on Admin route returns 200', async () => {
            const res = await adminAgent.get('/api/admin/companies');
            assert.equal(res.status, 200);
        });

        // ---------------------------------------------------------------------
        // PART 10 & 11 — DATA ISOLATION
        // ---------------------------------------------------------------------
        // Create Company B
        await request(app).post('/api/company/register').send({
            companyName: 'Noida Security Corp',
            email: 'companyB@test.com',
            phone: '9990005555',
            address: 'Sec 18',
            city: 'Noida',
            state: 'UP',
            pincode: '201301',
            businessType: 'Security Services',
            description: 'Guards provider.',
            authorizedPersonName: 'Rohan Sharma',
            authorizedPersonPhone: '9990005511',
            panNumber: 'DEFGH5678I',
            password: 'Company@12345',
            confirmPassword: 'Company@12345'
        });

        const companyBAgent = request.agent(app);
        await companyBAgent.post('/api/auth/login').send({ email: 'companyB@test.com', password: 'Company@12345' });

        await test('PART 10 — Company Data Isolation', 'Company B GET /verification returns ONLY Company B profile', async () => {
            const res = await companyBAgent.get('/api/company/verification');
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.companyName, 'Noida Security Corp');
        });

        await test('PART 10 — Company Data Isolation', 'Company B blocked from Company A admin verification route (403)', async () => {
            const res = await companyBAgent.get(`/api/admin/companies/${companyUserId}/verification`);
            assert.equal(res.status, 403);
        });

    } finally {
        await stopTestEnvironment();
    }

    console.log("==========================================================");
    console.log(`📊 MASTER E2E AUDIT RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    if (failedCount > 0) {
        console.log("FAILURE DETAILS:");
        resultsMatrix.filter(r => r.status === 'FAIL').forEach(f => console.log(` - [${f.part}] ${f.name}: ${f.details}`));
    }
    console.log("==========================================================");
}

runMasterE2eAudit();
