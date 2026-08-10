import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import { hashPassword } from '../src/utils/authUtils.js';

dotenv.config();

async function run() {
    console.log("=================================================");
    console.log("🔍 DIAGNOSING LIVE MONGODB USER & AUTHENTICATION");
    console.log("=================================================");

    let uri = process.env.MONGODB_URI;
    console.log("Connecting to MONGODB_URI:", uri ? uri.replace(/:[^:@]+@/, ':****@') : 'none');

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected to MongoDB database:", mongoose.connection.name);
    } catch (err) {
        console.warn("⚠️ Remote MongoDB connection failed:", err.message);
        console.log("Falling back to local MongoDB or MongoMemoryReplSet...");
        try {
            uri = 'mongodb://127.0.0.1:27017/marketplace';
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
            console.log("Connected to local MongoDB database:", mongoose.connection.name);
        } catch {
            const { MongoMemoryReplSet } = await import('mongodb-memory-server');
            const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
            uri = mongoServer.getUri();
            await mongoose.connect(uri);
            console.log("Connected to MongoMemoryReplSet instance for diagnosis.");
        }
    }

    // 1. Inspect admin@test.com
    const adminDocs = await User.find({ email: 'admin@test.com' }).select('+passwordHash');
    console.log(`\nFound ${adminDocs.length} user(s) matching admin@test.com`);

    for (const doc of adminDocs) {
        console.log("-----------------------------------------");
        console.log("ID:", doc._id.toString());
        console.log("Email:", doc.email);
        console.log("Role:", doc.role);
        console.log("Status:", doc.status);
        console.log("Has passwordHash field?", !!doc.passwordHash);
        if (doc.passwordHash) {
            const matchesExpected = await bcrypt.compare('Admin@12345', doc.passwordHash);
            console.log("Does passwordHash match 'Admin@12345'?", matchesExpected);
        } else {
            console.log("⚠️ CRITICAL: passwordHash is UNDEFINED or NULL!");
        }
    }

    // 2. Repair/Seed all 4 primary test users on this MongoDB instance
    const testAccounts = [
        { name: 'System Admin', email: 'admin@test.com', password: 'Admin@12345', role: 'ADMIN' },
        { name: 'Test Customer', email: 'customer@test.com', password: 'Customer@12345', role: 'CUSTOMER' },
        { name: 'Test Worker', email: 'worker@test.com', password: 'Worker@12345', role: 'WORKER' },
        { name: 'Test Company', email: 'company@test.com', password: 'Company@12345', role: 'COMPANY' }
    ];

    console.log("\n=================================================");
    console.log("🔧 REPAIRING & UPSERTING TEST ACCOUNTS");
    console.log("=================================================");

    for (const acc of testAccounts) {
        const hashedPassword = await hashPassword(acc.password);
        const existing = await User.findOne({ email: acc.email });

        if (existing) {
            existing.passwordHash = hashedPassword;
            existing.role = acc.role;
            existing.status = 'ACTIVE';
            existing.emailVerified = true;
            existing.phoneVerified = true;
            await existing.save();
            console.log(`✅ UPDATED ${acc.role}: ${acc.email} with new valid bcrypt hash for '${acc.password}'`);
        } else {
            await User.create({
                name: acc.name,
                email: acc.email,
                passwordHash: hashedPassword,
                role: acc.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
            console.log(`✅ CREATED ${acc.role}: ${acc.email} with valid bcrypt hash for '${acc.password}'`);
        }
    }

    // 3. Verify bcrypt comparison for all 4 users after repair
    console.log("\n=================================================");
    console.log("🧪 VERIFYING BCRYPT MATCHES AFTER REPAIR");
    console.log("=================================================");

    for (const acc of testAccounts) {
        const user = await User.findOne({ email: acc.email }).select('+passwordHash');
        const isMatch = await bcrypt.compare(acc.password, user.passwordHash);
        console.log(`User: ${acc.email} (${user.role}) -> Bcrypt match for '${acc.password}': ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    await mongoose.disconnect();
    console.log("\nDiagnosis & repair complete.");
}

run().catch(err => {
    console.error("Diagnosis Script Error:", err);
    process.exit(1);
});
