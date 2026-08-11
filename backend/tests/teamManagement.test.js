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
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyTeam from '../src/models/CompanyTeam.js';
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

async function runTests() {
    console.log('=== STARTING WORKFORCE TEAMS MANAGEMENT VALIDATION SUITE ===\n');
    const app = createApp();
    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });
    }

    let companyAUser, companyAToken;
    let companyBUser, companyBToken;
    let worker1, worker2, worker3, inactiveWorker, customerUser;
    let createdTeamId;

    try {
        // Clean previous test users
        const emails = [
            'team_comp_a@test.com',
            'team_comp_b@test.com',
            'team_worker1@test.com',
            'team_worker2@test.com',
            'team_worker3@test.com',
            'team_inactive_worker@test.com',
            'team_cust_user@test.com'
        ];
        const phones = ['8889990001', '8889990002', '8889990003', '8889990004', '8889990005', '8889990006', '8889990007'];
        await User.deleteMany({ $or: [{ email: { $in: emails } }, { phone: { $in: phones } }] });

        // Setup Company A
        companyAUser = await User.create({
            name: 'Company A Services',
            email: 'team_comp_a@test.com',
            phone: '8889990001',
            passwordHash: 'hash',
            role: 'COMPANY',
            status: 'ACTIVE'
        });
        companyAToken = signAccessToken({ userId: companyAUser._id.toString(), role: companyAUser.role });
        await CompanyProfile.create({
            userId: companyAUser._id,
            companyName: 'Company A Services',
            email: companyAUser.email,
            phone: companyAUser.phone,
            authorizedPersonName: 'Manager A',
            authorizedPersonPhone: companyAUser.phone,
            businessType: 'Event Staffing',
            description: 'Testing Company A',
            address: '10 Alpha Way',
            city: 'Noida',
            state: 'UP',
            pincode: '201301',
            verificationStatus: 'VERIFIED'
        });

        // Setup Company B
        companyBUser = await User.create({
            name: 'Company B Services',
            email: 'team_comp_b@test.com',
            phone: '8889990002',
            passwordHash: 'hash',
            role: 'COMPANY',
            status: 'ACTIVE'
        });
        companyBToken = signAccessToken({ userId: companyBUser._id.toString(), role: companyBUser.role });
        await CompanyProfile.create({
            userId: companyBUser._id,
            companyName: 'Company B Services',
            email: companyBUser.email,
            phone: companyBUser.phone,
            authorizedPersonName: 'Manager B',
            authorizedPersonPhone: companyBUser.phone,
            businessType: 'Event Staffing',
            description: 'Testing Company B',
            address: '20 Beta Road',
            city: 'Noida',
            state: 'UP',
            pincode: '201301',
            verificationStatus: 'VERIFIED'
        });

        // Setup Workers
        worker1 = await User.create({
            name: 'Rahul Sharma',
            email: 'team_worker1@test.com',
            phone: '8889990003',
            passwordHash: 'hash',
            role: 'WORKER',
            status: 'ACTIVE'
        });

        worker2 = await User.create({
            name: 'Amit Kumar',
            email: 'team_worker2@test.com',
            phone: '8889990004',
            passwordHash: 'hash',
            role: 'WORKER',
            status: 'ACTIVE'
        });

        worker3 = await User.create({
            name: 'Priya Singh',
            email: 'team_worker3@test.com',
            phone: '8889990005',
            passwordHash: 'hash',
            role: 'WORKER',
            status: 'ACTIVE'
        });

        inactiveWorker = await User.create({
            name: 'Inactive Staff',
            email: 'team_inactive_worker@test.com',
            phone: '8889990006',
            passwordHash: 'hash',
            role: 'WORKER',
            status: 'INACTIVE'
        });

        customerUser = await User.create({
            name: 'Customer User',
            email: 'team_cust_user@test.com',
            phone: '8889990007',
            passwordHash: 'hash',
            role: 'CUSTOMER',
            status: 'ACTIVE'
        });

        // TEST 1: Create team with valid worker leader
        await test('TEST 1: Create team with valid worker leader (HTTP 201)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Event Marshals Unit',
                    leaderId: worker1._id.toString(),
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.team.name, 'Event Marshals Unit');
            assert.equal(res.body.team.leaderId._id, worker1._id.toString());
            createdTeamId = res.body.team._id;
        });

        // TEST 2: Create team with multiple valid workers
        await test('TEST 2: Create team with multiple valid workers (HTTP 201)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Security Squad Alpha',
                    leaderId: worker1._id.toString(),
                    members: [worker2._id.toString(), worker3._id.toString()]
                });

            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.team.members.length, 3); // Leader + 2 members
        });

        // TEST 3: Leader automatically included in members
        await test('TEST 3: Leader automatically included in members array', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Catering Force',
                    leaderId: worker1._id.toString(),
                    members: [worker2._id.toString()] // leader1 omitted from members array
                });

            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            const memberIds = res.body.team.members.map(m => m._id);
            assert.ok(memberIds.includes(worker1._id.toString()));
            assert.ok(memberIds.includes(worker2._id.toString()));
        });

        // TEST 4: Duplicate members removed
        await test('TEST 4: Duplicate members deduplicated in stored document', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Deduplication Test Team',
                    leaderId: worker1._id.toString(),
                    members: [worker1._id.toString(), worker2._id.toString(), worker2._id.toString()]
                });

            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.team.members.length, 2); // worker1 and worker2 unique
        });

        // TEST 5: Invalid leader ID ("ghjgh") rejected
        await test('TEST 5: Invalid leader ID "ghjgh" rejected (HTTP 400)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Invalid Leader Team',
                    leaderId: 'ghjgh',
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'INVALID_WORKER_ID');
            assert.equal(res.body.message, 'Please select a valid team leader.');
        });

        // TEST 6: Invalid member ID (["members.0"]) rejected
        await test('TEST 6: Invalid member ID ["members.0"] rejected (HTTP 400)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Invalid Member Team',
                    leaderId: worker1._id.toString(),
                    members: ['members.0', 'members.1']
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'INVALID_WORKER_ID');
            assert.equal(res.body.message, 'Please select valid team members.');
        });

        // TEST 7: Non-existing worker ID rejected
        await test('TEST 7: Non-existing worker ID rejected (HTTP 404)', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Ghost Worker Team',
                    leaderId: nonExistentId,
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 404);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'WORKER_NOT_FOUND');
        });

        // TEST 8: Customer user selected as worker rejected
        await test('TEST 8: Customer user selected as worker rejected (HTTP 403 WORKER_NOT_AUTHORIZED)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Non Worker Team',
                    leaderId: customerUser._id.toString(),
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 403);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'WORKER_NOT_AUTHORIZED');
            assert.equal(res.body.message, 'One or more selected workers are not available to this company.');
        });

        // TEST 9: Inactive worker rejected
        await test('TEST 9: Inactive worker rejected (HTTP 403 WORKER_NOT_AUTHORIZED)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Inactive Staff Team',
                    leaderId: inactiveWorker._id.toString(),
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 403);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'WORKER_NOT_AUTHORIZED');
        });

        // TEST 10: Empty team name rejected
        await test('TEST 10: Empty team name rejected (HTTP 400)', async () => {
            const res = await request(app)
                .post('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: '   ',
                    leaderId: worker1._id.toString(),
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.errorCode, 'INVALID_TEAM_NAME');
        });

        // TEST 11: Company B cannot edit or delete Company A team
        await test('TEST 11: Company B cannot access Company A team (HTTP 404 Data Isolation)', async () => {
            assert.ok(createdTeamId);
            const res = await request(app)
                .put(`/api/company/teams/${createdTeamId}`)
                .set('Authorization', `Bearer ${companyBToken}`)
                .send({
                    name: 'Hijacked Team Name',
                    leaderId: worker1._id.toString(),
                    members: [worker1._id.toString()]
                });

            assert.equal(res.status, 404);
            assert.equal(res.body.success, false);
        });

        // TEST 12: Team appears in GET /api/company/teams
        await test('TEST 12: GET /api/company/teams returns populated team', async () => {
            const res = await request(app)
                .get('/api/company/teams')
                .set('Authorization', `Bearer ${companyAToken}`);

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.teams.length > 0);
            const found = res.body.teams.find(t => t._id === createdTeamId);
            assert.ok(found);
            assert.equal(found.leaderId.name, 'Rahul Sharma');
        });

        // TEST 13: Team persistence after re-query
        await test('TEST 13: Team persistence re-verification', async () => {
            const teamDoc = await CompanyTeam.findById(createdTeamId);
            assert.ok(teamDoc);
            assert.equal(teamDoc.name, 'Event Marshals Unit');
        });

        // TEST 14: Edit team (PUT /api/company/teams/:id)
        await test('TEST 14: Edit team updates name, leader, and members (HTTP 200)', async () => {
            assert.ok(createdTeamId);
            const res = await request(app)
                .put(`/api/company/teams/${createdTeamId}`)
                .set('Authorization', `Bearer ${companyAToken}`)
                .send({
                    name: 'Updated Event Marshals Unit',
                    leaderId: worker2._id.toString(),
                    members: [worker2._id.toString(), worker3._id.toString()]
                });

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.team.name, 'Updated Event Marshals Unit');
            assert.equal(res.body.team.leaderId._id, worker2._id.toString());
        });

        // TEST 15: Delete team (DELETE /api/company/teams/:id)
        await test('TEST 15: Delete team removes team but preserves workers', async () => {
            assert.ok(createdTeamId);
            const res = await request(app)
                .delete(`/api/company/teams/${createdTeamId}`)
                .set('Authorization', `Bearer ${companyAToken}`);

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);

            // Verify team is deleted
            const teamDoc = await CompanyTeam.findById(createdTeamId);
            assert.equal(teamDoc, null);

            // Verify worker Users still exist
            const workerUserDoc = await User.findById(worker1._id);
            assert.ok(workerUserDoc);
            assert.equal(workerUserDoc.status, 'ACTIVE');
        });

    } finally {
        // Clean up test data
        if (companyAUser) {
            await CompanyTeam.deleteMany({ companyId: companyAUser._id });
            await CompanyProfile.deleteOne({ userId: companyAUser._id });
            await User.deleteOne({ _id: companyAUser._id });
        }
        if (companyBUser) {
            await CompanyTeam.deleteMany({ companyId: companyBUser._id });
            await CompanyProfile.deleteOne({ userId: companyBUser._id });
            await User.deleteOne({ _id: companyBUser._id });
        }
        if (worker1) await User.deleteOne({ _id: worker1._id });
        if (worker2) await User.deleteOne({ _id: worker2._id });
        if (worker3) await User.deleteOne({ _id: worker3._id });
        if (inactiveWorker) await User.deleteOne({ _id: inactiveWorker._id });
        if (customerUser) await User.deleteOne({ _id: customerUser._id });

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }

    console.log(`\n=== WORKFORCE TEAMS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
        console.error('Failures:\n' + failures.join('\n'));
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
