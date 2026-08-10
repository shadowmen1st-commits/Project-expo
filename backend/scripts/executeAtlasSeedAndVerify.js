import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import dns from 'node:dns';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import { hashPassword } from '../src/utils/authUtils.js';

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
    // ignore if locked
}

dotenv.config();

async function executeAtlasSeed() {
    console.log("==========================================================");
    console.log("⚡ EXECUTING DIRECT MONGODB ATLAS SEED & API VERIFICATION");
    console.log("==========================================================");

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ ERROR: MONGODB_URI is not defined in environment variables.");
        process.exit(1);
    }

    console.log("Connecting directly to MONGODB_URI configured in backend/.env...");
    
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    } catch (connError) {
        console.error("\n❌ MONGODB CONNECTION FAILED");
        console.error("==========================================================");
        console.error("Exact Connection Error:", connError.message);
        console.error("Code:", connError.code);
        console.error("Syscall:", connError.syscall);
        console.error("Hostname:", connError.hostname);
        console.error("==========================================================");
        console.error("Please check:");
        console.error(" 1. MONGODB_URI in backend/.env");
        console.error(" 2. MongoDB Atlas Network Access (IP Whitelist / 0.0.0.0/0)");
        console.log("Stopping execution as requested.");
        process.exit(1);
    }

    const dbName = mongoose.connection.name;
    const collectionName = User.collection.name;
    console.log(`✅ MongoDB Connection State: CONNECTED`);
    console.log(`✅ Database Name: ${dbName}`);
    console.log(`✅ User Collection Name: ${collectionName}`);

    // Target Test Accounts
    const targetAccounts = [
        { name: 'System Admin', email: 'admin@test.com', phone: '9999999904', password: 'Admin@12345', role: 'ADMIN' },
        { name: 'Test Customer', email: 'user@test.com', phone: '9999999901', password: 'Customer@12345', role: 'CUSTOMER' },
        { name: 'Test Worker', email: 'worker@test.com', phone: '9999999902', password: 'Worker@12345', role: 'WORKER' },
        { name: 'Test Company', email: 'company@test.com', phone: '9999999903', password: 'Company@12345', role: 'COMPANY' }
    ];

    console.log("\n--- SEEDING / UPSERTING TEST ACCOUNTS IN MONGODB ---");

    for (const acc of targetAccounts) {
        const hashedPassword = await hashPassword(acc.password);
        let userDoc = await User.findOne({ email: acc.email });

        if (userDoc) {
            if (userDoc.role !== acc.role) {
                console.error(`⚠️ WARNING: Role mismatch for ${acc.email}: existing role is ${userDoc.role}, target is ${acc.role}`);
            } else {
                userDoc.name = acc.name;
                userDoc.phone = acc.phone;
                userDoc.passwordHash = hashedPassword;
                userDoc.status = 'ACTIVE';
                userDoc.emailVerified = true;
                userDoc.phoneVerified = true;
                userDoc.failedLoginAttempts = 0;
                await userDoc.save();
                console.log(`✅ UPDATED ${acc.role}: ${acc.email} with real salted bcrypt hash`);
            }
        } else {
            userDoc = await User.create({
                name: acc.name,
                email: acc.email,
                phone: acc.phone,
                passwordHash: hashedPassword,
                role: acc.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                authenticationMethods: ['PASSWORD'],
                primaryAuthenticationMethod: 'PASSWORD',
                failedLoginAttempts: 0
            });
            console.log(`✅ CREATED ${acc.role}: ${acc.email} with real salted bcrypt hash`);
        }

        // Related Profiles
        if (acc.role === 'WORKER') {
            const wp = await WorkerProfile.findOne({ userId: userDoc._id });
            if (!wp) {
                await WorkerProfile.create({
                    userId: userDoc._id,
                    verificationStatus: 'APPROVED',
                    isOnline: true,
                    isPubliclyVisible: true,
                    skills: ['Home Cleaning', 'Plumbing'],
                    hourlyRate: 50
                });
                console.log(`✅ CREATED WorkerProfile for worker ID: ${userDoc._id}`);
            }
        } else if (acc.role === 'COMPANY') {
            const cp = await CompanyProfile.findOne({ userId: userDoc._id });
            if (!cp) {
                await CompanyProfile.create({
                    userId: userDoc._id,
                    companyName: acc.name,
                    email: acc.email,
                    phone: acc.phone,
                    address: '123 Market St',
                    city: 'Metropolis',
                    state: 'NY',
                    pincode: '10001',
                    businessType: 'Other',
                    description: 'Test Company Description',
                    authorizedPersonName: acc.name,
                    authorizedPersonPhone: acc.phone,
                    verificationStatus: 'APPROVED'
                });
                console.log(`✅ CREATED CompanyProfile for company ID: ${userDoc._id}`);
            }
        }
    }

    // DIRECT MONGODB DATABASE VERIFICATION
    console.log("\n==========================================================");
    console.log("🔍 DIRECT MONGODB DATABASE VERIFICATION");
    console.log("==========================================================");

    const adminCheck = await User.find({ email: 'admin@test.com' });
    const custCheck = await User.find({ email: 'user@test.com' });
    const wrkCheck = await User.find({ email: 'worker@test.com' });
    const cmpCheck = await User.find({ email: 'company@test.com' });

    console.log(`ADMIN (${adminCheck.length} record): ${adminCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`CUSTOMER (${custCheck.length} record): ${custCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`WORKER (${wrkCheck.length} record): ${wrkCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`COMPANY (${cmpCheck.length} record): ${cmpCheck.length === 1 ? 'FOUND' : 'MISSING'}`);

    const totalTestAccounts = adminCheck.length + custCheck.length + wrkCheck.length + cmpCheck.length;
    console.log(`Total test users: ${totalTestAccounts}`);

    // Verify Bcrypt Password Comparison for all 4 accounts directly
    for (const acc of targetAccounts) {
        const doc = await User.findOne({ email: acc.email }).select('+passwordHash');
        const isMatch = await bcrypt.compare(acc.password, doc.passwordHash);
        console.log(`Bcrypt check for ${acc.email} (${acc.role}): ${isMatch ? '✅ MATCHES' : '❌ FAILED'}`);
    }

    // REAL EXPRESS API LOGIN TEST
    console.log("\n==========================================================");
    console.log("🌐 REAL EXPRESS API LOGIN & /API/AUTH/ME TEST");
    console.log("==========================================================");

    const app = createApp();

    for (const acc of targetAccounts) {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: acc.email, password: acc.password });

        if (loginRes.status === 200 && loginRes.body.accessToken) {
            console.log(`API Login for ${acc.email} (${acc.role}): HTTP 200 OK — Token Issued`);
            const meRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
            console.log(`API /auth/me for ${acc.email}: HTTP ${meRes.status} — Role: ${meRes.body.user?.role}`);
        } else {
            console.error(`❌ API Login FAILED for ${acc.email}: HTTP ${loginRes.status}`, loginRes.body);
        }
    }

    await mongoose.disconnect();

    console.log("\n==========================================================");
    console.log("📋 FINAL MANDATORY VERIFICATION SUMMARY");
    console.log("==========================================================");
    console.log(`Database: ${dbName}`);
    console.log(`Collection: ${collectionName}`);
    console.log(`ADMIN: ${adminCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`CUSTOMER: ${custCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`WORKER: ${wrkCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`COMPANY: ${cmpCheck.length === 1 ? 'FOUND' : 'MISSING'}`);
    console.log(`Total test users: ${totalTestAccounts}`);
    console.log(`Duplicate admin: ${adminCheck.length > 1 ? adminCheck.length - 1 : 0}`);
    console.log(`Duplicate customer: ${custCheck.length > 1 ? custCheck.length - 1 : 0}`);
    console.log(`Duplicate worker: ${wrkCheck.length > 1 ? wrkCheck.length - 1 : 0}`);
    console.log(`Duplicate company: ${cmpCheck.length > 1 ? cmpCheck.length - 1 : 0}`);
    console.log("==========================================================");
}

executeAtlasSeed();
