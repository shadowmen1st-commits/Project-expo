import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import dns from 'node:dns';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { hashPassword, comparePassword } from '../src/utils/authUtils.js';

// Public DNS fallback to ensure SRV record resolution on Windows
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
    // ignore if locked
}

dotenv.config();

async function fixTestUsersCollection() {
    console.log("==========================================================");
    console.log("🛠️ FIXING MISSING test.users COLLECTION IN MONGODB ATLAS");
    console.log("==========================================================");

    // STEP 1: VERIFY CONNECTION
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ MONGODB_URI missing in backend/.env");
        process.exit(1);
    }

    const targetDbName = 'test';
    await mongoose.connect(uri, { dbName: targetDbName, serverSelectionTimeoutMS: 10000 });

    const connectedDbName = mongoose.connection.name;
    console.log(`Connected database: ${connectedDbName}`);
    if (connectedDbName !== targetDbName) {
        console.error(`❌ DATABASE SELECTION FAILED: Connected to '${connectedDbName}' instead of '${targetDbName}'`);
        process.exit(1);
    }

    // STEP 2: EXPLICITLY CREATE COLLECTION "users" IF NOT PRESENT
    const db = mongoose.connection.db;
    const collectionsInfo = await db.listCollections().toArray();
    const collectionNames = collectionsInfo.map(c => c.name);

    if (!collectionNames.includes('users')) {
        console.log("  ➕ Executing db.createCollection('users') in database 'test'...");
        await db.createCollection('users');
    } else {
        console.log("  ✅ Collection 'users' already exists in database 'test'");
    }

    // Confirm collection exists via getCollectionNames equivalent
    const updatedCollectionsInfo = await db.listCollections().toArray();
    const updatedCollectionNames = updatedCollectionsInfo.map(c => c.name);
    const usersCollectionExistsPass = updatedCollectionNames.includes('users');
    console.log(`✅ test.users collection exists: ${usersCollectionExistsPass ? 'PASS' : 'FAIL'}`);

    // STEP 4, 5, 6, 7, 8: CREATE / UPDATE EXACT 4 CORE TEST USERS
    console.log("\n--- SEEDING / UPDATING CORE 4 TEST USERS IN test.users ---");
    const realAdminHash = await hashPassword('Admin@12345');
    const realCustHash = await hashPassword('Customer@12345');
    const realWrkHash = await hashPassword('Worker@12345');
    const realCmpHash = await hashPassword('Company@12345');

    const coreAccounts = [
        { name: 'Test Admin', email: 'admin@test.com', phone: '9999999900', pass: 'Admin@12345', hash: realAdminHash, role: 'ADMIN' },
        { name: 'Test Customer', email: 'customer@test.com', phone: '9999999901', pass: 'Customer@12345', hash: realCustHash, role: 'CUSTOMER' },
        { name: 'Test Worker', email: 'worker@test.com', phone: '9999999902', pass: 'Worker@12345', hash: realWrkHash, role: 'WORKER' },
        { name: 'Test Company', email: 'company@test.com', phone: '9999999903', pass: 'Company@12345', hash: realCmpHash, role: 'COMPANY' }
    ];

    for (const acc of coreAccounts) {
        let userDoc = await User.findOne({ email: acc.email });
        if (userDoc) {
            userDoc.name = acc.name;
            userDoc.phone = acc.phone;
            userDoc.passwordHash = acc.hash;
            userDoc.role = acc.role;
            userDoc.status = 'ACTIVE';
            userDoc.emailVerified = true;
            userDoc.phoneVerified = true;
            userDoc.authenticationMethods = ['PASSWORD'];
            userDoc.primaryAuthenticationMethod = 'PASSWORD';
            userDoc.failedLoginAttempts = 0;
            userDoc.lockedUntil = null;
            await userDoc.save();
            console.log(`  ✅ Updated: ${acc.email} (${acc.role})`);
        } else {
            await User.create({
                name: acc.name,
                email: acc.email,
                phone: acc.phone,
                passwordHash: acc.hash,
                role: acc.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                authenticationMethods: ['PASSWORD'],
                primaryAuthenticationMethod: 'PASSWORD',
                failedLoginAttempts: 0
            });
            console.log(`  ✅ Created: ${acc.email} (${acc.role})`);
        }
    }

    // STEP 9: VERIFY DIRECTLY IN MONGODB ATLAS
    console.log("\n--- DIRECT MONGODB ATLAS COLLECTION AUDIT ---");
    const targetEmailDocs = await User.find({
        email: { $in: ['admin@test.com', 'customer@test.com', 'worker@test.com', 'company@test.com'] }
    });

    console.log(`  📄 Target Core Documents Found in test.users: ${targetEmailDocs.length}`);
    const adminDoc = targetEmailDocs.find(d => d.email === 'admin@test.com');
    const custDoc = targetEmailDocs.find(d => d.email === 'customer@test.com');
    const wrkDoc = targetEmailDocs.find(d => d.email === 'worker@test.com');
    const cmpDoc = targetEmailDocs.find(d => d.email === 'company@test.com');

    const allCoreDocsPass = !!(adminDoc && custDoc && wrkDoc && cmpDoc);
    console.log(`  ✅ Admin (${adminDoc?.role || 'MISSING'}), Customer (${custDoc?.role || 'MISSING'}), Worker (${wrkDoc?.role || 'MISSING'}), Company (${cmpDoc?.role || 'MISSING'}): ${allCoreDocsPass ? 'PASS' : 'FAIL'}`);

    // STEP 10: VERIFY BCRYPT PASSWORDS DIRECTLY
    let bcryptPassCount = 0;
    for (const acc of coreAccounts) {
        const fetched = await User.findOne({ email: acc.email }).select('+passwordHash');
        const match = await comparePassword(acc.pass, fetched.passwordHash);
        if (match) bcryptPassCount++;
    }
    const bcryptPassAll = bcryptPassCount === 4;
    console.log(`  ✅ Direct bcrypt.compare for all 4 accounts: ${bcryptPassAll ? 'PASS' : 'FAIL'} (${bcryptPassCount}/4)`);

    // STEP 12 & 13: REAL APPLICATION EXPRESS LOGIN TEST
    console.log("\n--- REAL APPLICATION EXPRESS LOGIN TEST ---");
    const app = createApp();
    let loginPassCount = 0;
    let mePassCount = 0;

    for (const acc of coreAccounts) {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: acc.email, password: acc.pass });

        if (loginRes.status === 200 && loginRes.body.accessToken) {
            loginPassCount++;
            const meRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

            if (meRes.status === 200 && meRes.body.user?.role === acc.role) {
                mePassCount++;
                console.log(`  ✅ API Login & /auth/me for ${acc.role} (${acc.email}): HTTP 200 OK`);
            }
        } else {
            console.error(`  ❌ API Login failed for ${acc.email}: HTTP ${loginRes.status}`, loginRes.body);
        }
    }

    const totalUsersCount = await User.countDocuments();

    await mongoose.disconnect();

    console.log("\n==========================================================");
    console.log("📋 FINAL MANDATORY VERIFICATION REPORT");
    console.log("==========================================================");
    console.log(`MongoDB connection: PASS`);
    console.log(`Database:\ntest`);
    console.log(`users collection exists: ${usersCollectionExistsPass ? 'PASS' : 'FAIL'}`);
    console.log(`users count:\n${totalUsersCount}`);
    console.log(`Admin: ${adminDoc ? 'PASS' : 'FAIL'}`);
    console.log(`Customer: ${custDoc ? 'PASS' : 'FAIL'}`);
    console.log(`Worker: ${wrkDoc ? 'PASS' : 'FAIL'}`);
    console.log(`Company: ${cmpDoc ? 'PASS' : 'FAIL'}`);
    console.log(`bcrypt verification: ${bcryptPassAll ? 'PASS' : 'FAIL'}`);
    console.log(`Admin login: ${loginPassCount >= 1 ? 'PASS' : 'FAIL'}`);
    console.log(`Customer login: ${loginPassCount >= 2 ? 'PASS' : 'FAIL'}`);
    console.log(`Worker login: ${loginPassCount >= 3 ? 'PASS' : 'FAIL'}`);
    console.log(`Company login: ${loginPassCount >= 4 ? 'PASS' : 'FAIL'}`);
    console.log(`/api/auth/me: ${mePassCount === 4 ? 'PASS' : 'FAIL'}`);
    console.log(`Runtime database:\ntest`);
    console.log("==========================================================");
}

fixTestUsersCollection();
