import { Router } from 'express';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import CommissionRule from '../models/CommissionRule.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import Coupon from '../models/Coupon.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import { hashPassword } from '../utils/authUtils.js';

const router = Router();

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

router.post('/seed', async (req, res, next) => {
    try {
        console.log('Starting DB Seeding via API...');

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
            });
            await profile.save();
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

        res.status(200).json({
            success: true,
            message: 'Database seeded successfully via dev endpoint!',
            admin: { email: 'admin@hyperlocal.com', password: 'admin123' },
            customer: { email: 'customer@hyperlocal.com', password: 'customer123' },
            worker: { email: 'worker@hyperlocal.com', password: 'worker123' },
        });
    } catch (err) {
        next(err);
    }
});

export default router;
