process.env.NODE_ENV = 'test';

import dns from 'dns';
import dotenv from 'dotenv';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config();

import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyVerificationDocument from '../src/models/CompanyVerificationDocument.js';
import { signAccessToken } from '../src/utils/authUtils.js';

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

async function runTests() {
    const app = createApp();
    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });
    }

    let adminToken, companyToken, otherCompanyToken, customerToken, workerToken;
    let adminUser, companyUser, otherCompanyUser, customerUser, workerUser;
    let docId, nonexistentDocId, invalidDocId;
    let storageKey, testFilePath;

    try {
        // Clean up old test users
        await User.deleteMany({ email: { $in: ['admin_doc_test@test.com', 'company_doc_test@test.com', 'other_company_doc_test@test.com', 'customer_doc_test@test.com', 'worker_doc_test@test.com'] } });

        // Create test users
        adminUser = await User.create({ name: 'Admin Doc Test', email: 'admin_doc_test@test.com', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' });
        companyUser = await User.create({ name: 'Company Doc Test', email: 'company_doc_test@test.com', passwordHash: 'hash', role: 'COMPANY', status: 'ACTIVE' });
        otherCompanyUser = await User.create({ name: 'Other Company Doc Test', email: 'other_company_doc_test@test.com', passwordHash: 'hash', role: 'COMPANY', status: 'ACTIVE' });
        customerUser = await User.create({ name: 'Customer Doc Test', email: 'customer_doc_test@test.com', passwordHash: 'hash', role: 'CUSTOMER', status: 'ACTIVE' });
        workerUser = await User.create({ name: 'Worker Doc Test', email: 'worker_doc_test@test.com', passwordHash: 'hash', role: 'WORKER', status: 'ACTIVE' });

        adminToken = signAccessToken({ userId: adminUser._id.toString(), role: adminUser.role });
        companyToken = signAccessToken({ userId: companyUser._id.toString(), role: companyUser.role });
        otherCompanyToken = signAccessToken({ userId: otherCompanyUser._id.toString(), role: otherCompanyUser.role });
        customerToken = signAccessToken({ userId: customerUser._id.toString(), role: customerUser.role });
        workerToken = signAccessToken({ userId: workerUser._id.toString(), role: workerUser.role });

        // Create Company Profile
        await CompanyProfile.create({
            userId: companyUser._id,
            companyName: 'Test Company Doc LLC',
            email: 'company_doc_test@test.com',
            phone: '9876543210',
            authorizedPersonName: 'John Rep',
            authorizedPersonPhone: '9876543211',
            businessType: 'Event Services',
            description: 'Test Event Management Services LLC',
            address: '123 Main Street',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110001',
            verificationStatus: 'UNDER_REVIEW'
        });

        // Write a test physical file to uploads/verification
        const storageDir = path.resolve('uploads/verification');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        storageKey = `test_doc_${Date.now()}.png`;
        testFilePath = path.join(storageDir, storageKey);
        fs.writeFileSync(testFilePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

        // Create document record
        const doc = await CompanyVerificationDocument.create({
            companyId: companyUser._id,
            documentType: 'BUSINESS_REGISTRATION',
            documentUrl: `/uploads/verification/${storageKey}`,
            storageKey,
            fileName: 'business_registration.png',
            fileSize: 70,
            mimeType: 'image/png',
            status: 'PENDING'
        });

        docId = doc._id.toString();
        nonexistentDocId = new mongoose.Types.ObjectId().toString();
        invalidDocId = 'invalid-object-id-123';

        await test('1. ADMIN can view company document (200 OK with inline preview header)', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${docId}/view`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.equal(res.status, 200);
            assert.match(res.headers['content-type'], /image\/png/);
            assert.match(res.headers['content-disposition'], /inline; filename="business_registration\.png"/);
            assert.equal(res.headers['x-content-type-options'], 'nosniff');
        });

        await test('2. COMPANY owner can view document via company route (200 OK)', async () => {
            const res = await request(app)
                .get(`/api/company/verification/documents/${docId}/view`)
                .set('Authorization', `Bearer ${companyToken}`);

            assert.equal(res.status, 200);
            assert.match(res.headers['content-type'], /image\/png/);
        });

        await test('3. CUSTOMER is forbidden from viewing company document (403 Forbidden)', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${docId}/view`)
                .set('Authorization', `Bearer ${customerToken}`);

            assert.equal(res.status, 403);
        });

        await test('4. WORKER is forbidden from viewing company document (403 Forbidden)', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${docId}/view`)
                .set('Authorization', `Bearer ${workerToken}`);

            assert.equal(res.status, 403);
        });

        await test('5. OTHER COMPANY is forbidden from viewing unrelated company document (403 Forbidden)', async () => {
            const res = await request(app)
                .get(`/api/company/verification/documents/${docId}/view`)
                .set('Authorization', `Bearer ${otherCompanyToken}`);

            assert.equal(res.status, 403);
        });

        await test('6. Unauthenticated request without token returns 401 Unauthorized', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${docId}/view`);

            assert.equal(res.status, 401);
        });

        await test('7. Invalid document ID returns 400 Bad Request', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${invalidDocId}/view`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.equal(res.status, 400);
        });

        await test('8. Nonexistent document ID returns 404 Not Found', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${nonexistentDocId}/view`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.equal(res.status, 404);
        });

    } finally {
        if (docId) await CompanyVerificationDocument.findByIdAndDelete(docId);
        if (companyUser) {
            await CompanyProfile.deleteOne({ userId: companyUser._id });
            await User.deleteOne({ _id: companyUser._id });
        }
        if (adminUser) await User.deleteOne({ _id: adminUser._id });
        if (otherCompanyUser) await User.deleteOne({ _id: otherCompanyUser._id });
        if (customerUser) await User.deleteOne({ _id: customerUser._id });
        if (workerUser) await User.deleteOne({ _id: workerUser._id });
        if (testFilePath && fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
        console.error('Failures:\n' + failures.join('\n'));
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
