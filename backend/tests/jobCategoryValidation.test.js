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
import Job from '../src/models/Job.js';
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
    console.log('=== STARTING JOB CATEGORY & DEPENDENT JOB TITLE VALIDATION SUITE ===\n');
    const app = createApp();
    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });
    }

    let companyUser, companyToken, createdJobId;

    try {
        const email = 'job_test_company@test.com';
        await User.deleteOne({ email });

        companyUser = await User.create({
            name: 'Category Test Company',
            email,
            passwordHash: 'hash',
            role: 'COMPANY',
            status: 'ACTIVE'
        });

        companyToken = signAccessToken({ userId: companyUser._id.toString(), role: companyUser.role });

        await CompanyProfile.create({
            userId: companyUser._id,
            companyName: 'Category Testing Ltd',
            email,
            phone: '9876543210',
            authorizedPersonName: 'Alex',
            authorizedPersonPhone: '9876543210',
            businessType: 'Testing Services',
            description: 'Category validation tests',
            address: '10 Test Street',
            city: 'Noida',
            state: 'UP',
            pincode: '201301',
            verificationStatus: 'VERIFIED'
        });

        const validTestPairs = [
            { category: 'Event Management', title: 'Event Marshal' },
            { category: 'Hospitality', title: 'Hotel Receptionist' },
            { category: 'Food & Catering', title: 'Waiter' },
            { category: 'Retail & Sales', title: 'Sales Associate' },
            { category: 'Delivery & Logistics', title: 'Delivery Agent' },
            { category: 'Security', title: 'Security Guard' },
            { category: 'Cleaning & Housekeeping', title: 'Housekeeping Staff' },
            { category: 'IT & Technology', title: 'IT Support Assistant' }
        ];

        // TEST 1-8: Valid Job Creation
        for (const pair of validTestPairs) {
            await test(`Valid Job Creation: ${pair.category} -> ${pair.title}`, async () => {
                const res = await request(app)
                    .post('/api/company/jobs')
                    .set('Authorization', `Bearer ${companyToken}`)
                    .send({
                        category: pair.category,
                        title: pair.title,
                        description: `Hiring ${pair.title} for upcoming event`,
                        workersRequired: 5,
                        payRate: 800,
                        paymentType: 'DAILY',
                        workingDate: '2026-08-20',
                        location: 'Noida Sector 62',
                        address: 'Building 4, Sector 62',
                        startTime: '09:00',
                        endTime: '18:00',
                        applicationDeadline: '2026-08-19'
                    });

                assert.equal(res.status, 201);
                assert.equal(res.body.success, true);
                assert.equal(res.body.job.category, pair.category);
                assert.equal(res.body.job.title, pair.title);

                if (!createdJobId) {
                    createdJobId = res.body.job._id;
                }
            });
        }

        // TEST 9: Invalid Combination (Event Management -> Hotel Receptionist)
        await test('Invalid Pair: Event Management -> Hotel Receptionist rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Event Management',
                    title: 'Hotel Receptionist',
                    description: 'Invalid combination test',
                    workersRequired: 2,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'Connaught Place',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Please select a valid job title for this category.');
        });

        // TEST 10: Invalid Category
        await test('Invalid Category: Space Tourism rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Space Tourism',
                    title: 'Astronaut',
                    description: 'Invalid category test',
                    workersRequired: 1,
                    payRate: 5000,
                    workingDate: '2026-08-20',
                    location: 'Spaceport',
                    address: 'Launchpad 1',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Invalid job category.');
        });

        // TEST 11: Missing Category
        await test('Missing Category rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: '',
                    title: 'Event Marshal',
                    description: 'Missing category test',
                    workersRequired: 1,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'CP',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Please select a category.');
        });

        // TEST 12: Missing Job Title
        await test('Missing Job Title rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Event Management',
                    title: '',
                    description: 'Missing title test',
                    workersRequired: 1,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'CP',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Please select a job title.');
        });

        // TEST 13: Workers Required = 0
        await test('Workers Required = 0 rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Event Management',
                    title: 'Event Marshal',
                    description: 'Zero workers test',
                    workersRequired: 0,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'CP',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Workers Required must be at least 1.');
        });

        // TEST 14: Workers Required Negative
        await test('Workers Required = -3 rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Event Management',
                    title: 'Event Marshal',
                    description: 'Negative workers test',
                    workersRequired: -3,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'CP',
                    startTime: '09:00',
                    endTime: '18:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Workers Required must be at least 1.');
        });

        // TEST 15: Invalid Time Range (endTime <= startTime)
        await test('Invalid Time Range (18:00 to 09:00) rejected (400 Bad Request)', async () => {
            const res = await request(app)
                .post('/api/company/jobs')
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Event Management',
                    title: 'Event Marshal',
                    description: 'Invalid time test',
                    workersRequired: 2,
                    payRate: 500,
                    workingDate: '2026-08-20',
                    location: 'Delhi',
                    address: 'CP',
                    startTime: '18:00',
                    endTime: '09:00',
                    applicationDeadline: '2026-08-19'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'End time must be after start time.');
        });

        // TEST 16: Job Edit with Valid Pair
        await test('Edit Job with Valid Pair: Hospitality -> Front Desk Staff (200 OK)', async () => {
            assert.ok(createdJobId);
            const res = await request(app)
                .put(`/api/company/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Hospitality',
                    title: 'Front Desk Staff'
                });

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.job.category, 'Hospitality');
            assert.equal(res.body.job.title, 'Front Desk Staff');
        });

        // TEST 17: Job Edit with Invalid Pair
        await test('Edit Job with Mismatched Pair rejected (400 Bad Request)', async () => {
            assert.ok(createdJobId);
            const res = await request(app)
                .put(`/api/company/jobs/${createdJobId}`)
                .set('Authorization', `Bearer ${companyToken}`)
                .send({
                    category: 'Hospitality',
                    title: 'Event Marshal'
                });

            assert.equal(res.status, 400);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Please select a valid job title for this category.');
        });

    } finally {
        if (companyUser) {
            await Job.deleteMany({ companyId: companyUser._id });
            await CompanyProfile.deleteOne({ userId: companyUser._id });
            await User.deleteOne({ _id: companyUser._id });
        }
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }

    console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
        console.error('Failures:\n' + failures.join('\n'));
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
