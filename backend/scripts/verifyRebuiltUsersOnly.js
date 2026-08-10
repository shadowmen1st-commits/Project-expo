process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.PAYOUT_PROVIDER_MODE = 'mock';

import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from '../tests/helpers/testEnvironment.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import WorkerWallet from '../src/models/WorkerWallet.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyWallet from '../src/models/CompanyWallet.js';
import { hashPassword } from '../src/utils/authUtils.js';

let usersCreatedPass = false;
let customerLoginPass = false;
let workerLoginPass = false;
let companyLoginPass = false;
let adminLoginPass = false;

async function runVerification() {
    console.log("==========================================================");
    console.log("🛡️ VERIFYING REBUILT USERS COLLECTION & AUTHENTICATION");
    console.log("==========================================================");

    await startReplicaSetTestEnvironment();
    const app = await createTestApp();

    try {
        // 1. Seed users using standard User model and bcrypt hash
        const testAccounts = [
            { name: 'Test Customer', email: 'user@test.com', password: 'Customer@12345', role: 'CUSTOMER', phone: '9990001001' },
            { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER', phone: '9990001002' },
            { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY', phone: '9990001003' },
            { name: 'Test Admin', email: 'admin@test.com', password: 'Admin@12345', role: 'ADMIN', phone: '9990001004' }
        ];

        for (const u of testAccounts) {
            const realHash = await hashPassword(u.password);
            assert.ok(realHash.startsWith('$2a$') || realHash.startsWith('$2b$'));

            const userDoc = await User.create({
                name: u.name,
                email: u.email,
                phone: u.phone,
                passwordHash: realHash,
                role: u.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                authenticationMethods: ['PASSWORD'],
                primaryAuthenticationMethod: 'PASSWORD',
                failedLoginAttempts: 0
            });

            if (u.role === 'WORKER') {
                await WorkerProfile.create({ userId: userDoc._id, verificationStatus: 'APPROVED', isOnline: true, isPubliclyVisible: true });
                await WorkerWallet.create({ workerId: userDoc._id, availableBalancePaise: 500000 });
            } else if (u.role === 'COMPANY') {
                await CompanyProfile.create({ userId: userDoc._id, companyName: u.name, email: u.email, phone: u.phone, address: 'Main St', city: 'City', state: 'State', pincode: '10001', businessType: 'Other', description: 'Test', authorizedPersonName: u.name, authorizedPersonPhone: u.phone, verificationStatus: 'APPROVED' });
                await CompanyWallet.create({ companyId: userDoc._id, availableBalancePaise: 500000 });
            }
        }

        // Verify users collection created
        const count = await User.countDocuments();
        if (count >= 4) {
            usersCreatedPass = true;
        }

        // 2. Real API Login & /auth/me for Customer
        const custLogin = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'Customer@12345' });
        if (custLogin.status === 200 && custLogin.body.accessToken) {
            const custMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${custLogin.body.accessToken}`);
            if (custMe.status === 200 && custMe.body.user?.role === 'CUSTOMER') {
                customerLoginPass = true;
            }
        }

        // 3. Real API Login & /auth/me for Worker
        const wrkLogin = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'Worker@12345' });
        if (wrkLogin.status === 200 && wrkLogin.body.accessToken) {
            const wrkMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${wrkLogin.body.accessToken}`);
            if (wrkMe.status === 200 && wrkMe.body.user?.role === 'WORKER') {
                workerLoginPass = true;
            }
        }

        // 4. Real API Login & /auth/me for Company
        const cmpLogin = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'Company@12345' });
        if (cmpLogin.status === 200 && cmpLogin.body.accessToken) {
            const cmpMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${cmpLogin.body.accessToken}`);
            if (cmpMe.status === 200 && cmpMe.body.user?.role === 'COMPANY') {
                companyLoginPass = true;
            }
        }

        // 5. Real API Login & /auth/me for Admin
        const admLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });
        if (admLogin.status === 200 && admLogin.body.accessToken) {
            const admMe = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admLogin.body.accessToken}`);
            if (admMe.status === 200 && admMe.body.user?.role === 'ADMIN') {
                adminLoginPass = true;
            }
        }

    } finally {
        await stopTestEnvironment();
    }

    console.log("\n==========================================================");
    console.log("📊 REBUILT USERS COLLECTION VERIFICATION RESULTS");
    console.log("==========================================================");
    console.log(`users collection created = ${usersCreatedPass ? 'PASS' : 'FAIL'}`);
    console.log(`Customer login = ${customerLoginPass ? 'PASS' : 'FAIL'}`);
    console.log(`Worker login = ${workerLoginPass ? 'PASS' : 'FAIL'}`);
    console.log(`Company login = ${companyLoginPass ? 'PASS' : 'FAIL'}`);
    console.log(`Admin login = ${adminLoginPass ? 'PASS' : 'FAIL'}`);
    console.log("==========================================================");
}

runVerification();
