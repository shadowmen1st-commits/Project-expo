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

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`PASS ${name}`);
    } catch (error) {
        failed++;
        failures.push(`${name}: ${error.message}`);
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

async function main() {
    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // Setup Test Users
        const adminUser = await User.create({
            name: 'System Admin',
            email: 'admin@test.local',
            phone: '9991112223',
            passwordHash: await hashPassword('AdminPass123'),
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        const workerUser = await User.create({
            name: 'Test Worker',
            email: 'worker@test.local',
            phone: '9991112224',
            passwordHash: await hashPassword('WorkerPass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        // Register Company A
        await test('Company A registration', async () => {
            const res = await request(app)
                .post('/api/company/register')
                .send({
                    companyName: 'Apex Event Logistics',
                    email: 'comp_a@test.local',
                    phone: '9991110001',
                    address: '12 Okhla Phase 3',
                    city: 'New Delhi',
                    state: 'Delhi',
                    pincode: '110020',
                    businessType: 'Event Logistics',
                    description: 'Providing manpower for NCR events.',
                    authorizedPersonName: 'Amit Verma',
                    authorizedPersonPhone: '9991110011',
                    panNumber: 'ABCDE1234F',
                    password: 'CompanyPass123',
                    confirmPassword: 'CompanyPass123'
                });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        // Register Company B
        await test('Company B registration', async () => {
            const res = await request(app)
                .post('/api/company/register')
                .send({
                    companyName: 'Noida Security Corp',
                    email: 'comp_b@test.local',
                    phone: '9991110002',
                    address: 'Sec-18 Mall Rd',
                    city: 'Noida',
                    state: 'UP',
                    pincode: '201301',
                    businessType: 'Security Services',
                    description: 'Guards and marshals.',
                    authorizedPersonName: 'Sumit Singh',
                    authorizedPersonPhone: '9991110022',
                    panNumber: 'FGHIJ5678K',
                    password: 'CompanyPass123',
                    confirmPassword: 'CompanyPass123'
                });
            assert.equal(res.status, 201);
        });

        // Logins
        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: adminUser.email, password: 'AdminPass123' });

        const workerAgent = request.agent(app);
        await workerAgent.post('/api/auth/login').send({ email: workerUser.email, password: 'WorkerPass123' });

        const compAAgent = request.agent(app);
        await compAAgent.post('/api/auth/login').send({ email: 'comp_a@test.local', password: 'CompanyPass123' });

        const compBAgent = request.agent(app);
        await compBAgent.post('/api/auth/login').send({ email: 'comp_b@test.local', password: 'CompanyPass123' });

        // Verification Status Initial State
        await test('Company A initial verification state is PENDING', async () => {
            const res = await compAAgent.get('/api/company/verification');
            assert.equal(res.status, 200);
            assert.equal(res.body.verificationStatus, 'PENDING');
            assert.equal(res.body.progress, 20); // 20% for completed profile
        });

        // Job posting is blocked before verification
        await test('Job creation is blocked for unverified company (403)', async () => {
            const res = await compAAgent.post('/api/company/jobs').send({
                title: 'Steward / Hostess',
                description: 'Duties for ticketing and welcoming.',
                category: 'Events',
                workersRequired: 2,
                location: 'Noida Stadium',
                address: 'Noida Sector 21',
                workingDate: new Date(Date.now() + 86400000),
                startTime: '10:00',
                endTime: '18:00',
                payRate: 100000,
                instructions: 'Be on time.',
                applicationDeadline: new Date(Date.now() + 86400000)
            });
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'COMPANY_VERIFICATION_REQUIRED');
        });

        // Non-companies cannot view verification status
        await test('Workers cannot access company verification details (403)', async () => {
            const res = await workerAgent.get('/api/company/verification');
            assert.equal(res.status, 403);
        });

        // Upload KYC documents for Company A
        const uploadDoc = async (agent, type) => {
            return agent
                .post('/api/company/verification/documents')
                .attach('file', Buffer.from('mock-document-binary-content'), 'doc.pdf')
                .field('documentType', type);
        };

        await test('Upload required documents for Company A', async () => {
            const res1 = await uploadDoc(compAAgent, 'BUSINESS_REGISTRATION');
            assert.equal(res1.status, 200);
            assert.equal(res1.body.document.status, 'PENDING');

            const res2 = await uploadDoc(compAAgent, 'ADDRESS_PROOF');
            assert.equal(res2.status, 200);

            const res3 = await uploadDoc(compAAgent, 'AUTHORIZED_PERSON_ID');
            assert.equal(res3.status, 200);

            const res4 = await uploadDoc(compAAgent, 'COMPANY_PAN');
            assert.equal(res4.status, 200);

            const status = await compAAgent.get('/api/company/verification');
            assert.equal(status.body.progress, 100);
        });

        // KYC Submission
        await test('Submit Company A verification details', async () => {
            const res = await compAAgent.post('/api/company/verification/submit');
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'UNDER_REVIEW');

            // Audit log exists
            const log = await AuditLog.findOne({ resourceId: res.body.profile.userId, action: 'COMPANY_VERIFICATION_SUBMITTED' });
            assert.ok(log);
        });

        // Data Isolation: Company B cannot see Company A verification detail
        await test('Data Isolation: Company B cannot view Company A verification documents (403)', async () => {
            const compAUserId = (await User.findOne({ email: 'comp_a@test.local' }))._id;
            const res = await compBAgent.get(`/api/admin/companies/${compAUserId}/verification`);
            assert.equal(res.status, 403); // blocked by requirePermission or role check
        });

        // Admin verification review detail
        let compAUserId;
        await test('Admin views Company A KYC submissions', async () => {
            compAUserId = (await User.findOne({ email: 'comp_a@test.local' }))._id;
            const res = await adminAgent.get(`/api/admin/companies/${compAUserId}/verification`);
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'UNDER_REVIEW');
            assert.equal(res.body.documents.length, 4);
        });

        // Admin Request Info with rejected document
        await test('Admin requests more information and rejects Address Proof', async () => {
            const doc = await CompanyVerificationDocument.findOne({ companyId: compAUserId, documentType: 'ADDRESS_PROOF' });
            const res = await adminAgent
                .patch(`/api/admin/companies/${compAUserId}/verification/request-information`)
                .send({
                    reason: 'Please upload a clearer address proof document.',
                    rejectedDocuments: [doc._id.toString()]
                });
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'NEEDS_INFORMATION');

            // Document status updated
            const updatedDoc = await CompanyVerificationDocument.findById(doc._id);
            assert.equal(updatedDoc.status, 'REJECTED');

            // Notification exists
            const notif = await Notification.findOne({ recipientId: compAUserId, title: 'Information Required for KYC' });
            assert.ok(notif);
        });

        // Company A uploads replacement document and submits again
        await test('Company A replaces rejected document and resubmits', async () => {
            const res1 = await uploadDoc(compAAgent, 'ADDRESS_PROOF');
            assert.equal(res1.status, 200);

            const res2 = await compAAgent.post('/api/company/verification/submit');
            assert.equal(res2.status, 200);
            assert.equal(res2.body.profile.verificationStatus, 'UNDER_REVIEW');
        });

        // Admin approves Company A verification
        await test('Admin approves Company A KYC', async () => {
            const res = await adminAgent
                .patch(`/api/admin/companies/${compAUserId}/verification/approve`);
            assert.equal(res.status, 200);
            assert.equal(res.body.profile.verificationStatus, 'VERIFIED');

            // All documents approved
            const docStatuses = await CompanyVerificationDocument.find({ companyId: compAUserId }).select('status');
            docStatuses.forEach(d => assert.equal(d.status, 'APPROVED'));
        });

        // Verified company can now create a job
        await test('Verified company can create job successfully', async () => {
            const res = await compAAgent.post('/api/company/jobs').send({
                title: 'Senior Event Marshal',
                description: 'Directing visitors and parking marshal duties.',
                category: 'Events',
                workersRequired: 2,
                location: 'Noida Sector 62',
                address: 'Noida Sec 62 Expo Mart',
                workingDate: new Date(Date.now() + 86400000 * 3),
                startTime: '09:00',
                endTime: '18:00',
                payRate: 150000,
                instructions: 'Report in formal uniform.',
                applicationDeadline: new Date(Date.now() + 86400000 * 3)
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        // Admin suspends company
        await test('Admin suspends Company A', async () => {
            const res = await adminAgent
                .patch(`/api/admin/companies/${compAUserId}/suspend`)
                .send({ reason: 'Breach of platform employment rules.' });
            assert.equal(res.status, 200);

            const profile = await CompanyProfile.findOne({ userId: compAUserId });
            assert.equal(profile.verificationStatus, 'SUSPENDED');

            const user = await User.findById(compAUserId);
            assert.equal(user.status, 'SUSPENDED');
        });

        // Suspended company is blocked from creating jobs
        await test('Suspended company is blocked from creating jobs (401 or 403)', async () => {
            const res = await compAAgent.post('/api/company/jobs').send({
                title: 'Event Crew Member',
                description: 'Assisting in setup.',
                category: 'Events',
                workersRequired: 1,
                location: 'Noida Sector 62',
                address: 'Noida Sec 62 Expo Mart',
                workingDate: new Date(Date.now() + 86400000 * 3),
                startTime: '09:00',
                endTime: '18:00',
                payRate: 120000,
                instructions: 'Report in formal uniform.',
                applicationDeadline: new Date(Date.now() + 86400000 * 3)
            });
            assert.ok(res.status === 401 || res.status === 403);
        });

    } finally {
        await stopTestEnvironment();
    }

    console.log(`\n========================================`);
    console.log(`📊 COMPANY KYC TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
        console.error('Failure Details:');
        failures.forEach(f => console.error(`- ${f}`));
        process.exitCode = 1;
    }
}

main();
