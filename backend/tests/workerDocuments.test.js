process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
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
        // Setup a service category
        const cat = await ServiceCategory.create({
            name: 'Electrical Work',
            slug: 'electrical-work',
            description: 'Electrical wiring and appliance work',
            defaultCommission: 12,
            icon: 'Zap',
            isActive: true
        });

        // Worker User
        const workerUser = await User.create({
            name: 'Worker Bob',
            email: 'bob@test.local',
            phone: '9998881111',
            passwordHash: await hashPassword('BobPass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        // Another Worker User
        const otherWorkerUser = await User.create({
            name: 'Worker Charlie',
            email: 'charlie@test.local',
            phone: '9998881112',
            passwordHash: await hashPassword('CharliePass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        // Customer User
        const customerUser = await User.create({
            name: 'Customer Dave',
            email: 'dave@test.local',
            phone: '8887771111',
            passwordHash: await hashPassword('DavePass123'),
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });

        // Login agents
        const bobAgent = request.agent(app);
        await bobAgent.post('/api/auth/login').send({ email: workerUser.email, password: 'BobPass123' });

        const charlieAgent = request.agent(app);
        await charlieAgent.post('/api/auth/login').send({ email: otherWorkerUser.email, password: 'CharliePass123' });

        const daveAgent = request.agent(app);
        await daveAgent.post('/api/auth/login').send({ email: customerUser.email, password: 'DavePass123' });

        // Initialize Profile
        const profile = new WorkerProfile({
            userId: workerUser._id,
            fullName: 'Worker Bob Legal',
            primaryServiceCategoryId: cat._id,
            verificationStatus: 'INCOMPLETE_PROFILE'
        });
        await profile.save();

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
        const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

        // 1. Valid PNG upload
        await test('upload valid png document succeeds', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'AADHAAR')
                .field('documentNumber', '111122223333')
                .attach('file', pngBuffer, 'aadhaar.png');
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.document.documentType, 'AADHAAR');
            assert.equal(res.body.document.documentNumberLast4, '3333');
        });

        // 2. Valid PDF upload
        let addressDocId;
        await test('upload valid pdf document succeeds', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'ADDRESS_PROOF')
                .field('documentNumber', 'ADD123456789')
                .attach('file', pdfBuffer, 'address.pdf');
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            addressDocId = res.body.document.id;
        });

        await test('upload valid PAN document succeeds', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'pan.png');
            assert.equal(res.status, 201);
        });

        // 3. Oversized file rejected
        await test('upload oversized file fails', async () => {
            const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', bigBuffer, 'pan.png');
            assert.equal(res.status, 400);
        });

        // 4. Executable signature/extension check fails
        await test('upload executable (.exe) fails', async () => {
            const exeBuffer = Buffer.from('MZ\0\0\0\0\0\0\0\0\0\0\0\0\0\0'); // Exe signature PE MZ
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', exeBuffer, 'malicious.exe');
            assert.equal(res.status, 400);
            assert.ok(res.body.message.includes('check failed') || res.body.errorCode === 'FILE_EXTENSION_NOT_ALLOWED');
        });

        // 5. HTML files blocked
        await test('upload HTML file fails', async () => {
            const htmlBuffer = Buffer.from('<!DOCTYPE html><html></html>');
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', htmlBuffer, 'malicious.html');
            assert.equal(res.status, 400);
        });

        // 6. Invalid MIME type rejected
        await test('upload invalid mime type fails', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'aadhaar.txt'); // extension not allowed
            assert.equal(res.status, 400);
        });

        // 7. Double extension bypass check
        await test('upload double extension file fails', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'malicious.js.png');
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'FILE_RISKY_DOUBLE_EXTENSION');
        });

        // 8. Null-byte in filename rejected
        await test('upload filename with null-byte fails', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'aadhaar\0.png');
            assert.equal(res.status, 400);
        });

        // 9. Path traversal check
        await test('upload filename with path traversal fails', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, '..%2f..%2faadhaar.png');
            assert.equal(res.status, 400);
        });

        // 10. Document number masked in frontend safe DTO response
        await test('document number is masked in the response', async () => {
            const res = await bobAgent.get('/api/v1/worker/verification');
            assert.equal(res.status, 200);
            const doc = res.body.data.uploadedDocuments.find(d => d.documentType === 'AADHAAR');
            assert.equal(doc.documentNumberLast4, '3333');
            assert.equal(doc.documentNumber, undefined); // Sensitive data should not leak
        });

        // 11. Stored key not returned in API response
        await test('document storage raw key is hidden', async () => {
            const res = await bobAgent.get('/api/v1/worker/verification');
            const doc = res.body.data.uploadedDocuments.find(d => d.documentType === 'AADHAAR');
            assert.equal(doc.frontFileId, undefined);
            assert.equal(doc.storageProvider, undefined);
        });

        // 12. Owner can access their own document file stream
        await test('owner worker can download their own document file', async () => {
            const res = await bobAgent.get(`/api/v1/worker/verification/documents/${addressDocId}/access`);
            assert.equal(res.status, 200);
            assert.equal(res.headers['content-type'], 'application/pdf');
        });

        // 13. Other worker blocked from document access
        await test('other worker is denied access to document', async () => {
            const res = await charlieAgent.get(`/api/v1/worker/verification/documents/${addressDocId}/access`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 14. Customer blocked from document access
        await test('customer is denied access to document', async () => {
            const res = await daveAgent.get(`/api/v1/worker/verification/documents/${addressDocId}/access`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 15. Delete document is allowed in DRAFT status
        await test('soft delete document in draft succeeds', async () => {
            const res = await bobAgent.delete(`/api/v1/worker/verification/documents/${addressDocId}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            const statusRes = await bobAgent.get('/api/v1/worker/verification');
            const activeDocs = statusRes.body.data.uploadedDocuments;
            assert.equal(activeDocs.some(d => d.id === addressDocId), false);
        });

        // 16. Cannot delete document if not owned
        await test('soft delete document not owned fails', async () => {
            // Upload to Charlie first
            const charlieProfile = new WorkerProfile({
                userId: otherWorkerUser._id,
                fullName: 'Charlie Legal',
                primaryServiceCategoryId: cat._id,
                verificationStatus: 'DRAFT'
            });
            await charlieProfile.save();

            const uploadRes = await charlieAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'AADHAAR')
                .field('documentNumber', '222233334444')
                .attach('file', pngBuffer, 'charlie.png');
            const docId = uploadRes.body.document.id;

            // Bob attempts to delete
            const res = await bobAgent.delete(`/api/v1/worker/verification/documents/${docId}`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'DOCUMENT_NOT_OWNED');
        });

        let drivingDocumentId;
        await test('first DRIVING_LICENSE upload creates version one', async () => {
            const res = await charlieAgent.post('/api/v1/worker/verification/documents')
                .set('Idempotency-Key', 'driving-create-1')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-123456')
                .attach('file', pngBuffer, 'license.png');
            assert.equal(res.status, 201);
            assert.equal(res.body.document.version, 1);
            drivingDocumentId = res.body.document.id;
        });

        await test('duplicate POST returns safe DOCUMENT_ALREADY_EXISTS response', async () => {
            const res = await charlieAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-654321')
                .attach('file', pngBuffer, 'license-new.png');
            assert.equal(res.status, 409);
            assert.equal(res.body.errorCode, 'DOCUMENT_ALREADY_EXISTS');
            assert.equal(res.body.allowedAction, 'REPLACE');
            assert.equal(res.body.frontFileId, undefined);
            assert.equal(res.body.documentNumberEncrypted, undefined);
        });

        await test('duplicate idempotency request returns original result', async () => {
            const res = await charlieAgent.post('/api/v1/worker/verification/documents')
                .set('Idempotency-Key', 'driving-create-1')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-123456')
                .attach('file', pngBuffer, 'license.png');
            assert.equal(res.status, 200);
            assert.equal(res.body.idempotent, true);
            assert.equal(res.body.document.id, drivingDocumentId);
        });

        await test('changed content with same idempotency key is rejected', async () => {
            const res = await charlieAgent.post('/api/v1/worker/verification/documents')
                .set('Idempotency-Key', 'driving-create-1')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-CHANGED')
                .attach('file', pngBuffer, 'license.png');
            assert.equal(res.status, 409);
            assert.equal(res.body.errorCode, 'IDEMPOTENCY_CONFLICT');
        });

        let replacementId;
        await test('PUT replacement preserves history and increments version', async () => {
            const res = await charlieAgent.put(`/api/v1/worker/verification/documents/${drivingDocumentId}`)
                .set('Idempotency-Key', 'driving-replace-1')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-654321')
                .attach('file', pngBuffer, 'replacement.png');
            assert.equal(res.status, 201);
            assert.equal(res.body.document.version, 2);
            replacementId = res.body.document.id;
            const oldDoc = await VerificationDocument.findById(drivingDocumentId);
            const replacement = await VerificationDocument.findById(replacementId);
            assert.equal(oldDoc.isCurrent, false);
            assert.equal(replacement.isCurrent, true);
            assert.equal(replacement.replacedDocumentId.toString(), drivingDocumentId);
            assert.equal(await VerificationDocument.countDocuments({ workerId: otherWorkerUser._id, documentType: 'DRIVING_LICENSE' }), 2);
            assert.equal(await VerificationDocument.countDocuments({ workerId: otherWorkerUser._id, documentType: 'DRIVING_LICENSE', isCurrent: true }), 1);
        });

        await test('current document DTO includes replacement and history count', async () => {
            const res = await charlieAgent.get('/api/v1/worker/verification');
            const doc = res.body.data.uploadedDocuments.find(item => item.documentType === 'DRIVING_LICENSE');
            assert.equal(doc.id, replacementId);
            assert.equal(doc.version, 2);
            assert.equal(doc.historicalVersionCount, 1);
        });

        await test('duplicate replacement idempotency request creates no version', async () => {
            const before = await VerificationDocument.countDocuments({ workerId: otherWorkerUser._id, documentType: 'DRIVING_LICENSE' });
            const res = await charlieAgent.put(`/api/v1/worker/verification/documents/${drivingDocumentId}`)
                .set('Idempotency-Key', 'driving-replace-1')
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-654321')
                .attach('file', pngBuffer, 'replacement.png');
            assert.equal(res.status, 200);
            assert.equal(res.body.idempotent, true);
            assert.equal(await VerificationDocument.countDocuments({ workerId: otherWorkerUser._id, documentType: 'DRIVING_LICENSE' }), before);
        });

        await test('concurrent replacements leave exactly one current version', async () => {
            const makeReplacement = key => charlieAgent.put(`/api/v1/worker/verification/documents/${replacementId}`)
                .set('Idempotency-Key', key)
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', `DL-${key}`)
                .attach('file', pngBuffer, `${key}.png`);
            const results = await Promise.all([makeReplacement('concurrent-a'), makeReplacement('concurrent-b')]);
            assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
            assert.equal(await VerificationDocument.countDocuments({ workerId: otherWorkerUser._id, documentType: 'DRIVING_LICENSE', isCurrent: true }), 1);
            assert.ok(['CONCURRENT_REPLACEMENT', 'DOCUMENT_NOT_CURRENT'].includes(results.find(result => result.status === 409).body.errorCode));
        });

        await test('worker cannot replace another worker document', async () => {
            const res = await bobAgent.put(`/api/v1/worker/verification/documents/${replacementId}`)
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-ATTACK')
                .attach('file', pngBuffer, 'attack.png');
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'DOCUMENT_NOT_OWNED');
        });

        await test('customer cannot access replacement route', async () => {
            const res = await daveAgent.put(`/api/v1/worker/verification/documents/${replacementId}`)
                .field('documentType', 'DRIVING_LICENSE').field('documentNumber', 'DL-ATTACK')
                .attach('file', pngBuffer, 'attack.png');
            assert.equal(res.status, 403);
        });

        // Re-upload ADDRESS_PROOF to Bob to satisfy verification requirement
        await bobAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'ADDRESS_PROOF')
            .field('documentNumber', 'ADD123456789')
            .attach('file', pdfBuffer, 'address.pdf');

        // Populate required profile fields
        await bobAgent.put('/api/v1/worker/verification/profile').send({
            fullName: 'Worker Bob Legal',
            dateOfBirth: '1990-01-01',
            phone: '9998881111',
            address: '123 Test Street',
            city: 'Bangalore',
            state: 'Karnataka',
            postalCode: '560001',
            profilePhotoId: 'https://images.unsplash.com/photo-1544025162-d76694265947'
        });

        await bobAgent.put('/api/v1/worker/verification/professional-details').send({
            primaryServiceCategoryId: cat._id,
            bio: 'Experienced electrician available for home service.',
            yearsOfExperience: 5,
            hourlyRate: 30000,
            dailyRate: 200000,
            serviceRadiusKm: 10
        });

        // 17. Submit verification snapshot succeeds
        let submissionId;
        await test('submit verification succeeds', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            submissionId = res.body.data.submissionId;
        });

        // 18. Cannot edit documents while review is pending
        await test('upload new document fails when PENDING_APPROVAL', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/documents')
                .field('documentType', 'PAN')
                .field('documentNumber', 'ABCDE1234F')
                .attach('file', pngBuffer, 'pan.png');
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'VERIFICATION_ALREADY_SUBMITTED');
        });

        // 19. Cannot delete document when PENDING_APPROVAL
        await test('delete document fails when PENDING_APPROVAL', async () => {
            const statusRes = await bobAgent.get('/api/v1/worker/verification');
            const doc = statusRes.body.data.uploadedDocuments.find(d => d.documentType === 'AADHAAR');

            const res = await bobAgent.delete(`/api/v1/worker/verification/documents/${doc.id}`);
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'DOCUMENT_REVIEW_LOCKED');
        });

        // 20. Resubmit fails if current status is PENDING_APPROVAL
        await test('resubmit fails when verification status is PENDING_APPROVAL', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/resubmit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'VERIFICATION_CHANGES_NOT_ALLOWED');
        });

        // 21. Profile Photo Upload Succeeds
        await test('upload valid png profile photo succeeds', async () => {
            // Restore draft status for bob first to allow upload
            await WorkerProfile.updateOne({ userId: workerUser._id }, { verificationStatus: 'DRAFT' });

            const res = await bobAgent.post('/api/v1/worker/verification/profile-photo')
                .attach('file', pngBuffer, 'avatar.png');
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.photoUrl);
            assert.ok(res.body.photoUrl.startsWith('/api/v1/worker/verification/profile-photo/file/'));
        });

        // 22. Profile Photo Upload Fails on Invalid MIME type
        await test('upload invalid profile photo format (PDF) fails', async () => {
            const res = await bobAgent.post('/api/v1/worker/verification/profile-photo')
                .attach('file', pdfBuffer, 'avatar.pdf');
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'INVALID_FILE_TYPE');
        });

        // 23. Served Profile Photo is reachable
        await test('serve profile photo file matches content type', async () => {
            const resPhoto = await bobAgent.post('/api/v1/worker/verification/profile-photo')
                .attach('file', pngBuffer, 'avatar.png');
            const fileUrl = resPhoto.body.photoUrl;
            
            const res = await request(app).get(fileUrl);
            assert.equal(res.status, 200);
            assert.equal(res.headers['content-type'], 'image/png');
        });

        console.log(`WORKER_DOCUMENTS_TESTS_EXECUTED=${passed + failed} PASSED=${passed} FAILED=${failed}`);
        if (failed > 0) {
            throw new Error('Worker document integration tests failed:\n' + failures.join('\n'));
        }
    } finally {
        await stopTestEnvironment();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
