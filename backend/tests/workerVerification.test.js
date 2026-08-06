process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import VerificationSubmission from '../src/models/VerificationSubmission.js';
import VerificationDocument from '../src/models/VerificationDocument.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
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
        // Pre-create category
        const cat = await ServiceCategory.create({
            name: 'Home Cleaning',
            slug: 'home-cleaning',
            description: 'Professional residential cleaning',
            defaultCommission: 12,
            icon: 'Zap',
            isActive: true
        });

        // Setup test users: Worker and Admin
        const workerUser = await User.create({
            name: 'Test Worker',
            email: 'worker@test.local',
            phone: '9998887776',
            passwordHash: await hashPassword('WorkerPass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        const adminUser = await User.create({
            name: 'System Admin',
            email: 'admin@test.local',
            phone: '9998887771',
            passwordHash: await hashPassword('AdminPass123'),
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        // Login agents
        const workerAgent = request.agent(app);
        await workerAgent.post('/api/auth/login').send({ email: workerUser.email, password: 'WorkerPass123' });

        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: adminUser.email, password: 'AdminPass123' });

        // Let's test initially worker profile status is INCOMPLETE_PROFILE
        await test('worker initial state is INCOMPLETE_PROFILE', async () => {
            const res = await workerAgent.get('/api/v1/worker/verification');
            if (res.status !== 200) console.error('Initial state failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.profile.verificationStatus, 'INCOMPLETE_PROFILE');
        });

        await test('anonymous user cannot read worker verification', async () => {
            const res = await request(app).get('/api/v1/worker/verification');
            assert.equal(res.status, 401);
        });

        await test('admin cannot use worker verification endpoint', async () => {
            const res = await adminAgent.get('/api/v1/worker/verification');
            assert.equal(res.status, 403);
        });

        await test('worker verification requires PAN by default', async () => {
            const res = await workerAgent.get('/api/v1/worker/verification');
            assert.ok(res.body.data.requiredDocumentTypes.includes('PAN'));
        });

        await test('new worker has empty submission history', async () => {
            const res = await workerAgent.get('/api/v1/worker/verification');
            assert.deepEqual(res.body.data.submissionHistory, []);
        });

        // Save profile draft
        await test('worker profile draft updates successfully', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/profile').send({
                fullName: 'Test Worker Legal Name',
                dateOfBirth: '1995-05-15',
                phone: '9998887776',
                address: '123 Tech Park',
                city: 'Bengaluru',
                state: 'Karnataka',
                postalCode: '560001',
                country: 'India',
                profilePhotoId: 'https://images.unsplash.com/photo-1544025162-d76694265947'
            });
            if (res.status !== 200) console.error('Save profile draft failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
        });

        // Save professional details draft
        await test('worker professional details update successfully', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/professional-details').send({
                primaryServiceCategoryId: cat._id.toString(),
                serviceCategoryIds: [cat._id.toString()],
                skills: ['Dusting', 'Sanitation'],
                languages: ['English', 'Kannada'],
                hourlyRate: 25000, // ₹250
                dailyRate: 150000, // ₹1500
                serviceRadiusKm: 15,
                bio: 'Experienced professional cleaner.',
                yearsOfExperience: 5
            });
            if (res.status !== 200) console.error('Save professional draft failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
        });

        // Create buffers with correct magic bytes
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
        const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

        // Upload documents
        await test('uploading doc with invalid magic bytes fails', async () => {
            const badBuffer = Buffer.from('non-matching content');
            const res = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'AADHAAR')
                .field('documentNumber', '123412341234')
                .attach('file', badBuffer, 'aadhaar.png');
            if (res.status !== 400) console.error('Invalid magic bytes failure:', res.status, res.body);
            assert.equal(res.status, 400);
            assert.ok(res.body.message.includes('File security or type check failed') || (res.body.errorCode && res.body.errorCode.includes('file format signature check failed')));
        });

        await test('uploading valid AADHAAR succeeds', async () => {
            const res = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'AADHAAR')
                .field('documentNumber', '123412341234')
                .attach('file', pngBuffer, 'aadhaar.png');
            if (res.status !== 201) console.error('Upload Aadhaar failure:', res.status, res.body);
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        await test('uploading valid ADDRESS_PROOF succeeds', async () => {
            const res = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'ADDRESS_PROOF')
                .field('documentNumber', 'ELEC88776655')
                .attach('file', pdfBuffer, 'utility_bill.pdf');
            if (res.status !== 201) console.error('Upload proof failure:', res.status, res.body);
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        await test('uploading valid PAN succeeds', async () => {
            const res = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'pan.png');
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        // Submit for verification
        let submissionId;
        await test('submit verification workflow succeeds and updates status to PENDING_APPROVAL', async () => {
            const res = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            if (res.status !== 200) console.error('Submit verification failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const statusRes = await workerAgent.get('/api/v1/worker/verification');
            assert.equal(statusRes.body.data.profile.verificationStatus, 'PENDING_APPROVAL');
        });

        // Check search visibility
        await test('worker in PENDING_APPROVAL is excluded from customer search results', async () => {
            const searchRes = await workerAgent.get('/api/workers/search?categoryId=' + cat._id.toString());
            const hasWorker = (searchRes.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasWorker, false);
        });

        // Admin Auditing
        await test('admin can fetch worker verification submissions list', async () => {
            const res = await adminAgent.get('/api/v1/admin/worker-verifications?status=PENDING_APPROVAL');
            if (res.status !== 200) console.error('Fetch queue failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.ok(res.body.data.length > 0);
            submissionId = res.body.data[0]._id;
        });

        await test('admin can fetch single submission details', async () => {
            const res = await adminAgent.get(`/api/v1/admin/worker-verifications/${submissionId}`);
            if (res.status !== 200) console.error('Fetch submission detail failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.ok(res.body.data.submission.documentIds.length > 0);
        });

        // Approve document AADHAAR
        await test('admin approves AADHAAR document successfully', async () => {
            const subDetail = await adminAgent.get(`/api/v1/admin/worker-verifications/${submissionId}`);
            const aadhaarDoc = subDetail.body.data.submission.documentIds.find(d => d.documentType === 'AADHAAR');
            
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${aadhaarDoc._id}/approve`);
            if (res.status !== 200) console.error('Approve doc failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
        });

        // Request changes on ADDRESS_PROOF
        await test('admin requests changes on ADDRESS_PROOF document', async () => {
            const subDetail = await adminAgent.get(`/api/v1/admin/worker-verifications/${submissionId}`);
            const proofDoc = subDetail.body.data.submission.documentIds.find(d => d.documentType === 'ADDRESS_PROOF');

            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${proofDoc._id}/request-changes`).send({
                reasonCode: 'INVALID_DOCUMENT',
                comment: 'Please upload a clear scan of your bill.'
            });
            if (res.status !== 200) console.error('Request doc changes failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
        });

        // Final request changes action
        await test('admin issues final changes-required request on submission', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/request-changes`).send({
                reasonCode: 'NAME_MISMATCH',
                comment: 'Correct mismatching names on proof.'
            });
            if (res.status !== 200) console.error('Final request changes failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const workerStatus = await workerAgent.get('/api/v1/worker/verification');
            assert.equal(workerStatus.body.data.profile.verificationStatus, 'CHANGES_REQUIRED');
        });

        // Worker fixes and resubmits
        await test('worker fixes requested corrections and uploads new document version', async () => {
            // First remove old document
            const workerStatus = await workerAgent.get('/api/v1/worker/verification');
            const proofDoc = workerStatus.body.data.uploadedDocuments.find(d => d.documentType === 'ADDRESS_PROOF');
            
            await workerAgent.delete(`/api/v1/worker/verification/documents/${proofDoc.id}`);

            // Re-upload correct file
            const uploadRes = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'ADDRESS_PROOF')
                .field('documentNumber', 'ELEC88776655')
                .attach('file', pdfBuffer, 'clear_bill.pdf');
            assert.equal(uploadRes.status, 201);

            // Re-submit
            const res = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(res.status, 200);
        });

        // Final Approve
        await test('admin approves documents first and then issues final approval on resubmitted worker profile', async () => {
            const listRes = await adminAgent.get('/api/v1/admin/worker-verifications?status=PENDING_APPROVAL');
            const resubmittedSubId = listRes.body.data[0]._id;

            // Get detail of resubmitted submission
            const detailRes = await adminAgent.get(`/api/v1/admin/worker-verifications/${resubmittedSubId}`);
            
            // Loop through documents and approve any that are not already approved
            for (const doc of detailRes.body.data.submission.documentIds) {
                if (doc.verificationStatus !== 'APPROVED') {
                    const approveDocRes = await adminAgent.post(`/api/v1/admin/worker-verifications/${resubmittedSubId}/documents/${doc._id}/approve`);
                    assert.equal(approveDocRes.status, 200);
                }
            }

            // Now perform final submission approval!
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${resubmittedSubId}/approve`);
            if (res.status !== 200) console.error('Approve profile failure:', res.status, res.body);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const workerStatus = await workerAgent.get('/api/v1/worker/verification');
            assert.equal(workerStatus.body.data.profile.verificationStatus, 'APPROVED');
        });

        // Search verification after approval
        await test('approved worker appears in customer search results', async () => {
            const searchRes = await workerAgent.get('/api/workers/search?categoryId=' + cat._id.toString());
            const hasWorker = (searchRes.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasWorker, true);
        });

        // Suspension tests
        await test('admin can suspend worker account', async () => {
            const res = await adminAgent.post(`/api/v1/admin/workers/${workerUser._id.toString()}/suspend`).send({
                reason: 'Violation of service terms.'
            });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const workerStatus = await workerAgent.get('/api/v1/worker/verification');
            assert.equal(workerStatus.body.data.profile.verificationStatus, 'SUSPENDED');
        });

        await test('suspended worker is excluded from search results', async () => {
            const searchRes = await workerAgent.get('/api/workers/search?categoryId=' + cat._id.toString());
            const hasWorker = (searchRes.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasWorker, false);
        });

        await test('admin can restore worker account', async () => {
            const res = await adminAgent.post(`/api/v1/admin/workers/${workerUser._id.toString()}/restore`);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const workerStatus = await workerAgent.get('/api/v1/worker/verification');
            assert.equal(workerStatus.body.data.profile.verificationStatus, 'APPROVED');
        });

        await test('restored worker is again visible in search results', async () => {
            const searchRes = await workerAgent.get('/api/workers/search?categoryId=' + cat._id.toString());
            const hasWorker = (searchRes.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasWorker, true);
        });

        console.log(`WORKER_VERIFICATION_TESTS_EXECUTED=${passed + failed} PASSED=${passed} FAILED=${failed}`);
        if (failed > 0) {
            throw new Error('Worker verification integration tests failed:\n' + failures.join('\n'));
        }
    } finally {
        await stopTestEnvironment();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
