import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import CommissionRule from '../models/CommissionRule.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import Coupon from '../models/Coupon.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import { hashPassword } from '../utils/authUtils.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_marketplace';

const CATEGORIES_DATA = [
    { name: 'Driver', slug: 'driver', description: 'Experienced personal and commercial drivers.', icon: 'Car', defaultCommission: 12 },
    { name: 'Housekeeping', slug: 'housekeeping', description: 'Dusting, laundry, organization and standard house chores.', icon: 'Home', defaultCommission: 10 },
    { name: 'Senior Care', slug: 'senior-care', description: 'Caring companionship and assistance for elderly adults.', icon: 'Heart', defaultCommission: 15 },
    { name: 'Patient Care', slug: 'patient-care', description: 'Certified attendants for post-surgery and medical support.', icon: 'Activity', defaultCommission: 15 },
    { name: 'Babysitting', slug: 'babysitting', description: 'Reliable babysitters and child-care helpers.', icon: 'Baby', defaultCommission: 10 },
    { name: 'Cooking', slug: 'cooking', description: 'Professional chefs and daily home cooks.', icon: 'Utensils', defaultCommission: 10 },
    { name: 'Gardening', slug: 'gardening', description: 'Lawn care, weeding, and landscape upkeep.', icon: 'Flower', defaultCommission: 8 },
    { name: 'Cleaning', slug: 'cleaning', description: 'Deep home and office sanitization.', icon: 'Trash', defaultCommission: 10 },
    { name: 'Plumbing', slug: 'plumbing', description: 'Fixing leaks, installations and drainage fixes.', icon: 'Wrench', defaultCommission: 12 },
    { name: 'Electrical Work', slug: 'electrical-work', description: 'Wiring, repairs and home appliance installations.', icon: 'Zap', defaultCommission: 12 },
];

const seed = async () => {
    try {
        console.log('Connecting to database for seeding...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully.');

        // Safeguard for Production environment
        if (process.env.NODE_ENV === 'production' || MONGODB_URI.includes('production') || MONGODB_URI.includes('prod')) {
            console.error('🚫 CRITICAL ERROR: Seeding is disabled in production environments for safety.');
            process.exit(1);
        }

        // 1. Clear existing documents
        await User.deleteMany({});
        await ServiceCategory.deleteMany({});
        await CommissionRule.deleteMany({});
        await PlatformPricingConfig.deleteMany({});
        await Coupon.deleteMany({});
        await WorkerProfile.deleteMany({});
        await VerificationDocument.deleteMany({});
        await VerificationSubmission.deleteMany({});
        console.log('Cleared existing database tables.');

        // 2. Hash default passwords
        const adminPassHash = await hashPassword('admin123');
        const customerPassHash = await hashPassword('customer123');
        const workerPassHash = await hashPassword('worker123');

        // 3. Create Primary Admin User
        const adminUser = new User({
            name: 'Super Admin',
            email: 'admin@hyperlocal.com',
            phone: '9999999999',
            passwordHash: adminPassHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });
        await adminUser.save();
        console.log('✅ Admin created: admin@hyperlocal.com / admin123');

        // 4. Create Test Customers
        const customersData = [
            { name: 'John Customer', email: 'customer@hyperlocal.com', phone: '8888888888' },
            { name: 'Priya Sharma', email: 'priya.customer@hyperlocal.com', phone: '8888888881' },
            { name: 'Amit Verma', email: 'amit.customer@hyperlocal.com', phone: '8888888882' },
        ];

        for (const cust of customersData) {
            const customerUser = new User({
                name: cust.name,
                email: cust.email,
                phone: cust.phone,
                passwordHash: customerPassHash,
                role: 'CUSTOMER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
            });
            await customerUser.save();
            console.log(`✅ Customer created: ${cust.email} / customer123`);
        }

        // 5. Create Service Categories
        const seededCategories = [];
        for (const item of CATEGORIES_DATA) {
            const cat = await ServiceCategory.create({
                ...item,
                requiredDocuments: ['AADHAAR', 'PAN'],
                minimumExperience: 1,
                minimumBookingDuration: 2,
                sortOrder: seededCategories.length,
                isActive: true,
            });
            seededCategories.push(cat);
        }
        console.log(`✅ Seeded ${seededCategories.length} service categories.`);

        const categoryMap = {};
        seededCategories.forEach(c => { categoryMap[c.slug] = c._id; });

        // 6. Create Test Workers & Profiles
        const workersData = [
            {
                name: 'Alice Worker',
                email: 'worker@hyperlocal.com',
                phone: '7777777777',
                bio: 'Professional senior care specialist and house manager with over 5 years of experience.',
                skills: ['Elderly Care', 'Laundry', 'Cooking'],
                categories: [categoryMap['senior-care'], categoryMap['housekeeping']],
                hourlyRate: 35000,
                dailyRate: 250000,
                verificationStatus: 'INCOMPLETE_PROFILE',
                verificationBadge: false,
                isPubliclyVisible: false
            },
            {
                name: 'Rajesh Kumar',
                email: 'rajesh.worker@hyperlocal.com',
                phone: '7777777771',
                bio: 'Certified electrician and plumber with 8+ years experience in domestic wiring & repairs.',
                skills: ['Wiring', 'Switchboard Repair', 'Pipe Fitting', 'Sanitaryware'],
                categories: [categoryMap['electrical-work'], categoryMap['plumbing']],
                hourlyRate: 40000,
                dailyRate: 280000,
                verificationStatus: 'APPROVED',
                verificationBadge: true,
                isPubliclyVisible: true
            },
            {
                name: 'Sunita Sharma',
                email: 'sunita.worker@hyperlocal.com',
                phone: '7777777772',
                bio: 'Expert North/South Indian chef and experienced babysitter for toddlers.',
                skills: ['North Indian Food', 'South Indian Cooking', 'Baby Care', 'Meal Prep'],
                categories: [categoryMap['cooking'], categoryMap['babysitting']],
                hourlyRate: 30000,
                dailyRate: 220000,
                verificationStatus: 'PENDING_APPROVAL',
                verificationBadge: false,
                isPubliclyVisible: false
            },
            {
                name: 'Vikram Singh',
                email: 'vikram.worker@hyperlocal.com',
                phone: '7777777773',
                bio: 'Licensed commercial & private driver with deep knowledge of local routes and highway safety.',
                skills: ['Automatic & Manual Cars', 'Outstation Drives', 'Deep Cleaning'],
                categories: [categoryMap['driver'], categoryMap['cleaning']],
                hourlyRate: 45000,
                dailyRate: 300000,
                verificationStatus: 'CHANGES_REQUIRED',
                verificationBadge: false,
                isPubliclyVisible: false
            },
        ];

        for (const wData of workersData) {
            const workerUser = new User({
                name: wData.name,
                email: wData.email,
                phone: wData.phone,
                passwordHash: workerPassHash,
                role: 'WORKER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
            });
            await workerUser.save();

            const profile = new WorkerProfile({
                userId: workerUser._id,
                fullName: wData.name,
                phone: wData.phone,
                primaryServiceCategoryId: wData.categories[0],
                serviceCategoryIds: wData.categories.filter(Boolean),
                verificationStatus: wData.verificationStatus,
                verificationBadge: wData.verificationBadge,
                isOnline: true,
                isPubliclyVisible: wData.isPubliclyVisible,
                experienceYears: 5,
                bio: wData.bio,
                skills: wData.skills,
                languages: ['English', 'Hindi'],
                hourlyRate: wData.hourlyRate,
                dailyRate: wData.dailyRate,
                minimumBookingDuration: 2,
                serviceRadiusKm: 15,
                averageRating: wData.verificationStatus === 'APPROVED' ? 4.8 : null,
                ratingCount: wData.verificationStatus === 'APPROVED' ? 12 : 0,
                location: {
                    type: 'Point',
                    coordinates: [77.5946, 12.9716],
                },
            });
            await profile.save();

            // Seed Verification Documents and Submissions depending on the state
            if (wData.verificationStatus === 'APPROVED') {
                const aadDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'AADHAAR',
                    documentNumberEncrypted: 'mock-encrypted-aadhaar',
                    documentNumberLast4: '4321',
                    documentNumberHash: 'mock-hash-aadhaar',
                    frontFileId: 'uploads/mock-aadhaar.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'APPROVED',
                    isCurrent: true,
                    verifiedAt: new Date(),
                    verifiedBy: adminUser._id,
                    expiryDate: new Date(Date.now() + 31536000000)
                });
                const panDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'PAN',
                    documentNumberEncrypted: 'mock-encrypted-pan',
                    documentNumberLast4: '9876',
                    documentNumberHash: 'mock-hash-pan',
                    frontFileId: 'uploads/mock-pan.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'APPROVED',
                    isCurrent: true,
                    verifiedAt: new Date(),
                    verifiedBy: adminUser._id,
                    expiryDate: new Date(Date.now() + 31536000000)
                });

                await VerificationSubmission.create({
                    workerId: workerUser._id,
                    submissionNumber: 1,
                    version: 1,
                    profileSnapshot: profile.toObject(),
                    serviceSnapshot: { primaryServiceCategory: wData.categories[0] },
                    documentIds: [aadDoc._id, panDoc._id],
                    declarationAccepted: true,
                    consentAccepted: true,
                    status: 'APPROVED',
                    submittedAt: new Date(Date.now() - 86400000 * 2),
                    reviewedBy: adminUser._id,
                    finalDecisionAt: new Date(Date.now() - 86400000)
                });
            } else if (wData.verificationStatus === 'PENDING_APPROVAL') {
                const aadDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'AADHAAR',
                    documentNumberEncrypted: 'mock-encrypted-aadhaar-pending',
                    documentNumberLast4: '1111',
                    documentNumberHash: 'mock-hash-aadhaar-pending',
                    frontFileId: 'uploads/mock-aadhaar-pending.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'PENDING_REVIEW',
                    isCurrent: true,
                    expiryDate: new Date(Date.now() + 31536000000)
                });
                const panDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'PAN',
                    documentNumberEncrypted: 'mock-encrypted-pan-pending',
                    documentNumberLast4: '2222',
                    documentNumberHash: 'mock-hash-pan-pending',
                    frontFileId: 'uploads/mock-pan-pending.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'PENDING_REVIEW',
                    isCurrent: true,
                    expiryDate: new Date(Date.now() + 31536000000)
                });

                await VerificationSubmission.create({
                    workerId: workerUser._id,
                    submissionNumber: 1,
                    version: 1,
                    profileSnapshot: profile.toObject(),
                    serviceSnapshot: { primaryServiceCategory: wData.categories[0] },
                    documentIds: [aadDoc._id, panDoc._id],
                    declarationAccepted: true,
                    consentAccepted: true,
                    status: 'PENDING_APPROVAL',
                    submittedAt: new Date()
                });
            } else if (wData.verificationStatus === 'CHANGES_REQUIRED') {
                const aadDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'AADHAAR',
                    documentNumberEncrypted: 'mock-encrypted-aadhaar-approved',
                    documentNumberLast4: '3333',
                    documentNumberHash: 'mock-hash-aadhaar-approved',
                    frontFileId: 'uploads/mock-aadhaar-approved.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'APPROVED',
                    isCurrent: true,
                    verifiedAt: new Date(Date.now() - 3600000),
                    verifiedBy: adminUser._id,
                    expiryDate: new Date(Date.now() + 31536000000)
                });
                const panDoc = await VerificationDocument.create({
                    workerId: workerUser._id,
                    documentType: 'PAN',
                    documentNumberEncrypted: 'mock-encrypted-pan-rejected',
                    documentNumberLast4: '4444',
                    documentNumberHash: 'mock-hash-pan-rejected',
                    frontFileId: 'uploads/mock-pan-rejected.png',
                    fileMimeType: 'image/png',
                    fileSize: 10240,
                    status: 'REJECTED',
                    isCurrent: true,
                    verifiedAt: new Date(Date.now() - 3600000),
                    verifiedBy: adminUser._id,
                    rejectionReason: 'Image is blurred. Please upload a clear photo.',
                    expiryDate: new Date(Date.now() + 31536000000)
                });

                await VerificationSubmission.create({
                    workerId: workerUser._id,
                    submissionNumber: 1,
                    version: 1,
                    profileSnapshot: profile.toObject(),
                    serviceSnapshot: { primaryServiceCategory: wData.categories[0] },
                    documentIds: [aadDoc._id, panDoc._id],
                    declarationAccepted: true,
                    consentAccepted: true,
                    status: 'CHANGES_REQUIRED',
                    submittedAt: new Date(Date.now() - 86400000),
                    reviewedBy: adminUser._id,
                    finalDecisionAt: new Date(Date.now() - 3600000),
                    finalComment: 'Please re-upload a clear PAN card image.'
                });
            }

            console.log(`✅ Worker created: ${wData.email} / worker123 (${wData.name}) - Status: ${wData.verificationStatus}`);
        }

        // 7. Seed Platform Pricing Config
        const pConfig = new PlatformPricingConfig({
            currency: 'INR',
            customerPlatformFeeType: 'FIXED',
            customerPlatformFeeFixedPaise: 5000, // ₹50.00
            taxEnabled: true,
            taxRateBps: 1800, // 18% GST
            taxApplicationMode: 'EXCLUSIVE',
            quoteValiditySeconds: 900,
        });
        await pConfig.save();
        console.log('✅ Platform Pricing Config seeded (₹50 platform fee, 18% GST)');

        // 8. Seed Global Commission Rule
        const globalRule = new CommissionRule({
            name: 'Global Default 10% Commission',
            scope: 'GLOBAL',
            calculationType: 'PERCENTAGE',
            percentageBps: 1000, // 10%
            fixedAmountPaise: 0,
            minimumCommissionPaise: 0,
            priority: 3,
            effectiveFrom: new Date(),
            isActive: true,
            status: 'ACTIVE',
        });
        await globalRule.save();
        console.log('✅ Global Commission Rule seeded (10%)');

        // 9. Seed Test Coupon WELCOME10
        const testCoupon = new Coupon({
            code: 'WELCOME10',
            description: '10% Off Welcome Discount',
            discountType: 'PERCENTAGE',
            percentageBps: 1000, // 10%
            maximumDiscountPaise: 10000, // ₹100 max
            minimumOrderAmountPaise: 50000, // ₹500 min order
            validFrom: new Date(),
            isActive: true,
        });
        await testCoupon.save();
        console.log('✅ Test Coupon WELCOME10 seeded (10% off up to ₹100)');

        console.log('\n========================================');
        console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
        console.log('========================================\n');
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seed();
