import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import CommissionRule from '../models/CommissionRule.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import Coupon from '../models/Coupon.js';
import WorkerProfile from '../models/WorkerProfile.js';
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

        // 1. Clear existing test documents
        await User.deleteMany({});
        await ServiceCategory.deleteMany({});
        await CommissionRule.deleteMany({});
        await PlatformPricingConfig.deleteMany({});
        await Coupon.deleteMany({});
        await WorkerProfile.deleteMany({});
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
                bio: 'Professional senior care specialist and house manager with over 5 years of verified local experience.',
                skills: ['Elderly Care', 'Laundry', 'Cooking', 'Bilingual'],
                categories: [categoryMap['senior-care'], categoryMap['housekeeping']],
                hourlyRate: 35000,
                dailyRate: 250000,
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
                serviceCategoryIds: wData.categories.filter(Boolean),
                verificationStatus: 'APPROVED',
                verificationBadge: true,
                isOnline: true,
                isPubliclyVisible: true,
                experienceYears: 5,
                bio: wData.bio,
                skills: wData.skills,
                languages: ['English', 'Hindi'],
                hourlyRate: wData.hourlyRate,
                dailyRate: wData.dailyRate,
                minimumBookingDuration: 2,
                serviceRadiusKm: 15,
                averageRating: null,
                ratingCount: 0,
                location: {
                    type: 'Point',
                    coordinates: [77.5946, 12.9716],
                },
            });
            await profile.save();
            console.log(`✅ Worker created: ${wData.email} / worker123 (${wData.name})`);
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
