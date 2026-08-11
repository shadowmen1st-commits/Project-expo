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
        console.log(`✅ PASS ${name}`);
    } catch (error) {
        failed++;
        failures.push(`${name}: ${error.message}`);
        console.error(`❌ FAIL ${name}: ${error.message}`);
    }
}

// 1. Real Valid Binary Buffers
const REAL_PDF_BUFFER = Buffer.from(`%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
4 0 obj <</Length 62>> stream
BT /Helvetica 24 Tf 100 700 Td (Official Verification Document) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000240 00000 n 
trailer <</Size 5 /Root 1 0 R>>
startxref
344
%%EOF`);

const REAL_PNG_BUFFER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const REAL_WEBP_BUFFER = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v38gAA=', 'base64');

async function runE2E() {
    console.log('=== STARTING COMPLETE E2E COMPANY VERIFICATION DOCUMENT STORAGE & PREVIEW TEST ===\n');
    const app = createApp();
    const testDbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test';
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(testDbUri, { dbName: process.env.DB_NAME || 'test' });
    }

    let adminToken, companyToken, customerToken, workerToken, otherCompanyToken;
    let adminUser, companyUser, customerUser, workerUser, otherCompanyUser;
    let companyId;
    const uploadedDocIds = {};

    try {
        // Clean up test emails
        const emails = ['e2e_admin@test.com', 'e2e_company@test.com', 'e2e_other_company@test.com', 'e2e_customer@test.com', 'e2e_worker@test.com'];
        await User.deleteMany({ email: { $in: emails } });

        // Create Users
        adminUser = await User.create({ name: 'E2E Admin', email: 'e2e_admin@test.com', passwordHash: 'hash', role: 'ADMIN', status: 'ACTIVE' });
        companyUser = await User.create({ name: 'E2E Company', email: 'e2e_company@test.com', passwordHash: 'hash', role: 'COMPANY', status: 'ACTIVE' });
        otherCompanyUser = await User.create({ name: 'E2E Other Company', email: 'e2e_other_company@test.com', passwordHash: 'hash', role: 'COMPANY', status: 'ACTIVE' });
        customerUser = await User.create({ name: 'E2E Customer', email: 'e2e_customer@test.com', passwordHash: 'hash', role: 'CUSTOMER', status: 'ACTIVE' });
        workerUser = await User.create({ name: 'E2E Worker', email: 'e2e_worker@test.com', passwordHash: 'hash', role: 'WORKER', status: 'ACTIVE' });

        companyId = companyUser._id.toString();

        adminToken = signAccessToken({ userId: adminUser._id.toString(), role: adminUser.role });
        companyToken = signAccessToken({ userId: companyUser._id.toString(), role: companyUser.role });
        otherCompanyToken = signAccessToken({ userId: otherCompanyUser._id.toString(), role: otherCompanyUser.role });
        customerToken = signAccessToken({ userId: customerUser._id.toString(), role: customerUser.role });
        workerToken = signAccessToken({ userId: workerUser._id.toString(), role: workerUser.role });

        // Setup Company Profile
        await CompanyProfile.create({
            userId: companyUser._id,
            companyName: 'Apex Event Logistics Ltd',
            email: 'e2e_company@test.com',
            phone: '9988776655',
            authorizedPersonName: 'Alex Mercer',
            authorizedPersonPhone: '9988776654',
            businessType: 'Logistics Services',
            description: 'Professional Event & Staffing Logistics',
            address: '45 Industrial Park Phase 2',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            verificationStatus: 'UNDER_REVIEW'
        });

        const docTypesToTest = [
            { type: 'BUSINESS_REGISTRATION', file: REAL_PDF_BUFFER, filename: 'business_registration.pdf', mime: 'application/pdf' },
            { type: 'ADDRESS_PROOF', file: REAL_PNG_BUFFER, filename: 'address_proof.png', mime: 'image/png' },
            { type: 'AUTHORIZED_PERSON_ID', file: REAL_PNG_BUFFER, filename: 'authorized_person_id.png', mime: 'image/png' },
            { type: 'COMPANY_PAN', file: REAL_PNG_BUFFER, filename: 'company_pan.png', mime: 'image/png' },
            { type: 'GST_CERTIFICATE', file: REAL_PDF_BUFFER, filename: 'gst_certificate.pdf', mime: 'application/pdf' },
            { type: 'OTHER_SUPPORTING_DOCUMENT', file: REAL_WEBP_BUFFER, filename: 'other_supporting_doc.webp', mime: 'image/webp' }
        ];

        // STEP 1: Upload 6 Real Test Files via Multipart API
        for (const item of docTypesToTest) {
            await test(`Upload Document 6/6: ${item.type}`, async () => {
                const res = await request(app)
                    .post('/api/company/verification/documents')
                    .set('Authorization', `Bearer ${companyToken}`)
                    .field('documentType', item.type)
                    .attach('file', item.file, item.filename);

                assert.equal(res.status, 200);
                assert.equal(res.body.success, true);
                assert.ok(res.body.document);
                assert.equal(res.body.document.documentType, item.type);
                assert.ok(res.body.document.storageKey);

                uploadedDocIds[item.type] = res.body.document._id.toString();

                // Verify physical file on disk
                const filePath = path.resolve('uploads/verification', res.body.document.storageKey);
                assert.ok(fs.existsSync(filePath), `File exists on disk: ${filePath}`);
                assert.equal(fs.statSync(filePath).size, item.file.length);
            });
        }

        // STEP 2: Verify MongoDB References
        await test('Verify MongoDB Document References for all 6 Uploaded Files', async () => {
            const docs = await CompanyVerificationDocument.find({ companyId: companyUser._id }).lean();
            assert.equal(docs.length, 6);

            console.log('\n--- MONGODB DOCUMENT REFERENCE AUDIT REPORT ---');
            for (const d of docs) {
                console.log(JSON.stringify({
                    documentId: d._id.toString(),
                    documentType: d.documentType,
                    originalFilename: d.fileName,
                    mimeType: d.mimeType,
                    fileSize: d.fileSize,
                    storageKey: d.storageKey,
                    documentUrl: d.documentUrl,
                    status: d.status,
                    companyId: d.companyId.toString()
                }, null, 2));

                assert.ok(d.storageKey);
                assert.ok(d.fileSize > 0);
                assert.ok(d.fileName);
                assert.equal(d.status, 'PENDING');
            }
            console.log('--- END MONGODB AUDIT REPORT ---\n');
        });

        // STEP 3: Admin View File Authorization Tests for All 6 Documents
        for (const item of docTypesToTest) {
            const docId = uploadedDocIds[item.type];

            await test(`Admin Document View: ${item.type} (200 OK + Inline Content)`, async () => {
                const res = await request(app)
                    .get(`/api/admin/company-verifications/documents/${docId}/view`)
                    .set('Authorization', `Bearer ${adminToken}`);

                assert.equal(res.status, 200);
                assert.match(res.headers['content-type'], new RegExp(item.mime.replace('/', '\\/')));
                assert.match(res.headers['content-disposition'], new RegExp(`inline; filename="${item.filename}"`));
                assert.equal(res.headers['x-content-type-options'], 'nosniff');
                assert.equal(res.body.length, item.file.length);
            });
        }

        // STEP 4: Security RBAC Tests
        const sampleDocId = uploadedDocIds['BUSINESS_REGISTRATION'];

        await test('Security: No Token returns 401 Unauthorized', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${sampleDocId}/view`);
            assert.equal(res.status, 401);
        });

        await test('Security: CUSTOMER role returns 403 Forbidden', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${sampleDocId}/view`)
                .set('Authorization', `Bearer ${customerToken}`);
            assert.equal(res.status, 403);
        });

        await test('Security: WORKER role returns 403 Forbidden', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/${sampleDocId}/view`)
                .set('Authorization', `Bearer ${workerToken}`);
            assert.equal(res.status, 403);
        });

        await test('Security: OTHER COMPANY returns 403 Forbidden', async () => {
            const res = await request(app)
                .get(`/api/company/verification/documents/${sampleDocId}/view`)
                .set('Authorization', `Bearer ${otherCompanyToken}`);
            assert.equal(res.status, 403);
        });

        await test('Security: Path Traversal attempt fails gracefully', async () => {
            const res = await request(app)
                .get(`/api/admin/company-verifications/documents/../../etc/passwd/view`)
                .set('Authorization', `Bearer ${adminToken}`);
            assert.ok([400, 404].includes(res.status));
        });

        // STEP 5: Admin Workflow Decision Verification
        await test('Admin Approves Company Verification & Documents Remain Viewable', async () => {
            const approveRes = await request(app)
                .patch(`/api/admin/companies/${companyId}/verification/approve`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.equal(approveRes.status, 200);
            assert.equal(approveRes.body.success, true);

            // Verify document still viewable after approval
            const viewRes = await request(app)
                .get(`/api/admin/company-verifications/documents/${sampleDocId}/view`)
                .set('Authorization', `Bearer ${adminToken}`);

            assert.equal(viewRes.status, 200);
        });

    } finally {
        // Clean up test documents & physical files
        for (const type of Object.keys(uploadedDocIds)) {
            const docId = uploadedDocIds[type];
            const doc = await CompanyVerificationDocument.findById(docId);
            if (doc && doc.storageKey) {
                const p = path.resolve('uploads/verification', doc.storageKey);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            await CompanyVerificationDocument.findByIdAndDelete(docId);
        }

        if (companyId) {
            await CompanyProfile.deleteOne({ userId: companyId });
            await User.deleteMany({ email: { $in: ['e2e_admin@test.com', 'e2e_company@test.com', 'e2e_other_company@test.com', 'e2e_customer@test.com', 'e2e_worker@test.com'] } });
        }

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }

    console.log(`\n=== E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
        console.error('Failures:\n' + failures.join('\n'));
        process.exit(1);
    }
}

runE2E().catch(err => {
    console.error('Fatal E2E test runner error:', err);
    process.exit(1);
});
