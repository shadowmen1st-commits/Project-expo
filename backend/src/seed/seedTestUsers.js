import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CompanyWallet from '../models/CompanyWallet.js';

import ServiceCategory from '../models/ServiceCategory.js';

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
        password: 'Admin@123',
        role: 'ADMIN',
    },
    {
        name: 'Test Worker',
        email: 'worker@test.com',
        password: 'Worker@012345',
        role: 'WORKER',
    },
    {
        name: 'Rahul Sharma',
        email: 'worker1@test.com',
        password: 'Worker@123',
        role: 'WORKER',
    },
    {
        name: 'Demo Worker',
        email: 'worker@jobnest.com',
        password: 'Worker@12345',
        role: 'WORKER',
    },
    {
        name: 'Test Customer',
        email: 'customer@test.com',
        password: 'Customer@12345',
        role: 'CUSTOMER',
    },
    {
        name: 'John Customer',
        email: 'customer1@test.com',
        password: 'Customer@123',
        role: 'CUSTOMER',
    },
    {
        name: 'Demo Customer',
        email: 'customer@jobnest.com',
        password: 'Customer@12345',
        role: 'CUSTOMER',
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

        // Fetch categories to associate with workers
        const categories = await ServiceCategory.find({ status: 'ACTIVE' });
        const categoryIds = categories.map(c => c._id);

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
                        $set: {
                            fullName: user.name,
                            verificationStatus: 'APPROVED',
                            isPubliclyVisible: true,
                            isOnline: true,
                            serviceCategoryIds: categoryIds,
                            serviceIds: categoryIds,
                            primaryServiceCategoryId: categoryIds[0] || null,
                            hourlyRate: 25000,
                            dailyRate: 150000,
                            minimumBookingDuration: 1,
                            bufferMinutes: 0,
                            timezone: 'Asia/Kolkata',
                            location: {
                                type: 'Point',
                                coordinates: [77.2090, 28.6139] // New Delhi
                            },
                            availability: [
                                { day: 0, start: '08:00', end: '22:00', isWorking: true },
                                { day: 1, start: '08:00', end: '22:00', isWorking: true },
                                { day: 2, start: '08:00', end: '22:00', isWorking: true },
                                { day: 3, start: '08:00', end: '22:00', isWorking: true },
                                { day: 4, start: '08:00', end: '22:00', isWorking: true },
                                { day: 5, start: '08:00', end: '22:00', isWorking: true },
                                { day: 6, start: '08:00', end: '22:00', isWorking: true },
                            ],
                            leaveDates: [],
                            blockedRanges: []
                        }
                    },
                    { upsert: true, new: true }
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
                            verificationStatus: 'APPROVED'
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
        console.log('WORKER   worker@test.com / Worker@012345  &  worker1@test.com / Password123!');
        console.log('CUSTOMER customer@test.com / Customer@12345  &  customer1@test.com / Password123!');
        console.log('COMPANY  company@test.com / Company@012345');

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seed();
