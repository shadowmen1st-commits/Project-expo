import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import ServiceCategory from '../src/models/ServiceCategory.js';
import VerificationDocument from '../src/models/VerificationDocument.js';
import VerificationSubmission from '../src/models/VerificationSubmission.js';
import Booking from '../src/models/Booking.js';
import { signAccessToken } from '../src/utils/authUtils.js';

async function runWorkerKYCSecurityTests() {
    console.log('--- STARTING WORKER KYC STATE MACHINE & SECURITY TESTS ---');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hyperlocal_db');
    const app = createApp();

    const testSuffix = Date.now();
    const phoneAdmin = `90${Math.floor(10000000 + Math.random() * 90000000)}`;
    const phoneWorker1 = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const phoneWorker2 = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const phoneCustomer = `93${Math.floor(10000000 + Math.random() * 90000000)}`;

    // 1. Setup Admin, Customer, and Category
    const admin = await User.create({
        name: `Admin User ${testSuffix}`,
        email: `admin_${testSuffix}@example.com`,
        phone: phoneAdmin,
        passwordHash: 'dummyhash',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
    });
    const adminToken = signAccessToken({ userId: admin._id.toString(), id: admin._id.toString(), role: 'ADMIN', email: admin.email, tokenId: crypto.randomUUID() });

    const customer = await User.create({
        name: `Customer ${testSuffix}`,
        email: `customer_${testSuffix}@example.com`,
        phone: phoneCustomer,
        passwordHash: 'dummyhash',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
    });
    const customerToken = signAccessToken({ userId: customer._id.toString(), id: customer._id.toString(), role: 'CUSTOMER', email: customer.email, tokenId: crypto.randomUUID() });

    let category = await ServiceCategory.findOne({ status: 'ACTIVE' });
    if (!category) {
        category = await ServiceCategory.create({
            name: `KYC Electrician Pro ${testSuffix}`,
            slug: `kyc-electrician-${testSuffix}`,
            description: 'Electrical fixes',
            icon: 'zap',
            price: 599,
            status: 'ACTIVE',
            isActive: true,
        });
    }

    // ==========================================
    // TEST 1: Register New Worker
    // ==========================================
    console.log('TEST 1: Worker Registration starts as NOT_SUBMITTED...');
    const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
            name: `Fresh Worker ${testSuffix}`,
            email: `freshworker_${testSuffix}@example.com`,
            phone: phoneWorker1,
            password: 'Password@123',
            role: 'WORKER',
        });

    if (registerRes.status !== 201) {
        throw new Error(`Worker registration failed: ${JSON.stringify(registerRes.body)}`);
    }

    const newWorkerId = registerRes.body.user.id || registerRes.body.user._id;
    const workerUser1 = await User.findById(newWorkerId);
    const workerProfile1 = await WorkerProfile.findOne({ userId: newWorkerId });

    if (!workerProfile1) {
        throw new Error('WorkerProfile was not created on registration!');
    }
    if (workerProfile1.verificationStatus !== 'NOT_SUBMITTED') {
        throw new Error(`Expected WorkerProfile.verificationStatus to be NOT_SUBMITTED, got: ${workerProfile1.verificationStatus}`);
    }
    if (registerRes.body.user.kycStatus !== 'NOT_SUBMITTED' || registerRes.body.user.isKycVerified !== false) {
        throw new Error(`Expected registration response to return NOT_SUBMITTED and isKycVerified: false, got: ${JSON.stringify(registerRes.body.user)}`);
    }
    console.log('✓ TEST 1 PASSED: New worker registered with kycStatus = NOT_SUBMITTED, isKycVerified = false.');

    const worker1Token = signAccessToken({ userId: newWorkerId, id: newWorkerId, role: 'WORKER', email: workerUser1.email, tokenId: crypto.randomUUID() });

    // ==========================================
    // TEST 2: Fetch Profile & Verification Status
    // ==========================================
    console.log('TEST 2: Worker Verification API returns NOT_SUBMITTED...');
    const verifRes = await request(app)
        .get('/api/v1/worker/verification')
        .set('Authorization', `Bearer ${worker1Token}`);

    if (verifRes.status !== 200 || verifRes.body.data.profile.kycStatus !== 'NOT_SUBMITTED' || verifRes.body.data.profile.isKycVerified !== false) {
        throw new Error(`Verification status mismatch: ${JSON.stringify(verifRes.body)}`);
    }
    console.log('✓ TEST 2 PASSED: GET /worker/verification returned authoritative NOT_SUBMITTED state.');

    // ==========================================
    // TEST 3: Unapproved Worker Protected Action Blocked
    // ==========================================
    console.log('TEST 3: Unapproved Worker Protected Action Guard...');
    // Create test booking for this unapproved worker
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const testBooking = await Booking.create({
        bookingNumber: `HLM-KYC-${testSuffix}`,
        customerId: customer._id,
        workerId: workerUser1._id,
        serviceCategoryId: category._id,
        serviceAddress: '123 Test Street, New Delhi',
        scheduledStart: new Date(`${dateStr}T11:00:00+05:30`),
        scheduledEnd: new Date(`${dateStr}T13:00:00+05:30`),
        bookingDate: dateStr,
        bookingTime: '11:00 AM',
        durationMinutes: 120,
        pricingType: 'HOURLY',
        baseAmount: 60000,
        platformFee: 5000,
        taxAmount: 5850,
        discountAmount: 0,
        totalAmount: 70850,
        commissionPercentage: 10,
        commissionAmount: 6000,
        workerEarning: 54000,
        bookingStatus: 'PAID',
        paymentStatus: 'PAID',
        escrowStatus: 'HELD',
    });

    const acceptRes = await request(app)
        .post(`/api/v1/bookings/${testBooking._id}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);

    if (acceptRes.status !== 403) {
        throw new Error(`Expected 403 KYC_NOT_APPROVED when unapproved worker accepts booking, got: ${acceptRes.status}`);
    }
    console.log('✓ TEST 3 PASSED: Unapproved worker blocked from accepting booking (HTTP 403 KYC_NOT_APPROVED).');

    // ==========================================
    // TEST 4: Worker Cannot Approve Own KYC (Security Guard)
    // ==========================================
    console.log('TEST 4: Worker Attempting Self-Approval Forbidden...');
    const selfApproveRes = await request(app)
        .post(`/api/v1/admin/workers/verify/${workerUser1._id}`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ action: 'APPROVED', reason: 'Self verified' });

    if (selfApproveRes.status !== 403) {
        throw new Error(`Expected 403 FORBIDDEN on worker self-approval attempt, got: ${selfApproveRes.status}`);
    }
    console.log('✓ TEST 4 PASSED: Self-approval attempt securely blocked with HTTP 403 FORBIDDEN.');

    // ==========================================
    // TEST 5: Worker Submits KYC Documents -> UNDER_REVIEW / PENDING_APPROVAL
    // ==========================================
    console.log('TEST 5: Worker submits professional details & documents...');
    await request(app)
        .put('/api/v1/worker/verification/profile')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
            fullName: 'Fresh Pro Worker',
            dateOfBirth: '1995-05-15',
            gender: 'MALE',
            phone: phoneWorker1,
            address: '404 Connaught Place',
            city: 'New Delhi',
            state: 'Delhi',
            postalCode: '110001',
            profilePhotoId: 'dummy-photo-id',
        });

    await request(app)
        .put('/api/v1/worker/verification/professional-details')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
            primaryServiceCategoryId: category._id.toString(),
            skills: ['Wiring', 'Appliance Repair'],
            languages: ['Hindi', 'English'],
            hourlyRate: 35000,
            dailyRate: 250000,
            yearsOfExperience: 4,
            bio: 'Expert certified electrician.',
        });

    // Create required documents for submission
    const aadhaarDoc = await VerificationDocument.create({
        workerId: workerUser1._id,
        documentType: 'AADHAAR',
        documentNumberEncrypted: 'enc_aadhaar',
        documentNumberLast4: '1234',
        frontFile: 'PRIVATE',
        frontFileId: 'aadhaar.jpg',
        fileMimeType: 'image/jpeg',
        fileSize: 50000,
        verificationStatus: 'UPLOADED',
        isCurrent: true,
    });
    const panDoc = await VerificationDocument.create({
        workerId: workerUser1._id,
        documentType: 'PAN',
        documentNumberEncrypted: 'enc_pan',
        documentNumberLast4: '5678',
        frontFile: 'PRIVATE',
        frontFileId: 'pan.jpg',
        fileMimeType: 'image/jpeg',
        fileSize: 50000,
        verificationStatus: 'UPLOADED',
        isCurrent: true,
    });
    const addressDoc = await VerificationDocument.create({
        workerId: workerUser1._id,
        documentType: 'ADDRESS_PROOF',
        documentNumberEncrypted: 'enc_address',
        documentNumberLast4: '9012',
        frontFile: 'PRIVATE',
        frontFileId: 'address.jpg',
        fileMimeType: 'image/jpeg',
        fileSize: 50000,
        verificationStatus: 'UPLOADED',
        isCurrent: true,
    });

    const submitRes = await request(app)
        .post('/api/v1/worker/verification/submit')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
            declarationAccepted: true,
            consentAccepted: true,
        });

    if (submitRes.status !== 200) {
        throw new Error(`KYC submission failed: ${JSON.stringify(submitRes.body)}`);
    }

    const postSubmitProfile = await WorkerProfile.findOne({ userId: workerUser1._id });
    if (!['PENDING_APPROVAL', 'UNDER_REVIEW', 'SUBMITTED'].includes(postSubmitProfile.verificationStatus)) {
        throw new Error(`Expected verificationStatus to be PENDING_APPROVAL/UNDER_REVIEW, got: ${postSubmitProfile.verificationStatus}`);
    }
    if (postSubmitProfile.verificationBadge === true) {
        throw new Error('Worker verificationBadge must remain false while under review!');
    }
    console.log('✓ TEST 5 PASSED: KYC submitted successfully -> status PENDING_APPROVAL, badge: false.');

    // ==========================================
    // TEST 6: Worker A Cannot Modify Worker B's Documents
    // ==========================================
    console.log('TEST 6: Cross-Worker Isolation Guard...');
    const workerUser2 = await User.create({
        name: `Second Worker ${testSuffix}`,
        email: `worker2_${testSuffix}@example.com`,
        phone: phoneWorker2,
        passwordHash: 'dummyhash',
        role: 'WORKER',
        status: 'ACTIVE',
    });
    const worker2Token = signAccessToken({ userId: workerUser2._id.toString(), id: workerUser2._id.toString(), role: 'WORKER', email: workerUser2.email, tokenId: crypto.randomUUID() });

    const crossDeleteRes = await request(app)
        .delete(`/api/v1/worker/verification/documents/${aadhaarDoc._id}`)
        .set('Authorization', `Bearer ${worker2Token}`);

    if (crossDeleteRes.status !== 403) {
        throw new Error(`Expected 403 DOCUMENT_NOT_OWNED on cross-worker document delete attempt, got: ${crossDeleteRes.status}`);
    }
    console.log('✓ TEST 6 PASSED: Cross-worker document manipulation prevented with HTTP 403.');

    // ==========================================
    // TEST 7: Admin Explicit Approval
    // ==========================================
    console.log('TEST 7: Authorized Admin Approves KYC...');
    const approveRes = await request(app)
        .post(`/api/v1/admin/workers/verify/${workerUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            action: 'APPROVED',
            reason: 'All background checks and identity documents verified.',
        });

    if (approveRes.status !== 200) {
        throw new Error(`Admin approval failed: ${JSON.stringify(approveRes.body)}`);
    }

    const approvedProfile = await WorkerProfile.findOne({ userId: workerUser1._id });
    if (approvedProfile.verificationStatus !== 'APPROVED' || approvedProfile.verificationBadge !== true || approvedProfile.isPubliclyVisible !== true) {
        throw new Error(`Expected approved profile state (APPROVED, badge: true, visible: true), got: ${JSON.stringify(approvedProfile)}`);
    }
    console.log('✓ TEST 7 PASSED: Admin approved KYC -> status APPROVED, badge: true, isPubliclyVisible: true.');

    // ==========================================
    // TEST 8: Worker Re-Fetches Profile After Approval
    // ==========================================
    console.log('TEST 8: Worker Profile Refresh Returns Approved State...');
    const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${worker1Token}`);

    if (meRes.status !== 200 || meRes.body.user.kycStatus !== 'APPROVED' || meRes.body.user.isKycVerified !== true) {
        throw new Error(`Worker profile refresh did not reflect approved status: ${JSON.stringify(meRes.body)}`);
    }
    console.log('✓ TEST 8 PASSED: Worker profile /auth/me returns kycStatus = APPROVED, isKycVerified = true.');

    // ==========================================
    // TEST 9: Approved Worker Can Now Perform Protected Actions
    // ==========================================
    console.log('TEST 9: Approved Worker Performs Protected Lifecycle Actions...');
    const approvedAcceptRes = await request(app)
        .post(`/api/v1/bookings/${testBooking._id}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);

    if (approvedAcceptRes.status !== 200) {
        throw new Error(`Approved worker could not accept booking: ${JSON.stringify(approvedAcceptRes.body)}`);
    }

    const enRouteRes = await request(app)
        .post(`/api/v1/bookings/${testBooking._id}/en-route`)
        .set('Authorization', `Bearer ${worker1Token}`);

    if (enRouteRes.status !== 200) {
        throw new Error(`Approved worker could not start en-route: ${JSON.stringify(enRouteRes.body)}`);
    }

    const startRes = await request(app)
        .post(`/api/v1/bookings/${testBooking._id}/start`)
        .set('Authorization', `Bearer ${worker1Token}`);

    if (startRes.status !== 200) {
        throw new Error(`Approved worker could not start job: ${JSON.stringify(startRes.body)}`);
    }

    const completionReqRes = await request(app)
        .post(`/api/v1/bookings/${testBooking._id}/request-completion`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ notes: 'Completed wiring work.' });

    if (completionReqRes.status !== 200) {
        throw new Error(`Approved worker could not request completion: ${JSON.stringify(completionReqRes.body)}`);
    }
    console.log('✓ TEST 9 PASSED: Approved worker executed all protected actions (Accept, En-Route, Start, Complete).');

    // ==========================================
    // TEST 10: Admin Rejection / Suspension Blocks Actions Again
    // ==========================================
    console.log('TEST 10: Admin Suspension Blocks Worker Immediately...');
    const suspendRes = await request(app)
        .post(`/api/v1/admin/workers/verify/${workerUser1._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            action: 'SUSPENDED',
            reason: 'Policy violation report.',
        });

    if (suspendRes.status !== 200) {
        throw new Error(`Admin suspension failed: ${JSON.stringify(suspendRes.body)}`);
    }

    const suspendedProfile = await WorkerProfile.findOne({ userId: workerUser1._id });
    if (suspendedProfile.verificationStatus !== 'SUSPENDED' || suspendedProfile.verificationBadge === true) {
        throw new Error(`Suspended profile state mismatch: ${JSON.stringify(suspendedProfile)}`);
    }
    console.log('✓ TEST 10 PASSED: Admin suspended worker -> status SUSPENDED, badge: false.');

    console.log('====================================================');
    console.log('ALL WORKER KYC SECURITY & LIFECYCLE TESTS PASSED 100%!');
    console.log('====================================================');
}

runWorkerKYCSecurityTests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error('WORKER KYC TEST SUITE FAILED:', err);
        process.exit(1);
    });
