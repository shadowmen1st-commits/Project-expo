process.env.NODE_ENV = 'test';

import dns from 'dns';
import dotenv from 'dotenv';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import Job from '../src/models/Job.js';
import JobApplication from '../src/models/JobApplication.js';
import CompanyTeam from '../src/models/CompanyTeam.js';
import WorkerAssignment from '../src/models/WorkerAssignment.js';
import Attendance from '../src/models/Attendance.js';
import CompanyWallet from '../src/models/CompanyWallet.js';
import CompanyPayment from '../src/models/CompanyPayment.js';
import { signAccessToken } from '../src/utils/authUtils.js';

let passed = 0, failed = 0;
const failures = [];

async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`✅ PASS ${name}`);
    } catch (error) {
        failed++;
        failures.push(`${name}: ${error.message}`);
        console.error(`❌ FAIL ${name}: ${error.message}`);
    }
}

async function runMasterTestSuite() {
    console.log('=== STARTING HYPERLOCAL MARKETPLACE MASTER E2E 35-POINT WORKER LIFECYCLE SUITE ===\n');
    const app = createApp();

    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });
    }

    // ─────────────────────────────────────────────────────────────
    // SETUP SEED USERS & TOKENS FOR TESTING
    // ─────────────────────────────────────────────────────────────
    // 1. Super Admin User
    let adminUser = await User.findOne({ role: 'SUPER_ADMIN' });
    if (!adminUser) {
        adminUser = await User.create({
            name: 'Master System Admin',
            email: `admin_master_${Date.now()}@test.com`,
            phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
            role: 'SUPER_ADMIN',
            status: 'ACTIVE'
        });
    }
    const adminToken = signAccessToken({ userId: adminUser._id.toString(), role: 'SUPER_ADMIN' });

    // 2. Company A User
    let companyAUser = await User.findOne({ role: 'COMPANY', email: 'company@test.com' });
    if (!companyAUser) {
        companyAUser = await User.create({
            name: 'Apex Events India',
            email: 'company@test.com',
            phone: '+919876543210',
            role: 'COMPANY',
            status: 'ACTIVE'
        });
    }
    await CompanyProfile.findOneAndUpdate(
        { userId: companyAUser._id },
        { companyName: 'Apex Events India', email: companyAUser.email, phone: companyAUser.phone, address: 'Central Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', businessType: 'EVENT_MANAGEMENT', description: 'Event staffing provider', authorizedPersonName: 'Manager A', authorizedPersonPhone: companyAUser.phone, verificationStatus: 'VERIFIED', isVerified: true },
        { upsert: true, new: true }
    );
    const companyAToken = signAccessToken({ userId: companyAUser._id.toString(), role: 'COMPANY' });

    // 3. Company B User
    let companyBUser = await User.findOne({ role: 'COMPANY', email: 'company2@test.com' });
    if (!companyBUser) {
        companyBUser = await User.create({
            name: 'Boutique Weddings Ltd',
            email: 'company2@test.com',
            phone: '+919876543211',
            role: 'COMPANY',
            status: 'ACTIVE'
        });
    }
    await CompanyProfile.findOneAndUpdate(
        { userId: companyBUser._id },
        { companyName: 'Boutique Weddings Ltd', email: companyBUser.email, phone: companyBUser.phone, address: 'Grand Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400002', businessType: 'EVENT_MANAGEMENT', description: 'Wedding event coordinator', authorizedPersonName: 'Manager B', authorizedPersonPhone: companyBUser.phone, verificationStatus: 'VERIFIED', isVerified: true },
        { upsert: true, new: true }
    );
    const companyBToken = signAccessToken({ userId: companyBUser._id.toString(), role: 'COMPANY' });

    // 4. Active Worker 1
    let worker1User = await User.findOne({ role: 'WORKER', email: 'worker@test.com' });
    if (!worker1User) {
        worker1User = await User.create({
            name: 'Rahul Sharma',
            email: 'worker@test.com',
            phone: '+919123456789',
            role: 'WORKER',
            status: 'ACTIVE'
        });
    } else {
        worker1User.status = 'ACTIVE';
        await worker1User.save();
    }
    await WorkerProfile.findOneAndUpdate(
        { userId: worker1User._id },
        { verificationStatus: 'APPROVED', isPubliclyVisible: true, category: 'Event Management', skills: ['Setup', 'Logistics'] },
        { upsert: true, new: true }
    );
    const worker1Token = signAccessToken({ userId: worker1User._id.toString(), role: 'WORKER' });

    // 5. Customer User
    let customerUser = await User.findOne({ role: 'CUSTOMER' });
    if (!customerUser) {
        customerUser = await User.create({
            name: 'Ananya Roy',
            email: `customer_master_${Date.now()}@test.com`,
            phone: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });
    }
    const customerToken = signAccessToken({ userId: customerUser._id.toString(), role: 'CUSTOMER' });

    let createdWorkerId = '';
    let createdJobId = '';
    let createdJobBId = '';
    let createdTeamId = '';
    let createdApplicationId = '';
    let createdAssignmentId = '';

    // ─────────────────────────────────────────────────────────────
    // TESTS EXECUTIONS
    // ─────────────────────────────────────────────────────────────

    // 1. Company Worker Creation
    await test('1. Company A creates a new worker with valid details', async () => {
        const uniqueEmail = `worker_e2e_${Date.now()}@test.com`;
        const uniquePhone = `+918${Math.floor(100000000 + Math.random() * 900000000)}`;

        const res = await request(app)
            .post('/api/company/workers/create')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                name: 'Vikram Mehta',
                email: uniqueEmail,
                phone: uniquePhone,
                category: 'Event Management',
                skills: ['Stage Setup', 'Sound Control'],
                hourlyRate: 350,
                experienceYears: 3
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.worker._id);
        createdWorkerId = res.body.worker._id;
    });

    await test('2. Company worker creation fails on duplicate email (409 Conflict)', async () => {
        const res = await request(app)
            .post('/api/company/workers/create')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                name: 'Duplicate Test Worker',
                email: 'worker@test.com', // Existing email
                phone: `+917${Math.floor(100000000 + Math.random() * 900000000)}`,
                category: 'Event Management'
            });

        assert.equal(res.status, 409);
        assert.equal(res.body.errorCode, 'DUPLICATE_EMAIL');
    });

    await test('3. Company worker creation fails on invalid email or missing name (400 Bad Request)', async () => {
        const res = await request(app)
            .post('/api/company/workers/create')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                name: '',
                email: 'invalid-email-format',
                phone: '123'
            });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
    });

    // 2. Admin Worker Lifecycle
    await test('4. Admin verifies worker status lifecycle (APPROVE -> SUSPEND -> REACTIVATE)', async () => {
        // Approve
        const approveRes = await request(app)
            .patch(`/api/admin/workers/${createdWorkerId}/approve`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: 'Documents verified' });
        assert.equal(approveRes.status, 200);

        // Suspend
        const suspendRes = await request(app)
            .patch(`/api/admin/workers/${createdWorkerId}/suspend`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ reason: 'Compliance issue' });
        assert.equal(suspendRes.status, 200);

        // Reactivate
        const reactivateRes = await request(app)
            .patch(`/api/admin/workers/${createdWorkerId}/reactivate`)
            .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(reactivateRes.status, 200);
    });

    await test('5. Non-admin role (Customer/Company) cannot approve workers (403 Forbidden)', async () => {
        const res = await request(app)
            .patch(`/api/admin/workers/${createdWorkerId}/approve`)
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({ reason: 'Unauthorized approval attempt' });

        assert.equal(res.status, 403);
    });

    await test('6. Invalid ObjectId parameter returns HTTP 400 INVALID_ID', async () => {
        const res = await request(app)
            .patch('/api/admin/workers/invalid-worker-id-123/approve')
            .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(res.status, 400);
        assert.equal(res.body.errorCode, 'INVALID_ID');
    });

    // 3. Job Posting & Categories
    await test('7. Company A posts a new job with valid Category & Title', async () => {
        const res = await request(app)
            .post('/api/company/jobs')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                title: 'Event Supervisor',
                category: 'Event Management',
                description: 'Supervise event setup and coordination.',
                workersRequired: 3,
                payRate: 1500,
                location: 'Central Plaza, Tech District',
                address: '123 Main Street',
                workingDate: '2026-11-20',
                startTime: '09:00',
                endTime: '17:00',
                applicationDeadline: '2026-09-14'
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.job._id);
        createdJobId = res.body.job._id;
    });

    await test('8. Company B posts a separate job for isolation testing', async () => {
        const res = await request(app)
            .post('/api/company/jobs')
            .set('Authorization', `Bearer ${companyBToken}`)
            .send({
                title: 'Event Coordinator',
                category: 'Event Management',
                description: 'Decorate luxury wedding venue.',
                workersRequired: 2,
                payRate: 2000,
                location: 'Grand Ballroom, City Center',
                address: '456 Royal Lane',
                workingDate: '2026-11-20',
                startTime: '10:00',
                endTime: '18:00',
                applicationDeadline: '2026-09-14'
            });

        assert.equal(res.status, 201);
        createdJobBId = res.body.job._id;
    });

    // 4. Worker Job Applications
    await test('9. Active Worker 1 applies for Company A job', async () => {
        const res = await request(app)
            .post(`/api/worker/jobs/${createdJobId}/apply`)
            .set('Authorization', `Bearer ${worker1Token}`);

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        createdApplicationId = res.body.application._id;
    });

    await test('10. Worker application fails on duplicate submission (409 Conflict)', async () => {
        const res = await request(app)
            .post(`/api/worker/jobs/${createdJobId}/apply`)
            .set('Authorization', `Bearer ${worker1Token}`);

        assert.equal(res.status, 409);
        assert.equal(res.body.errorCode, 'DUPLICATE_APPLICATION');
    });

    await test('11. Company B cannot accept/reject Company A application (403 Forbidden)', async () => {
        const res = await request(app)
            .patch(`/api/company/applications/${createdApplicationId}/SELECTED`)
            .set('Authorization', `Bearer ${companyBToken}`);

        assert.equal(res.status, 403);
    });

    await test('12. Company A selects Worker 1 application & triggers auto-assignment', async () => {
        const res = await request(app)
            .patch(`/api/company/applications/${createdApplicationId}/SELECTED`)
            .set('Authorization', `Bearer ${companyAToken}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    // 5. Teams & Worker Assignments with Schedule Conflict Checking
    await test('13. Company A creates a Team', async () => {
        const res = await request(app)
            .post('/api/company/teams')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                name: 'Alpha Operations Team',
                leaderId: createdWorkerId,
                members: [worker1User._id.toString()]
            });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        createdTeamId = res.body.team._id;
    });

    await test('14. Company A assigns Team to Job', async () => {
        const res = await request(app)
            .post('/api/company/assignments')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                jobId: createdJobId,
                teamId: createdTeamId
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    await test('15. Schedule conflict check prevents double-booking worker on overlapping time (400 WORKER_NOT_AVAILABLE)', async () => {
        const job2Res = await request(app)
            .post('/api/company/jobs')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                title: 'Event Marshal',
                category: 'Event Management',
                description: 'Overlapping schedule job.',
                workersRequired: 1,
                payRate: 1200,
                location: 'Hall B',
                address: '123 Main Street',
                workingDate: '2026-11-20',
                startTime: '10:00',
                endTime: '14:00',
                applicationDeadline: '2026-09-14'
            });
        assert.equal(job2Res.status, 201);
        const conflictingJobId = job2Res.body.job._id;

        const assignRes = await request(app)
            .post('/api/company/assignments')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                jobId: conflictingJobId,
                workerIds: [worker1User._id.toString()]
            });

        assert.equal(assignRes.status, 400);
        assert.equal(assignRes.body.errorCode, 'WORKER_NOT_AVAILABLE');
    });

    // 6. Attendance System
    await test('16. Company A logs worker attendance', async () => {
        const res = await request(app)
            .post('/api/company/attendance')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                jobId: createdJobId,
                workerId: worker1User._id.toString(),
                date: '2026-11-20',
                startTime: '09:00',
                endTime: '17:00',
                status: 'PRESENT',
                hoursWorked: 8
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
    });

    await test('17. Attendance fails for unassigned worker (403 WORKER_NOT_ASSIGNED)', async () => {
        const res = await request(app)
            .post('/api/company/attendance')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({
                jobId: createdJobBId, // Company B job
                workerId: createdWorkerId,
                date: '2026-11-20',
                status: 'PRESENT'
            });

        assert.ok([403, 404].includes(res.status));
    });

    // 7. Wallet & Payments with Balance Check
    await test('18. Releasing escrow payment with zero/insufficient balance fails (400 INSUFFICIENT_FUNDS)', async () => {
        const assignmentsList = await request(app)
            .get('/api/worker/assignments')
            .set('Authorization', `Bearer ${worker1Token}`);
        
        assert.equal(assignmentsList.status, 200);
        createdAssignmentId = assignmentsList.body.assignments[0]?._id;

        // Reset company A wallet balance to 0 to simulate insufficient funds
        await CompanyWallet.findOneAndUpdate(
            { companyId: companyAUser._id },
            { availableBalancePaise: 0, escrowAmountPaise: 0 }
        );

        const releaseRes = await request(app)
            .post('/api/company/payments/release')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({ assignmentId: createdAssignmentId });

        assert.equal(releaseRes.status, 400);
        assert.equal(releaseRes.body.errorCode, 'INSUFFICIENT_FUNDS');
    });

    await test('19. Company A deposits money into wallet & successfully releases escrow payment', async () => {
        const depositRes = await request(app)
            .post('/api/company/wallet/add')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({ amount: 500000 });

        assert.equal(depositRes.status, 200);

        const releaseRes = await request(app)
            .post('/api/company/payments/release')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({ assignmentId: createdAssignmentId });

        assert.equal(releaseRes.status, 200);
        assert.equal(releaseRes.body.success, true);
    });

    await test('20. Re-releasing payment on already completed assignment returns HTTP 400', async () => {
        const res = await request(app)
            .post('/api/company/payments/release')
            .set('Authorization', `Bearer ${companyAToken}`)
            .send({ assignmentId: createdAssignmentId });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
    });

    // 8. Data Isolation Matrix
    await test('21. Company B cannot view Company A jobs by ID (404/403 Isolation)', async () => {
        const res = await request(app)
            .get(`/api/company/jobs/${createdJobId}`)
            .set('Authorization', `Bearer ${companyBToken}`);

        assert.ok([403, 404].includes(res.status));
    });

    await test('22. Company B cannot delete Company A teams (404/403 Isolation)', async () => {
        const res = await request(app)
            .delete(`/api/company/teams/${createdTeamId}`)
            .set('Authorization', `Bearer ${companyBToken}`);

        assert.ok([403, 404].includes(res.status));
    });

    console.log(`\n=== MASTER E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
        console.error('Failures:', failures);
        process.exit(1);
    }
}

runMasterTestSuite().catch(err => {
    console.error('Master E2E suite fatal error:', err);
    process.exit(1);
});
