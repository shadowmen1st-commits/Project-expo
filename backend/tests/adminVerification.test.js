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
import VerificationReviewEvent from '../src/models/VerificationReviewEvent.js';
import AuditLog from '../src/models/AuditLog.js';
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
            name: 'Driver Services',
            slug: 'driver',
            description: 'Professional driving services',
            defaultCommission: 12,
            icon: 'Car',
            isActive: true
        });

        // Setup test users: Worker, Admin, Customer, and Support
        const workerUser = await User.create({
            name: 'Alice Driver',
            email: 'alice@test.local',
            phone: '9998882222',
            passwordHash: await hashPassword('AlicePass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        const adminUser = await User.create({
            name: 'System Admin',
            email: 'admin@test.local',
            phone: '9998882221',
            passwordHash: await hashPassword('AdminPass123'),
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        const customerUser = await User.create({
            name: 'Bob Customer',
            email: 'bob@test.local',
            phone: '9998882223',
            passwordHash: await hashPassword('BobPass123'),
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });

        // Login agents
        const workerAgent = request.agent(app);
        await workerAgent.post('/api/auth/login').send({ email: workerUser.email, password: 'AlicePass123' });

        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: adminUser.email, password: 'AdminPass123' });

        const customerAgent = request.agent(app);
        await customerAgent.post('/api/auth/login').send({ email: customerUser.email, password: 'BobPass123' });

        // Initialize profile for worker
        const profile = new WorkerProfile({
            userId: workerUser._id,
            fullName: 'Alice Driver Legal',
            dateOfBirth: '1995-01-01',
            phone: '9998882222',
            address: '456 Drive Lane',
            city: 'Bangalore',
            state: 'Karnataka',
            postalCode: '560002',
            profilePhotoId: 'https://images.unsplash.com/photo-1544025162-d76694265947',
            primaryServiceCategoryId: cat._id,
            bio: 'Certified driver with extensive local city driving route experience.',
            yearsOfExperience: 6,
            hourlyRate: 20000,
            dailyRate: 150000,
            verificationStatus: 'DRAFT'
        });
        await profile.save();

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

        // Upload documents (Aadhaar & Driver License)
        const uploadAadhaarRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'AADHAAR')
            .field('documentNumber', '111122223333')
            .attach('file', pngBuffer, 'aadhaar.png');
        assert.equal(uploadAadhaarRes.status, 201);
        const aadhaarDocId = uploadAadhaarRes.body.document.id;

        const uploadLicenseRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'DRIVING_LICENSE')
            .field('documentNumber', 'KA01-2015-1234')
            .attach('file', pngBuffer, 'license.png');
        assert.equal(uploadLicenseRes.status, 201);
        const licenseDocId = uploadLicenseRes.body.document.id;

        const uploadAddressRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'ADDRESS_PROOF')
            .field('documentNumber', 'ADD123456789')
            .attach('file', pngBuffer, 'address.png');
        assert.equal(uploadAddressRes.status, 201);
        const addressDocId = uploadAddressRes.body.document.id;

        const uploadPanRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'PAN')
            .field('documentNumber', 'ABCDE1234F')
            .attach('file', pngBuffer, 'pan.png');
        assert.equal(uploadPanRes.status, 201);
        const panDocId = uploadPanRes.body.document.id;

        // Submit verification
        const submitRes = await workerAgent.post('/api/v1/worker/verification/submit').send({
            declarationAccepted: true,
            consentAccepted: true
        });
        assert.equal(submitRes.status, 200);
        const submissionId = submitRes.body.data.submissionId;

        // 1. Admin lists verifications (succeeds)
        await test('admin can view verification queue', async () => {
            const res = await adminAgent.get('/api/v1/admin/worker-verifications?status=PENDING_APPROVAL');
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.data.length > 0);
        });

        await test('verification queue status filter is enforced', async () => {
            const res = await adminAgent.get('/api/v1/admin/worker-verifications?status=APPROVED');
            assert.equal(res.status, 200);
            assert.equal(res.body.data.length, 0);
        });

        await test('invalid submission identifier is rejected safely', async () => {
            const res = await adminAgent.get('/api/v1/admin/worker-verifications/not-an-object-id');
            assert.equal(res.status, 400);
        });

        // 2. Customer denied listing queue
        await test('customer is blocked from listing verification queue', async () => {
            const res = await customerAgent.get('/api/v1/admin/worker-verifications');
            assert.equal(res.status, 403);
        });

        // 3. Worker denied listing queue
        await test('worker is blocked from listing verification queue', async () => {
            const res = await workerAgent.get('/api/v1/admin/worker-verifications');
            assert.equal(res.status, 403);
        });

        // 4. Detailed submission view
        await test('admin can retrieve submission detail', async () => {
            const res = await adminAgent.get(`/api/v1/admin/worker-verifications/${submissionId}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.data.submission._id, submissionId);
        });

        // 5. Start review session
        await test('admin starts review session', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/start-review`);
            assert.equal(res.status, 200);
            assert.ok(res.body.data.reviewStartedAt);

            // Audit verification event
            const event = await VerificationReviewEvent.findOne({ submissionId, action: 'START_REVIEW' });
            assert.ok(event);
        });

        // 6. Approve one document
        await test('admin approves single document', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${aadhaarDocId}/approve`);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const doc = await VerificationDocument.findById(aadhaarDocId);
            assert.equal(doc.verificationStatus, 'APPROVED');
        });

        // 7. Request document changes fails without reason code
        await test('request document changes fails without reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${licenseDocId}/request-changes`).send({
                comment: 'Please upload a clearer copy.'
            });
            assert.equal(res.status, 400);
        });

        // 8. Request document changes succeeds
        await test('request document changes succeeds with reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${licenseDocId}/request-changes`).send({
                reasonCode: 'BLURRY_IMAGE',
                comment: 'Please upload a clearer copy.'
            });
            assert.equal(res.status, 200);

            const doc = await VerificationDocument.findById(licenseDocId);
            assert.equal(doc.verificationStatus, 'CHANGES_REQUIRED');
        });

        // 9. Reject document fails without reason code
        await test('reject document fails without reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${licenseDocId}/reject`).send({
                comment: 'Fake document detected.'
            });
            assert.equal(res.status, 400);
        });

        // 10. Reject document succeeds
        await test('reject document succeeds with reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${licenseDocId}/reject`).send({
                reasonCode: 'INVALID_DOCUMENT',
                comment: 'Fake document detected.'
            });
            assert.equal(res.status, 200);

            const doc = await VerificationDocument.findById(licenseDocId);
            assert.equal(doc.verificationStatus, 'REJECTED');
        });

        // 11. Final request changes fails without reason
        await test('final request changes submission fails without reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/request-changes`).send({
                comment: 'Fix profile details.'
            });
            assert.equal(res.status, 400);
        });

        // 12. Final request changes succeeds
        await test('final request changes submission succeeds with reasonCode', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/request-changes`).send({
                reasonCode: 'INCOMPLETE_DOCUMENTS',
                comment: 'Fix profile details.'
            });
            assert.equal(res.status, 200);

            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.equal(p.verificationStatus, 'CHANGES_REQUIRED');
        });

        // Worker replaces rejected/changes required document
        await test('worker replaces document and resubmits profile', async () => {
            // Soft delete old document
            const delRes = await workerAgent.delete(`/api/v1/worker/verification/documents/${licenseDocId}`);
            assert.equal(delRes.status, 200);

            // Upload replacement
            const uploadRepRes = await workerAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'DRIVING_LICENSE')
                .field('documentNumber', 'KA01-2015-1234')
                .attach('file', pngBuffer, 'license_v2.png');
            assert.equal(uploadRepRes.status, 201);
            const newLicenseDocId = uploadRepRes.body.document.id;

            // Re-submit
            const resubRes = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(resubRes.status, 200);

            // Admin approve new document
            const newSubId = resubRes.body.data.submissionId;
            const approveDocRes = await adminAgent.post(`/api/v1/admin/worker-verifications/${newSubId}/documents/${newLicenseDocId}/approve`);
            assert.equal(approveDocRes.status, 200);

            const approveAddressRes = await adminAgent.post(`/api/v1/admin/worker-verifications/${newSubId}/documents/${addressDocId}/approve`);
            assert.equal(approveAddressRes.status, 200);

            const approveAadhaarRes = await adminAgent.post(`/api/v1/admin/worker-verifications/${newSubId}/documents/${aadhaarDocId}/approve`);
            assert.equal(approveAadhaarRes.status, 200);
            const approvePanRes = await adminAgent.post(`/api/v1/admin/worker-verifications/${newSubId}/documents/${panDocId}/approve`);
            assert.equal(approvePanRes.status, 200);
        });

        // Get new submission ID
        const activeSubRes = await adminAgent.get('/api/v1/admin/worker-verifications?status=PENDING_APPROVAL');
        const activeSubId = activeSubRes.body.data[0]._id;

        // 13. Final approval succeeds
        await test('final approval succeeds', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${activeSubId}/approve`);
            if (res.status !== 200) console.error('FINAL_APPROVAL_FAILED_BODY:', res.body);
            assert.equal(res.status, 200);

            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.equal(p.verificationStatus, 'APPROVED');
            assert.equal(p.verificationBadge, true);
        });

        // 14. Final approval duplicate action is idempotent
        await test('final approval is idempotent', async () => {
            const res = await adminAgent.post(`/api/v1/admin/worker-verifications/${activeSubId}/approve`);
            if (res.status !== 200) console.error('FINAL_IDEMPOTENT_FAILED_BODY:', res.body);
            assert.equal(res.status, 200);
        });

        // 15. Suspension fails without reason
        await test('suspend worker fails without reason', async () => {
            const res = await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/suspend`).send({});
            assert.equal(res.status, 400);
        });

        // 16. Suspension succeeds with reason
        await test('suspend worker succeeds with reason', async () => {
            const res = await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/suspend`).send({
                reason: 'Service violation.'
            });
            assert.equal(res.status, 200);

            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.equal(p.verificationStatus, 'SUSPENDED');
            assert.equal(p.suspensionReason, 'Service violation.');
        });

        // 17. Restore worker succeeds
        await test('restore suspended worker succeeds', async () => {
            const res = await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/restore`);
            assert.equal(res.status, 200);

            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.equal(p.verificationStatus, 'APPROVED');
            assert.equal(p.suspensionReason, undefined);

            const audit = await AuditLog.findOne({ action: 'ADMIN_WORKER_RESTORE', resourceId: p._id.toString() });
            assert.ok(audit);
        });

        console.log(`ADMIN_VERIFICATION_TESTS_EXECUTED=${passed + failed} PASSED=${passed} FAILED=${failed}`);
        if (failed > 0) {
            throw new Error('Admin verification integration tests failed:\n' + failures.join('\n'));
        }
    } finally {
        await stopTestEnvironment();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
