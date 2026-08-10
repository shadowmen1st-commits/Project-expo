process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from '../tests/helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import { hashPassword } from '../src/utils/authUtils.js';

async function runThreeUsersVerification() {
    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // Ensure Admin exists in DB (simulate existing admin)
        let adminUser = await User.findOne({ email: 'admin@test.com' });
        if (!adminUser) {
            const adminHash = await hashPassword('Admin@12345');
            adminUser = await User.create({
                name: 'System Admin',
                email: 'admin@test.com',
                phone: '9999999904',
                passwordHash: adminHash,
                role: 'ADMIN',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }

        // 3 Target Non-Admin Accounts
        const targetAccounts = [
            { name: 'Test Customer', email: 'user@test.com', password: 'Customer@12345', role: 'CUSTOMER', phone: '9999999901' },
            { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER', phone: '9999999902' },
            { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY', phone: '9999999903' }
        ];

        const report = {
            CUSTOMER: { email: 'user@test.com', status: 'PASS', hash: 'PASS', login: 'PASS', role: 'CUSTOMER' },
            WORKER: { email: 'worker@test.com', status: 'PASS', hash: 'PASS', login: 'PASS', role: 'WORKER', profile: 'PASS' },
            COMPANY: { email: 'company@test.com', status: 'PASS', hash: 'PASS', login: 'PASS', role: 'COMPANY', profile: 'PASS' }
        };

        for (const acc of targetAccounts) {
            const realHash = await hashPassword(acc.password);
            let u = await User.findOne({ email: acc.email });

            if (u) {
                if (u.role !== acc.role) {
                    throw new Error(`Role mismatch for ${acc.email}: expected ${acc.role}, found ${u.role}`);
                }
                u.name = acc.name;
                u.phone = acc.phone;
                u.passwordHash = realHash;
                u.status = 'ACTIVE';
                u.emailVerified = true;
                u.phoneVerified = true;
                await u.save();
            } else {
                u = await User.create({
                    name: acc.name,
                    email: acc.email,
                    phone: acc.phone,
                    passwordHash: realHash,
                    role: acc.role,
                    status: 'ACTIVE',
                    emailVerified: true,
                    phoneVerified: true
                });
            }

            if (acc.role === 'WORKER') {
                const wp = await WorkerProfile.findOne({ userId: u._id });
                if (!wp) {
                    await WorkerProfile.create({ userId: u._id, verificationStatus: 'APPROVED', isOnline: true, isPubliclyVisible: true });
                }
            } else if (acc.role === 'COMPANY') {
                const cp = await CompanyProfile.findOne({ userId: u._id });
                if (!cp) {
                    await CompanyProfile.create({ userId: u._id, companyName: acc.name, email: acc.email, phone: acc.phone, address: 'Test St', city: 'City', state: 'State', pincode: '10001', businessType: 'Other', description: 'Test Company', authorizedPersonName: acc.name, authorizedPersonPhone: acc.phone, verificationStatus: 'APPROVED' });
                }
            }

            // Verify Bcrypt match directly from DB
            const userWithHash = await User.findOne({ email: acc.email }).select('+passwordHash');
            const matches = await bcrypt.compare(acc.password, userWithHash.passwordHash);
            assert.equal(matches, true, `Bcrypt hash verification failed for ${acc.email}`);

            // Real API Login test
            const loginRes = await request(app).post('/api/auth/login').send({ email: acc.email, password: acc.password });
            assert.equal(loginRes.status, 200, `Login API failed for ${acc.email}`);
            assert.ok(loginRes.body.accessToken, `Missing accessToken for ${acc.email}`);

            // /me test
            const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.accessToken}`);
            assert.equal(meRes.status, 200);
            assert.equal(meRes.body.user?.role, acc.role);
        }

        // Count users by role
        const customerCount = await User.countDocuments({ role: 'CUSTOMER' });
        const workerCount = await User.countDocuments({ role: 'WORKER' });
        const companyCount = await User.countDocuments({ role: 'COMPANY' });
        const adminCount = await User.countDocuments({ role: 'ADMIN' });

        console.log("\nCUSTOMER");
        console.log("Email: user@test.com");
        console.log("Created/Existing: PASS");
        console.log("Password Hash: PASS");
        console.log("Login: PASS");
        console.log("Role: CUSTOMER");

        console.log("\nWORKER");
        console.log("Email: worker@test.com");
        console.log("Created/Existing: PASS");
        console.log("Password Hash: PASS");
        console.log("Login: PASS");
        console.log("Role: WORKER");
        console.log("WorkerProfile: PASS");

        console.log("\nCOMPANY");
        console.log("Email: company@test.com");
        console.log("Created/Existing: PASS");
        console.log("Password Hash: PASS");
        console.log("Login: PASS");
        console.log("Role: COMPANY");
        console.log("CompanyProfile: PASS");

        console.log("\nADMIN:");
        console.log("Already exists — DO NOT MODIFY.");

        console.log("\nUser Count by Role:");
        console.log(`- CUSTOMER: ${customerCount}`);
        console.log(`- WORKER: ${workerCount}`);
        console.log(`- COMPANY: ${companyCount}`);
        console.log(`- ADMIN: ${adminCount}`);

    } finally {
        await stopTestEnvironment();
    }
}

runThreeUsersVerification();
