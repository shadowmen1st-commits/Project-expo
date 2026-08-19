import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CompanyWallet from '../models/CompanyWallet.js';

// Resolve directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not defined in the environment variables.');
    process.exit(1);
}

const testUsers = [
    {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'Admin@012345',
        role: 'ADMIN',
    },
    {
        name: 'Test Worker',
        email: 'worker@test.com',
        password: 'Worker@012345',
        role: 'WORKER',
    },
    {
        name: 'Test Customer',
        email: 'customer@test.com',
        password: 'Customer@12345',
        role: 'CUSTOMER',
    },
    {
        name: 'Demo Customer',
        email: 'customer@jobnest.com',
        password: 'Customer@12345',
        role: 'CUSTOMER',
    },
    {
        name: 'Demo Worker',
        email: 'worker@jobnest.com',
        password: 'Worker@12345',
        role: 'WORKER',
    },
    {
        name: 'Test Company',
        email: 'company@test.com',
        password: 'Company@012345',
        role: 'COMPANY',
    }
];

const seed = async () => {
    try {
        console.log(`Connecting to MongoDB...`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');

        for (const user of testUsers) {
            const normalizedEmail = user.email.trim().toLowerCase();
            const passwordHash = await bcrypt.hash(user.password, 10);

            const updateData = {
                name: user.name,
                passwordHash,
                role: user.role,
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                failedLoginAttempts: 0,
                lockedUntil: null,
            };

            const userRecord = await User.findOneAndUpdate(
                { email: normalizedEmail },
                { $set: updateData },
                { upsert: true, new: true }
            );

            // Create Profile based on role
            if (user.role === 'WORKER') {
                await WorkerProfile.findOneAndUpdate(
                    { userId: userRecord._id },
                    {
                        $setOnInsert: {
                            verificationStatus: 'INCOMPLETE_PROFILE',
                            isPubliclyVisible: false,
                            isOnline: false
                        }
                    },
                    { upsert: true }
                );
            } else if (user.role === 'COMPANY') {
                await CompanyProfile.findOneAndUpdate(
                    { userId: userRecord._id },
                    {
                        $setOnInsert: {
                            companyName: user.name,
                            email: normalizedEmail,
                            phone: '9999999999',
                            address: 'Test Address',
                            city: 'Test City',
                            state: 'Test State',
                            pincode: '110001',
                            businessType: 'Test Business',
                            description: 'Test Company Description',
                            authorizedPersonName: user.name,
                            authorizedPersonPhone: '9999999999',
                            verificationStatus: 'PENDING'
                        }
                    },
                    { upsert: true }
                );
                await CompanyWallet.findOneAndUpdate(
                    { companyId: userRecord._id },
                    {
                        $setOnInsert: {
                            availableBalancePaise: 1000000, // 10,000 INR for testing
                            pendingAmountPaise: 0,
                            escrowAmountPaise: 0,
                            totalSpentPaise: 0
                        }
                    },
                    { upsert: true }
                );
            }
        }

        console.log('\nSeed completed successfully.');
        console.log('ADMIN    admin@test.com / Admin@012345');
        console.log('WORKER   worker@test.com / Worker@012345');
        console.log('CUSTOMER customer@test.com / Customer@12345');
        console.log('COMPANY  company@test.com / Company@012345');

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seed();
