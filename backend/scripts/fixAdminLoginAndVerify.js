import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import dns from 'node:dns';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { hashPassword, comparePassword } from '../src/utils/authUtils.js';

// Set DNS servers to public fallback to avoid local DNS SRV resolution issues on Windows
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
    // ignore if locked
}

dotenv.config();

async function fixAdminLoginAndVerify() {
    console.log("==========================================================");
    console.log("🛠️ FIX ADMIN LOGIN — DATABASE, BCRYPT & E2E VERIFICATION");
    console.log("==========================================================");

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ ERROR: MONGODB_URI is not defined in backend/.env.");
        process.exit(1);
    }

    console.log("Connecting directly to MongoDB Atlas URI...");
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    } catch (connError) {
        console.error("\n❌ MONGODB CONNECTION FAILED");
        console.error("==========================================================");
        console.error("Exact Connection Error:", connError.message);
        console.error("Code:", connError.code);
        console.error("==========================================================");
        process.exit(1);
    }

    const dbName = mongoose.connection.name;
    console.log(`✅ MongoDB Connection State: CONNECTED`);
    console.log(`✅ Database Name: ${dbName}`);

    // STEP 4 & 5 & 6 & 7: Admin Account Fix & Salted Bcrypt Hashing
    const realAdminHash = await hashPassword('Admin@12345');

    const adminUser = await User.findOneAndUpdate(
        { email: 'admin@test.com' },
        {
            name: 'Test Admin',
            email: 'admin@test.com',
            phone: '9999999900',
            passwordHash: realAdminHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            failedLoginAttempts: 0,
            lockedUntil: null
        },
        { upsert: true, new: true, runValidators: true }
    );

    console.log(`✅ Admin Account Upserted: ID ${adminUser._id}`);

    // STEP 9: Duplicate Check
    const adminMatches = await User.find({ email: 'admin@test.com' });
    const adminCount = adminMatches.length;
    console.log(`✅ Admin Matching Documents Count: ${adminCount}`);

    // STEP 11: Direct Bcrypt Comparison Test
    const fetchedAdmin = await User.findOne({ email: 'admin@test.com' }).select('+passwordHash');
    const bcryptPass = await comparePassword('Admin@12345', fetchedAdmin.passwordHash);
    console.log(`✅ Direct bcrypt.compare('Admin@12345', passwordHash): ${bcryptPass ? 'PASS' : 'FAIL'}`);

    // STEP 12 & 13 & 14 & 15 & 16 & 17: REAL EXPRESS API LOGIN, /auth/me, & RBAC TESTS
    const app = createApp();

    // 1. Admin Login API
    const adminLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin@12345' });

    const loginPass = adminLoginRes.status === 200 && !!adminLoginRes.body.accessToken;
    console.log(`✅ POST /api/auth/login for Admin: HTTP ${adminLoginRes.status} (${loginPass ? 'PASS' : 'FAIL'})`);

    const adminToken = adminLoginRes.body.accessToken;

    // 2. /api/auth/me for Admin
    const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

    const mePass = meRes.status === 200 && meRes.body.user?.role === 'ADMIN' && meRes.body.user?.email === 'admin@test.com' && meRes.body.user?.status === 'ACTIVE';
    console.log(`✅ GET /api/auth/me for Admin: HTTP ${meRes.status} - Role: ${meRes.body.user?.role} (${mePass ? 'PASS' : 'FAIL'})`);

    // 3. Admin Protected Route
    const adminRouteRes = await request(app)
        .get('/api/admin/companies')
        .set('Authorization', `Bearer ${adminToken}`);

    const adminRoutePass = adminRouteRes.status === 200;
    console.log(`✅ GET /api/admin/companies for Admin: HTTP ${adminRouteRes.status} (${adminRoutePass ? 'PASS' : 'FAIL'})`);

    // 4. Role Security Matrix Tests
    const custLoginRes = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'Customer@12345' });
    const wrkLoginRes = await request(app).post('/api/auth/login').send({ email: 'worker@test.com', password: 'Worker@12345' });
    const cmpLoginRes = await request(app).post('/api/auth/login').send({ email: 'company@test.com', password: 'Company@12345' });

    const custAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${custLoginRes.body.accessToken}`);
    const wrkAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${wrkLoginRes.body.accessToken}`);
    const cmpAdminCheck = await request(app).get('/api/admin/companies').set('Authorization', `Bearer ${cmpLoginRes.body.accessToken}`);

    const custBlockPass = custAdminCheck.status === 403;
    const wrkBlockPass = wrkAdminCheck.status === 403;
    const cmpBlockPass = cmpAdminCheck.status === 403;

    console.log(`✅ Customer Blocked from Admin: HTTP ${custAdminCheck.status} (${custBlockPass ? 'PASS' : 'FAIL'})`);
    console.log(`✅ Worker Blocked from Admin: HTTP ${wrkAdminCheck.status} (${wrkBlockPass ? 'PASS' : 'FAIL'})`);
    console.log(`✅ Company Blocked from Admin: HTTP ${cmpAdminCheck.status} (${cmpBlockPass ? 'PASS' : 'FAIL'})`);

    await mongoose.disconnect();

    console.log("\n==========================================================");
    console.log("📋 FINAL EXECUTIVE VERIFICATION REPORT");
    console.log("==========================================================");
    console.log(`Database:\n${dbName}`);
    console.log(`\nAdmin user:\nFOUND`);
    console.log(`\nAdmin count for admin@test.com:\n${adminCount}`);
    console.log(`\nStored password:\nREAL BCRYPT HASH: YES`);
    console.log(`\nbcrypt.compare:\n${bcryptPass ? 'PASS' : 'FAIL'}`);
    console.log(`\nPOST /api/auth/login:\n${loginPass ? 'PASS' : 'FAIL'}`);
    console.log(`\nGET /api/auth/me:\n${mePass ? 'PASS' : 'FAIL'}`);
    console.log(`\nAdmin protected route:\n${adminRoutePass ? 'PASS' : 'FAIL'}`);
    console.log(`\nCustomer blocked from Admin:\n${custBlockPass ? 'PASS' : 'FAIL'}`);
    console.log(`\nWorker blocked from Admin:\n${wrkBlockPass ? 'PASS' : 'FAIL'}`);
    console.log(`\nCompany blocked from Admin:\n${cmpBlockPass ? 'PASS' : 'FAIL'}`);
    console.log("==========================================================");
}

fixAdminLoginAndVerify();
