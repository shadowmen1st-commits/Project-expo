process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from '../tests/helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyWallet from '../src/models/CompanyWallet.js';
import AuditLog from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/authUtils.js';

let countBefore = 0;
let duplicatesFound = [];
let usersUpdated = 0;
let usersCreated = 0;
let countAfter = 0;
let passedChecks = 0;
let failedChecks = 0;

function logResult(name, success, info = '') {
    if (success) {
        passedChecks++;
        console.log(`✅ [PASS] ${name}`);
    } else {
        failedChecks++;
        console.error(`❌ [FAIL] ${name}: ${info}`);
    }
}

async function runSafeRepairAndAudit() {
    console.log("==========================================================");
    console.log("🛡️ SAFE MONGODB TEST USER INSPECTION, REPAIR & AUDIT");
    console.log("==========================================================");

    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // ---------------------------------------------------------------------
        // 1. INSPECT INITIAL DATABASE STATE
        // ---------------------------------------------------------------------
        countBefore = await User.countDocuments();
        console.log(`\n📊 Total users before inspection: ${countBefore}`);

        const initialUsers = await User.find({}).select('+passwordHash').lean();
        console.log("Initial Users in DB:");
        initialUsers.forEach(u => {
            console.log(` - ID: ${u._id} | Email: ${u.email} | Role: ${u.role} | Status: ${u.status} | HasHash: ${!!u.passwordHash} | IsPlaceholder: ${u.passwordHash?.includes('REPLACE_WITH_BCRYPT_HASH')}`);
        });

        // 2. IDENTIFY DUPLICATE EMAILS & SAFELY DEDUPLICATE
        const emailMap = {};
        for (const u of initialUsers) {
            const normEmail = u.email.toLowerCase();
            emailMap[normEmail] = emailMap[normEmail] || [];
            emailMap[normEmail].push(u);
        }

        for (const [email, docs] of Object.entries(emailMap)) {
            if (docs.length > 1) {
                duplicatesFound.push({ email, count: docs.length });
                console.warn(`⚠️ DUPLICATE FOUND: Email '${email}' has ${docs.length} records.`);

                // Determine primary doc (keep one with worker/company profile or first created)
                let primaryDoc = docs[0];
                for (const d of docs) {
                    const hasWorker = await WorkerProfile.exists({ userId: d._id });
                    const hasCompany = await CompanyProfile.exists({ userId: d._id });
                    if (hasWorker || hasCompany) {
                        primaryDoc = d;
                        break;
                    }
                }

                // Remove non-primary duplicates if no dangling references exist
                for (const d of docs) {
                    if (d._id.toString() !== primaryDoc._id.toString()) {
                        const hasLogs = await AuditLog.exists({ actor: d._id });
                        if (!hasLogs) {
                            await User.deleteOne({ _id: d._id });
                            console.log(`🗑️ Safely removed duplicate user document ID: ${d._id} for email: ${email}`);
                        } else {
                            console.log(`⚠️ Preserving duplicate ID ${d._id} due to audit log references.`);
                        }
                    }
                }
            }
        }

        // 3. REPAIR / UPSERT EXACT 4 REQUIRED TEST ACCOUNTS
        const targetAccounts = [
            { name: 'Test Customer', email: 'user@test.com', password: 'Customer@12345', role: 'CUSTOMER' },
            { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER' },
            { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY' },
            { name: 'Test Admin', email: 'admin@test.com', password: 'Admin@12345', role: 'ADMIN' }
        ];

        console.log("\n==========================================================");
        console.log("🔧 UPSERTING TEST USERS WITH REAL BCRYPT HASHES");
        console.log("==========================================================");

        for (const acc of targetAccounts) {
            const normEmail = acc.email.toLowerCase().trim();
            const realHash = await hashPassword(acc.password);
            assert.ok(realHash.startsWith('$2a$') || realHash.startsWith('$2b$'));

            const existingUser = await User.findOne({ email: normEmail });

            if (existingUser) {
                existingUser.name = acc.name;
                existingUser.passwordHash = realHash;
                existingUser.role = acc.role;
                existingUser.status = 'ACTIVE';
                existingUser.emailVerified = true;
                existingUser.phoneVerified = true;
                existingUser.failedLoginAttempts = 0;
                existingUser.lockedUntil = undefined;
                await existingUser.save();
                usersUpdated++;
                console.log(`✅ UPDATED user: ${normEmail} (${acc.role}) with valid salted bcrypt hash`);
            } else {
                const newUser = await User.create({
                    name: acc.name,
                    email: normEmail,
                    passwordHash: realHash,
                    role: acc.role,
                    status: 'ACTIVE',
                    emailVerified: true,
                    phoneVerified: true
                });
                usersCreated++;
                console.log(`✅ CREATED user: ${normEmail} (${acc.role}) with valid salted bcrypt hash`);

                // Create profile requirements if WORKER or COMPANY
                if (acc.role === 'WORKER') {
                    await WorkerProfile.create({ userId: newUser._id, verificationStatus: 'INCOMPLETE_PROFILE' });
                } else if (acc.role === 'COMPANY') {
                    await CompanyProfile.create({ userId: newUser._id, companyName: acc.name, email: normEmail, phone: '9990000000', address: 'TBD', city: 'TBD', state: 'TBD', pincode: '000000', businessType: 'Other', description: 'Test Company', authorizedPersonName: acc.name, authorizedPersonPhone: '9990000000', verificationStatus: 'APPROVED' });
                    await CompanyWallet.create({ companyId: newUser._id, availableBalancePaise: 100000 });
                }
            }
        }

        countAfter = await User.countDocuments();
        console.log(`\n📊 Total users after repair: ${countAfter}`);

        // 4. VERIFY MONGODB STATE & BCRYPT MATCHES
        let bcryptVerified = true;
        for (const acc of targetAccounts) {
            const normEmail = acc.email.toLowerCase();
            const docs = await User.find({ email: normEmail }).select('+passwordHash');
            assert.equal(docs.length, 1, `Expected exactly 1 document for ${normEmail}, found ${docs.length}`);

            const u = docs[0];
            assert.equal(u.role, acc.role);
            assert.equal(u.status, 'ACTIVE');

            const isMatch = await bcrypt.compare(acc.password, u.passwordHash);
            if (!isMatch) bcryptVerified = false;
            assert.equal(isMatch, true, `Bcrypt compare failed for ${normEmail}`);
        }
        logResult('Bcrypt Verification', bcryptVerified);

        // 5. TEST REAL API LOGIN FOR ALL 4 ROLES
        console.log("\n==========================================================");
        console.log("🌐 TESTING REAL EXPRESS API LOGIN FOR ALL 4 ROLES");
        console.log("==========================================================");

        const tokens = {};

        // CUSTOMER Login
        const custRes = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'Customer@12345' });
        logResult('CUSTOMER login', custRes.status === 200 && custRes.body.user?.role === 'CUSTOMER' && !!custRes.body.accessToken);
        tokens.CUSTOMER = custRes.body.accessToken;

        // WORKER Login
        const wrkRes = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'Worker@12345' });
        logResult('WORKER login', wrkRes.status === 200 && wrkRes.body.user?.role === 'WORKER' && !!wrkRes.body.accessToken);
        tokens.WORKER = wrkRes.body.accessToken;

        // COMPANY Login
        const cmpRes = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'Company@12345' });
        logResult('COMPANY login', cmpRes.status === 200 && cmpRes.body.user?.role === 'COMPANY' && !!cmpRes.body.accessToken);
        tokens.COMPANY = cmpRes.body.accessToken;

        // ADMIN Login
        const admRes = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });
        logResult('ADMIN login', admRes.status === 200 && admRes.body.user?.role === 'ADMIN' && !!admRes.body.accessToken);
        tokens.ADMIN = admRes.body.accessToken;

        // 6. TEST GET /api/auth/me WITH RETURNED TOKENS
        const custMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.CUSTOMER}`);
        const wrkMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.WORKER}`);
        const cmpMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.COMPANY}`);
        const admMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.ADMIN}`);

        const meResult = custMe.body.user?.role === 'CUSTOMER' &&
                         wrkMe.body.user?.role === 'WORKER' &&
                         cmpMe.body.user?.role === 'COMPANY' &&
                         admMe.body.user?.role === 'ADMIN';

        logResult('/auth/me verification', meResult);

        // 7. TEST ROLE ISOLATION ON ADMIN APIS
        const custAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.CUSTOMER}`);
        const wrkAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.WORKER}`);
        const cmpAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.COMPANY}`);
        const admAdmin = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${tokens.ADMIN}`);

        const rbacResult = custAdmin.status === 403 &&
                           wrkAdmin.status === 403 &&
                           cmpAdmin.status === 403 &&
                           admAdmin.status === 200;

        logResult('Role authorization (RBAC)', rbacResult);

        // 8. TEST WRONG PASSWORDS
        const custWrong = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'WrongPassword' });
        const wrkWrong = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'WrongPassword' });
        const cmpWrong = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'WrongPassword' });
        const admWrong = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'WrongPassword' });

        const wrongPassResult = custWrong.status === 401 &&
                                 wrkWrong.status === 401 &&
                                 cmpWrong.status === 401 &&
                                 admWrong.status === 401;

        logResult('Wrong password rejection', wrongPassResult);
        logResult('Backend tests result', failedChecks === 0);

    } finally {
        await stopTestEnvironment();
    }

    console.log("\n==========================================================");
    console.log("📊 SUMMARY OF INSPECTION & REPAIR");
    console.log("==========================================================");
    console.log(`- Number of users before: ${countBefore}`);
    console.log(`- Duplicate entries found: ${duplicatesFound.length}`);
    console.log(`- Users updated: ${usersUpdated}`);
    console.log(`- Users created: ${usersCreated}`);
    console.log(`- Final user count: ${countAfter}`);
    console.log(`- Total checks passed: ${passedChecks}/${passedChecks + failedChecks}`);
    console.log("==========================================================");
}

runSafeRepairAndAudit();
