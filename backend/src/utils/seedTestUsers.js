/**
 * seedTestUsers.js
 * Seeds 4 test accounts into the existing MongoDB users collection.
 * Idempotent - runs multiple times safely without duplicates.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import CompanyProfile from '../models/CompanyProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set in .env');
    process.exit(1);
}

const TEST_USERS = [
    {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'Admin@12345',
        phone: '9999999900',
        role: 'ADMIN',
    },
    {
        name: 'Test Customer',
        email: 'user@test.com',
        password: 'User@12345',
        phone: '9999999901',
        role: 'CUSTOMER',
    },
    {
        name: 'Test Worker',
        email: 'worker@test.com',
        password: 'Worker@12345',
        phone: '9999999902',
        role: 'WORKER',
    },
    {
        name: 'Test Company',
        email: 'company@test.com',
        password: 'Company@12345',
        phone: '9999999903',
        role: 'COMPANY',
    },
];

const seed = async () => {
    try {
        console.log(`\nConnecting to MongoDB...`);
        console.log(`URI: ${MONGODB_URI.replace(/:([^@]+)@/, ':***@')}`);
        await mongoose.connect(MONGODB_URI);
        console.log(`Connected! Database: ${mongoose.connection.name}`);
        console.log(`Collection: users\n`);

        const seeded = [];

        for (const u of TEST_USERS) {
            const passwordHash = await bcrypt.hash(u.password, 10);
            let dbUser = await User.findOne({ email: u.email });

            if (dbUser) {
                // Reset existing account
                dbUser.name = u.name;
                dbUser.phone = u.phone;
                dbUser.passwordHash = passwordHash;
                dbUser.role = u.role;
                dbUser.status = 'ACTIVE';
                dbUser.emailVerified = true;
                dbUser.phoneVerified = true;
                dbUser.failedLoginAttempts = 0;
                dbUser.lockedUntil = undefined;
                await dbUser.save();
                console.log(`[UPDATED] ${u.email}`);
            } else {
                dbUser = await User.create({
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    passwordHash,
                    role: u.role,
                    status: 'ACTIVE',
                    emailVerified: true,
                    phoneVerified: true,
                });
                console.log(`[CREATED] ${u.email}`);
            }

            // Worker profile
            if (u.role === 'WORKER') {
                const existing = await WorkerProfile.findOne({ userId: dbUser._id });
                if (!existing) {
                    await WorkerProfile.create({
                        userId: dbUser._id,
                        fullName: u.name,
                        phone: u.phone,
                        verificationStatus: 'APPROVED',
                        approvedAt: new Date(),
                        isPubliclyVisible: true,
                        isOnline: true,
                        bio: 'Test worker account for platform testing.',
                        skills: ['General Labour', 'Cleaning'],
                        languages: ['Hindi', 'English'],
                        hourlyRate: 15000,
                        dailyRate: 100000,
                        city: 'Delhi',
                        state: 'Delhi',
                    });
                    console.log(`  → WorkerProfile created`);
                } else {
                    existing.verificationStatus = 'APPROVED';
                    await existing.save();
                    console.log(`  → WorkerProfile updated`);
                }
            }

            // Company profile - VERIFIED
            if (u.role === 'COMPANY') {
                const existing = await CompanyProfile.findOne({ userId: dbUser._id });
                if (!existing) {
                    await CompanyProfile.create({
                        userId: dbUser._id,
                        companyName: 'Test Company Pvt Ltd',
                        email: u.email,
                        phone: u.phone,
                        address: '123 Test Street, Connaught Place',
                        city: 'Delhi',
                        state: 'Delhi',
                        pincode: '110001',
                        businessType: 'Private Limited',
                        description: 'Test company account for platform testing.',
                        authorizedPersonName: 'Test Authorized Person',
                        authorizedPersonPhone: '9999999999',
                        gstNumber: 'GST1234TEST',
                        panNumber: 'TESTPAN0001',
                        verificationStatus: 'VERIFIED',
                    });
                    console.log(`  → CompanyProfile created (VERIFIED)`);
                } else {
                    existing.verificationStatus = 'VERIFIED';
                    await existing.save();
                    console.log(`  → CompanyProfile updated to VERIFIED`);
                }
            }

            seeded.push(dbUser);
        }

        // Verify count
        const count = await User.countDocuments({
            email: { $in: TEST_USERS.map(u => u.email) }
        });

        console.log('\n=== Seeding Complete ===');
        console.log(`\ndb.users.countDocuments({ email: { $in: [...] } }) = ${count}`);
        console.log('\n--- Seeded Accounts ---');
        for (const u of seeded) {
            console.log(`  Name:   ${u.name}`);
            console.log(`  Email:  ${u.email}`);
            console.log(`  Role:   ${u.role}`);
            console.log(`  Status: ${u.status}`);
            console.log(`  ID:     ${u._id}`);
            console.log('');
        }

        console.log('--- Login Credentials ---');
        TEST_USERS.forEach(u => {
            console.log(`  ${u.role.padEnd(10)} | ${u.email.padEnd(25)} | ${u.password}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('\nSeeding Failed:', err.message);
        process.exit(1);
    }
};

seed();
