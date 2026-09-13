import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import ServiceCategory from '../src/models/ServiceCategory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const usersToEnsure = [
    {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'Admin@12345',
        role: 'ADMIN',
    },
    {
        name: 'Test Customer',
        email: 'customer@test.com',
        password: 'Customer@12345',
        role: 'CUSTOMER',
    },
    {
        name: 'Demo Customer',
        email: 'demo@jobnest.com',
        password: 'Demo@123',
        role: 'CUSTOMER',
    },
    {
        name: 'Test Worker Pro',
        email: 'worker@test.com',
        password: 'Worker@12345',
        role: 'WORKER',
    },
    {
        name: 'Test Company',
        email: 'company@test.com',
        password: 'Company@12345',
        role: 'COMPANY',
    }
];

async function run() {
    console.log('Connecting to MongoDB database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const categories = await ServiceCategory.find({ status: 'ACTIVE' });
    const categoryIds = categories.map(c => c._id);

    console.log('\n--- UPSERTING & VERIFYING ACCOUNTS ---');

    for (const u of usersToEnsure) {
        const passwordHash = await bcrypt.hash(u.password, 10);
        const userDoc = await User.findOneAndUpdate(
            { email: u.email.toLowerCase() },
            {
                $set: {
                    name: u.name,
                    email: u.email.toLowerCase(),
                    passwordHash,
                    role: u.role,
                    status: 'ACTIVE',
                    emailVerified: true,
                    phoneVerified: true,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                }
            },
            { upsert: true, new: true }
        );

        if (u.role === 'WORKER') {
            await WorkerProfile.findOneAndUpdate(
                { userId: userDoc._id },
                {
                    $set: {
                        fullName: u.name,
                        verificationStatus: 'APPROVED',
                        isPubliclyVisible: true,
                        isOnline: true,
                        serviceCategoryIds: categoryIds,
                        serviceIds: categoryIds,
                        primaryServiceCategoryId: categoryIds[0] || null,
                        hourlyRate: 25000,
                        dailyRate: 150000,
                        timezone: 'Asia/Kolkata',
                    }
                },
                { upsert: true }
            );
        } else if (u.role === 'COMPANY') {
            await CompanyProfile.findOneAndUpdate(
                { userId: userDoc._id },
                {
                    $set: {
                        companyName: u.name,
                        email: u.email.toLowerCase(),
                        phone: '9999999999',
                        verificationStatus: 'APPROVED'
                    }
                },
                { upsert: true }
            );
        }

        // Test bcrypt verification
        const verifiedUser = await User.findOne({ email: u.email.toLowerCase() }).select('+passwordHash');
        const match = await bcrypt.compare(u.password, verifiedUser.passwordHash);
        console.log(`[${u.role.padEnd(8)}] Email: ${u.email.padEnd(20)} Password: ${u.password.padEnd(15)} -> Bcrypt match: ${match ? '✅ VERIFIED' : '❌ FAILED'}`);
    }

    await mongoose.disconnect();
    console.log('\nAll accounts configured and verified cleanly!');
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
