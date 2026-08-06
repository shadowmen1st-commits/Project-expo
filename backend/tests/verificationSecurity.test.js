process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_DATA_ENCRYPTION_KEY = 'test-encryption-key-must-be-long-32-chars';

import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import VerificationSubmission from '../src/models/VerificationSubmission.js';
import VerificationDocument from '../src/models/VerificationDocument.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import AuditLog from '../src/models/AuditLog.js';
import Booking from '../src/models/Booking.js';
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
        // Setup Category
        const cat = await ServiceCategory.create({
            name: 'Plumbing',
            slug: 'plumbing',
            description: 'Plumbing and leak repairs',
            defaultCommission: 10,
            icon: 'Wrench',
            isActive: true
        });

        // Setup Worker User
        const workerUser = await User.create({
            name: 'Alice Plumber',
            email: 'alice@test.local',
            phone: '9998883331',
            passwordHash: await hashPassword('AlicePass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        // Setup Customer User
        const customerUser = await User.create({
            name: 'Bob Customer',
            email: 'bob@test.local',
            phone: '9998883332',
            passwordHash: await hashPassword('BobPass123'),
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });

        // Setup Admin User
        const adminUser = await User.create({
            name: 'Sys Admin',
            email: 'admin@test.local',
            phone: '9998883333',
            passwordHash: await hashPassword('AdminPass123'),
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        // Another Worker
        const otherWorkerUser = await User.create({
            name: 'Charlie Worker',
            email: 'charlie@test.local',
            phone: '9998883334',
            passwordHash: await hashPassword('CharliePass123'),
            role: 'WORKER',
            status: 'ACTIVE'
        });

        // Login agents
        const workerAgent = request.agent(app);
        await workerAgent.post('/api/auth/login').send({ email: workerUser.email, password: 'AlicePass123' });

        const customerAgent = request.agent(app);
        await customerAgent.post('/api/auth/login').send({ email: customerUser.email, password: 'BobPass123' });

        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: adminUser.email, password: 'AdminPass123' });

        const otherWorkerAgent = request.agent(app);
        await otherWorkerAgent.post('/api/auth/login').send({ email: otherWorkerUser.email, password: 'CharliePass123' });

        // Initialize Profile (Pending/Incomplete initially)
        const profile = new WorkerProfile({
            userId: workerUser._id,
            fullName: 'Alice Plumber Legal',
            primaryServiceCategoryId: cat._id,
            serviceCategoryIds: [cat._id],
            verificationStatus: 'INCOMPLETE_PROFILE',
            hourlyRate: 30000,
            dailyRate: 200000,
            availability: [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, start: '00:00', end: '23:59', isWorking: true }))
        });
        await profile.save();

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

        // Upload documents for Alice
        const uploadAadhaarRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'AADHAAR')
            .field('documentNumber', '111122223333')
            .attach('file', pngBuffer, 'aadhaar.png');
        assert.equal(uploadAadhaarRes.status, 201);
        const aadhaarDocId = uploadAadhaarRes.body.document.id;

        const uploadProofRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'ADDRESS_PROOF')
            .field('documentNumber', 'ELEC88776655')
            .attach('file', pngBuffer, 'address.png');
        assert.equal(uploadProofRes.status, 201);
        const proofDocId = uploadProofRes.body.document.id;

        const uploadPanRes = await workerAgent.post('/api/v1/worker/verification/documents')
            .field('documentType', 'PAN')
            .field('documentNumber', 'ABCDE1234F')
            .attach('file', pngBuffer, 'pan.png');
        assert.equal(uploadPanRes.status, 201);
        const panDocId = uploadPanRes.body.document.id;

        // 1. KYC details absent from public worker DTO
        await test('KYC data is absent in public profile DTO', async () => {
            const res = await customerAgent.get(`/api/workers/profile/${workerUser._id}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.data.documentNumberEncrypted, undefined);
            assert.equal(res.body.data.documentNumberLast4, undefined);
        });

        // 2. KYC details absent from customer search DTO
        await test('KYC data is absent in search results', async () => {
            const res = await customerAgent.get(`/api/workers/search?categoryId=${cat._id}`);
            assert.equal(res.status, 200);
            const list = res.body.data || [];
            list.forEach(w => {
                assert.equal(w.documentNumberEncrypted, undefined);
                assert.equal(w.documentNumberHash, undefined);
            });
        });

        // 3. Document access check: authentication mandatory
        await test('accessing document without auth returns 401', async () => {
            const res = await request(app).get(`/api/v1/worker/verification/documents/${aadhaarDocId}/access`);
            assert.equal(res.status, 401);
        });

        // 4. Cross-document access check: other worker is rejected
        await test('other worker cannot access alice document file', async () => {
            const res = await otherWorkerAgent.get(`/api/v1/worker/verification/documents/${aadhaarDocId}/access`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 5. Customer blocked from document access
        await test('customer cannot access worker document file', async () => {
            const res = await customerAgent.get(`/api/v1/worker/verification/documents/${aadhaarDocId}/access`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 6. Mass assignment: worker cannot modify verificationStatus directly
        await test('worker cannot mass-assign verificationStatus', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/profile').send({
                fullName: 'Alice Hacker',
                verificationStatus: 'APPROVED' // Should be ignored or rejected
            });
            assert.equal(res.status, 200);
            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.notEqual(p.verificationStatus, 'APPROVED');
        });

        // 7. NoSQL injection in category ID fails validation
        await test('NoSQL injection in category ID is rejected', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/professional-details').send({
                primaryServiceCategoryId: { $gt: '' },
                bio: 'Experienced plumber for all home needs.',
                yearsOfExperience: 5
            });
            assert.equal(res.status, 400);
        });

        // 8. Prototype pollution check
        await test('Prototype pollution payload handled safely', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/profile').send(JSON.parse('{"__proto__": {"polluted": true}}'));
            assert.equal(res.status, 200);
            assert.equal({}.polluted, undefined);
        });

        // 9. Invalid ObjectId handled safely
        await test('Invalid ObjectId parameter returns 400/404 safely', async () => {
            const res = await workerAgent.get('/api/v1/worker/verification/documents/invalid-id/access');
            assert.equal(res.status, 400); // Mapped to 400 Bad Request by CastError handler
        });

        // 10. Worker in INCOMPLETE_PROFILE status cannot accept bookings
        await test('worker in INCOMPLETE_PROFILE status is blocked from accepting bookings', async () => {
            const mockBooking = await Booking.create({
                bookingNumber: 'B-SEC-101',
                customerId: customerUser._id,
                workerId: workerUser._id,
                serviceCategoryId: cat._id,
                serviceAddress: '123 Address',
                scheduledStart: new Date(Date.now() + 86400000),
                scheduledEnd: new Date(Date.now() + 86400000 + 3600000),
                pricingType: 'HOURLY',
                durationMinutes: 60,
                baseAmount: 10000,
                platformFee: 500,
                taxAmount: 1800,
                commissionPercentage: 10,
                commissionAmount: 1000,
                workerEarning: 9000,
                totalAmount: 12300,
                bookingStatus: 'PAYMENT_PENDING'
            });

            const res = await workerAgent.post(`/api/v1/bookings/${mockBooking._id}/accept`);
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 11. Worker in INCOMPLETE_PROFILE status cannot request payout
        await test('worker in INCOMPLETE_PROFILE status is blocked from payout actions', async () => {
            const res = await workerAgent.post('/api/workers/payouts').send({
                amountPaise: 5000,
                payoutAccountId: 'mock-account-id',
                preferredMode: 'IMPS'
            });
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // 12. Worker in INCOMPLETE_PROFILE status is excluded from search
        await test('worker in INCOMPLETE_PROFILE status is excluded from search', async () => {
            const res = await customerAgent.get(`/api/workers/search?categoryId=${cat._id}`);
            const hasAlice = (res.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasAlice, false);
        });

        // Populate fields and submit
        await workerAgent.put('/api/v1/worker/verification/profile').send({
            fullName: 'Alice Plumber Legal',
            dateOfBirth: '1995-01-01',
            phone: '9998883331',
            address: '123 Test Ave',
            city: 'Bangalore',
            state: 'Karnataka',
            postalCode: '560001',
            profilePhotoId: 'https://images.unsplash.com/photo-1544025162-d76694265947'
        });

        await workerAgent.put('/api/v1/worker/verification/professional-details').send({
            primaryServiceCategoryId: cat._id,
            bio: 'Experienced plumber for all home needs.',
            yearsOfExperience: 5,
            hourlyRate: 30000,
            dailyRate: 200000,
            serviceRadiusKm: 10
        });

        const subRes = await workerAgent.post('/api/v1/worker/verification/submit').send({
            declarationAccepted: true,
            consentAccepted: true
        });
        assert.equal(subRes.status, 200);
        const submissionId = subRes.body.data.submissionId;

        // 13. Pending approval worker excluded from search
        await test('worker in PENDING_APPROVAL status is excluded from search', async () => {
            const res = await customerAgent.get(`/api/workers/search?categoryId=${cat._id}`);
            const hasAlice = (res.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasAlice, false);
        });

        // 14. Pending approval worker cannot accept booking
        await test('worker in PENDING_APPROVAL status is blocked from accepting bookings', async () => {
            const mockBooking = await Booking.create({
                bookingNumber: 'B-SEC-102',
                customerId: customerUser._id,
                workerId: workerUser._id,
                serviceCategoryId: cat._id,
                serviceAddress: '123 Address',
                scheduledStart: new Date(Date.now() + 86400000),
                scheduledEnd: new Date(Date.now() + 86400000 + 3600000),
                pricingType: 'HOURLY',
                durationMinutes: 60,
                baseAmount: 10000,
                platformFee: 500,
                taxAmount: 1800,
                commissionPercentage: 10,
                commissionAmount: 1000,
                workerEarning: 9000,
                totalAmount: 12300,
                bookingStatus: 'PAYMENT_PENDING'
            });

            const res = await workerAgent.post(`/api/v1/bookings/${mockBooking._id}/accept`);
            assert.equal(res.status, 403);
        });

        // 15. Pending approval worker cannot request payout account registration
        await test('worker in PENDING_APPROVAL status is blocked from payout registration', async () => {
            const res = await workerAgent.post('/api/workers/payout-accounts').send({
                accountType: 'BANK_ACCOUNT',
                bankName: 'Test Bank',
                accountNumber: '1234567890',
                ifscCode: 'UTIB0000123'
            });
            assert.equal(res.status, 403);
            assert.equal(res.body.errorCode, 'UNAUTHORIZED');
        });

        // Admin approve documents & final submission
        await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${aadhaarDocId}/approve`);
        await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${proofDocId}/approve`);
        await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/documents/${panDocId}/approve`);
        await adminAgent.post(`/api/v1/admin/worker-verifications/${submissionId}/approve`);

        // 16. Approved worker is searchable
        await test('approved worker appears in search results', async () => {
            const res = await customerAgent.get(`/api/workers/search?categoryId=${cat._id}`);
            if (res.status !== 200 || !res.body.data.some(w => w.workerId === workerUser._id.toString())) {
                console.error('SEARCH_FAILED_BODY:', res.body);
                const prof = await WorkerProfile.findOne({ userId: workerUser._id });
                console.error('SEARCH_FAILED_PROFILE:', prof);
            }
            const hasAlice = (res.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasAlice, true);
        });

        // 17. Approved worker can register payout account
        await test('approved worker can register payout accounts', async () => {
            const res = await workerAgent.post('/api/workers/payout-accounts').send({
                accountType: 'VPA',
                vpa: 'alice@upi',
                displayName: 'UPI Account',
                beneficiaryName: 'Alice Plumber'
            });
            if (res.status !== 201) console.error('PAYOUT_ACC_FAILED_BODY:', res.body);
            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
        });

        // 18. Suspend worker blocks booking acceptance
        await test('suspended worker is blocked from accepting bookings', async () => {
            // Suspend first
            await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/suspend`).send({
                reason: 'Violation.'
            });

            const mockBooking = await Booking.create({
                bookingNumber: 'B-SEC-103',
                customerId: customerUser._id,
                workerId: workerUser._id,
                serviceCategoryId: cat._id,
                serviceAddress: '123 Address',
                scheduledStart: new Date(Date.now() + 86400000),
                scheduledEnd: new Date(Date.now() + 86400000 + 3600000),
                pricingType: 'HOURLY',
                durationMinutes: 60,
                baseAmount: 10000,
                platformFee: 500,
                taxAmount: 1800,
                commissionPercentage: 10,
                commissionAmount: 1000,
                workerEarning: 9000,
                totalAmount: 12300,
                bookingStatus: 'PAYMENT_PENDING'
            });

            const res = await workerAgent.post(`/api/v1/bookings/${mockBooking._id}/accept`);
            assert.equal(res.status, 403);
        });

        // 19. Suspended worker is excluded from search
        await test('suspended worker is excluded from search results', async () => {
            const res = await customerAgent.get(`/api/workers/search?categoryId=${cat._id}`);
            const hasAlice = (res.body.data || []).some(w => w.workerId === workerUser._id.toString());
            assert.equal(hasAlice, false);
        });

        // 20. Suspended worker cannot request payout
        await test('suspended worker cannot request payouts', async () => {
            const res = await workerAgent.post('/api/workers/payouts').send({
                amountPaise: 5000,
                payoutAccountId: 'mock-account-id',
                preferredMode: 'IMPS'
            });
            assert.equal(res.status, 403);
        });

        // Restore worker
        await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/restore`);

        // 21. Audit log does not leak document numbers
        await test('audit logs do not log sensitive document numbers', async () => {
            const logs = await AuditLog.find({ actor: workerUser._id });
            logs.forEach(log => {
                if (log.metadata) {
                    const metaStr = JSON.stringify(log.metadata);
                    assert.equal(metaStr.includes('111122223333'), false);
                }
            });
        });

        // 22. Audit log does not leak signed URLs
        await test('audit logs do not log document signed URLs', async () => {
            const logs = await AuditLog.find({ action: 'ADMIN_DOCUMENT_VIEW_ACCESS' });
            logs.forEach(log => {
                if (log.metadata) {
                    const metaStr = JSON.stringify(log.metadata);
                    assert.equal(metaStr.includes('access_token') || metaStr.includes('signature'), false);
                }
            });
        });

        // 23. Document replacement preserves history
        await test('document replacement marks old document as isCurrent=false', async () => {
            // Initiate draft changes
            await adminAgent.post(`/api/v1/admin/workers/${workerUser._id}/suspend`).send({ reason: 'Re-audit.' });
            const repProfile = await WorkerProfile.findOne({ userId: workerUser._id });
            repProfile.verificationStatus = 'CHANGES_REQUIRED';
            await repProfile.save();

            const replaceRes = await workerAgent.put(`/api/v1/worker/verification/documents/${aadhaarDocId}`)
                .field('documentType', 'AADHAAR')
                .field('documentNumber', '111122223334')
                .attach('file', pngBuffer, 'aadhaar_v2.png');
            assert.equal(replaceRes.status, 201);

            const oldDocs = await VerificationDocument.find({ workerId: workerUser._id, documentType: 'AADHAAR', isCurrent: false });
            assert.ok(oldDocs.length > 0);
        });

        // 24. Expired document throws error on submission
        await test('submitting with expired document fails', async () => {
            // Set document expiry to past
            await VerificationDocument.updateMany({ workerId: workerUser._id }, { expiryDate: new Date(Date.now() - 86400000) });

            const res = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'DOCUMENT_EXPIRED');
        });

        // 25. Concurrent submit yields single submission session
        await test('concurrent submit requests return idempotent results', async () => {
            // Reset status to DRAFT and ensure complete fields and future expiry
            await WorkerProfile.updateOne({ userId: workerUser._id }, {
                verificationStatus: 'DRAFT',
                fullName: 'Alice Plumber Legal',
                dateOfBirth: '1995-01-01',
                phone: '9998883331',
                address: '123 Test Ave',
                city: 'Bangalore',
                state: 'Karnataka',
                postalCode: '560001',
                profilePhotoId: 'https://images.unsplash.com/photo-1544025162-d76694265947',
                primaryServiceCategoryId: cat._id,
                bio: 'Experienced plumber for all home needs.',
                yearsOfExperience: 5,
                hourlyRate: 30000,
                dailyRate: 200000,
                serviceRadiusKm: 10
            });
            await VerificationDocument.updateMany({ workerId: workerUser._id }, { expiryDate: new Date(Date.now() + 86400000) });

            // Concurrent calls
            const [r1, r2] = await Promise.all([
                workerAgent.post('/api/v1/worker/verification/submit').send({ declarationAccepted: true, consentAccepted: true }),
                workerAgent.post('/api/v1/worker/verification/submit').send({ declarationAccepted: true, consentAccepted: true })
            ]);

            assert.ok(r1.status === 200 || r2.status === 200);
            assert.ok(r1.status === 400 || r2.status === 400 || r1.status === 409 || r2.status === 409);
        });

        // 26. Invalid service category ID fails professional details save
        await test('invalid category ID fails professional details draft save', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/professional-details').send({
                primaryServiceCategoryId: '6a6f160c7d91efaff1f1855a' // Non-existent ID
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'SERVICE_NOT_ALLOWED');
        });

        // 27. Missing required profile fields throws PROFILE_INCOMPLETE on submit
        await test('submit fails with missing profile fields', async () => {
            // Set draft profile name to empty
            const activeProfile = await WorkerProfile.findOne({ userId: workerUser._id });
            activeProfile.fullName = '';
            activeProfile.verificationStatus = 'DRAFT';
            await activeProfile.save();

            const res = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: true,
                consentAccepted: true
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'PROFILE_INCOMPLETE');
        });

        // 28. Under age 18 profile draft rejected
        await test('dob indicating under 18 years old is rejected', async () => {
            const res = await workerAgent.put('/api/v1/worker/verification/profile').send({
                fullName: 'Alice Plumber Legal',
                dateOfBirth: '2015-01-01' // 11 years old
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'AGE_REQUIREMENT_NOT_MET');
        });

        // 29. Missing declaration accepted is rejected on submit
        await test('submit without declaration acceptance is rejected', async () => {
            const res = await workerAgent.post('/api/v1/worker/verification/submit').send({
                declarationAccepted: false,
                consentAccepted: true
            });
            assert.equal(res.status, 400);
            assert.equal(res.body.errorCode, 'DECLARATION_REQUIRED');
        });

        // 30. Direct status updates block check
        await test('arbitrary status update transitions are blocked', async () => {
            // Verify that random status cannot be set via draft
            const res = await workerAgent.put('/api/v1/worker/verification/profile').send({
                fullName: 'Alice Plumber Legal',
                verificationStatus: 'SUSPENDED'
            });
            const p = await WorkerProfile.findOne({ userId: workerUser._id });
            assert.notEqual(p.verificationStatus, 'SUSPENDED');
        });

        console.log(`VERIFICATION_SECURITY_TESTS_EXECUTED=${passed + failed} PASSED=${passed} FAILED=${failed}`);
        if (failed > 0) {
            throw new Error('Verification security tests failed:\n' + failures.join('\n'));
        }
    } finally {
        await stopTestEnvironment();
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
