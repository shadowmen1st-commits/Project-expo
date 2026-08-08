import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CompanyWallet from '../models/CompanyWallet.js';
import CompanyVerificationDocument from '../models/CompanyVerificationDocument.js';
import { hashPassword } from '../utils/authUtils.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_marketplace';

const run = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const passHash = await hashPassword('Company@12345');

        // Create Admin if not exists
        let admin = await User.findOne({ email: 'admin@test.com' });
        if (!admin) {
            admin = await User.create({
                name: 'System Admin',
                email: 'admin@test.com',
                phone: '9999911111',
                passwordHash: await hashPassword('Admin@12345'),
                role: 'ADMIN',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
            console.log('Admin seeded.');
        }

        // Clean existing companies
        await User.deleteMany({ role: 'COMPANY' });
        await CompanyProfile.deleteMany({});
        await CompanyWallet.deleteMany({});
        await CompanyVerificationDocument.deleteMany({});

        // Company 1: PENDING
        const comp1 = await User.create({
            name: 'Apex Events Pvt. Ltd.',
            email: 'company1@test.com',
            phone: '9000000001',
            passwordHash: passHash,
            role: 'COMPANY',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });
        await CompanyProfile.create({
            userId: comp1._id,
            companyName: 'Apex Events Pvt. Ltd.',
            email: 'company1@test.com',
            phone: '9000000001',
            address: 'Plot 42, Sector 62',
            city: 'Noida',
            state: 'Uttar Pradesh',
            pincode: '201301',
            businessType: 'Event Management',
            description: 'A leading event workforce provider in NCR.',
            authorizedPersonName: 'Amit Verma',
            authorizedPersonPhone: '9000000011',
            panNumber: 'ABCDE1234F',
            verificationStatus: 'PENDING'
        });
        await CompanyWallet.create({ companyId: comp1._id });

        // Company 2: UNDER_REVIEW
        const comp2 = await User.create({
            name: 'Delhi Logistics Corp',
            email: 'company2@test.com',
            phone: '9000000002',
            passwordHash: passHash,
            role: 'COMPANY',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });
        await CompanyProfile.create({
            userId: comp2._id,
            companyName: 'Delhi Logistics Corp',
            email: 'company2@test.com',
            phone: '9000000002',
            address: '12, Okhla Phase 3',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110020',
            businessType: 'Logistics',
            description: 'Workforce delivery & warehousing agents.',
            authorizedPersonName: 'Sumit Singh',
            authorizedPersonPhone: '9000000022',
            panNumber: 'FGHIJ5678K',
            verificationStatus: 'UNDER_REVIEW'
        });
        await CompanyWallet.create({ companyId: comp2._id });
        await CompanyVerificationDocument.create([
            { companyId: comp2._id, documentType: 'BUSINESS_REGISTRATION', documentUrl: '/uploads/verification/mock-inc.pdf', status: 'PENDING' },
            { companyId: comp2._id, documentType: 'ADDRESS_PROOF', documentUrl: '/uploads/verification/mock-addr.pdf', status: 'PENDING' },
            { companyId: comp2._id, documentType: 'AUTHORIZED_PERSON_ID', documentUrl: '/uploads/verification/mock-id.pdf', status: 'PENDING' },
            { companyId: comp2._id, documentType: 'COMPANY_PAN', documentUrl: '/uploads/verification/mock-pan.pdf', status: 'PENDING' }
        ]);

        // Company 3: NEEDS_INFORMATION
        const comp3 = await User.create({
            name: 'NCR Facility Care',
            email: 'company3@test.com',
            phone: '9000000003',
            passwordHash: passHash,
            role: 'COMPANY',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });
        await CompanyProfile.create({
            userId: comp3._id,
            companyName: 'NCR Facility Care',
            email: 'company3@test.com',
            phone: '9000000003',
            address: 'A-23, Sector 2',
            city: 'Noida',
            state: 'Uttar Pradesh',
            pincode: '201301',
            businessType: 'Facility Management',
            description: 'Cleaners and housekeeping teams.',
            authorizedPersonName: 'Vikram Sharma',
            authorizedPersonPhone: '9000000033',
            panNumber: 'LMNOP9012Q',
            verificationStatus: 'NEEDS_INFORMATION',
            needsInfoReason: 'Please upload a clearer address proof.'
        });
        await CompanyWallet.create({ companyId: comp3._id });
        await CompanyVerificationDocument.create([
            { companyId: comp3._id, documentType: 'BUSINESS_REGISTRATION', documentUrl: '/uploads/verification/mock-inc.pdf', status: 'APPROVED' },
            { companyId: comp3._id, documentType: 'ADDRESS_PROOF', documentUrl: '/uploads/verification/mock-addr.pdf', status: 'REJECTED', rejectionReason: 'Please upload a clearer address proof.' },
            { companyId: comp3._id, documentType: 'AUTHORIZED_PERSON_ID', documentUrl: '/uploads/verification/mock-id.pdf', status: 'APPROVED' },
            { companyId: comp3._id, documentType: 'COMPANY_PAN', documentUrl: '/uploads/verification/mock-pan.pdf', status: 'APPROVED' }
        ]);

        // Company 4: VERIFIED
        const comp4 = await User.create({
            name: 'Noida Security Solutions',
            email: 'company4@test.com',
            phone: '9000000004',
            passwordHash: passHash,
            role: 'COMPANY',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });
        await CompanyProfile.create({
            userId: comp4._id,
            companyName: 'Noida Security Solutions',
            email: 'company4@test.com',
            phone: '9000000004',
            address: 'Sec-18 Mall Road',
            city: 'Noida',
            state: 'Uttar Pradesh',
            pincode: '201301',
            businessType: 'Security Services',
            description: 'Professional guards and marshals.',
            authorizedPersonName: 'Rohan Verma',
            authorizedPersonPhone: '9000000044',
            panNumber: 'RSTUV3456W',
            verificationStatus: 'VERIFIED'
        });
        await CompanyWallet.create({ companyId: comp4._id, availableBalancePaise: 500000 });
        await CompanyVerificationDocument.create([
            { companyId: comp4._id, documentType: 'BUSINESS_REGISTRATION', documentUrl: '/uploads/verification/mock-inc.pdf', status: 'APPROVED' },
            { companyId: comp4._id, documentType: 'ADDRESS_PROOF', documentUrl: '/uploads/verification/mock-addr.pdf', status: 'APPROVED' },
            { companyId: comp4._id, documentType: 'AUTHORIZED_PERSON_ID', documentUrl: '/uploads/verification/mock-id.pdf', status: 'APPROVED' },
            { companyId: comp4._id, documentType: 'COMPANY_PAN', documentUrl: '/uploads/verification/mock-pan.pdf', status: 'APPROVED' }
        ]);

        // Company 5: REJECTED
        const comp5 = await User.create({
            name: 'Gurgaon Staffing Agency',
            email: 'company5@test.com',
            phone: '9000000005',
            passwordHash: passHash,
            role: 'COMPANY',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });
        await CompanyProfile.create({
            userId: comp5._id,
            companyName: 'Gurgaon Staffing Agency',
            email: 'company5@test.com',
            phone: '9000000005',
            address: 'Cyber City Phase 2',
            city: 'Gurugram',
            state: 'Haryana',
            pincode: '122002',
            businessType: 'Recruitment',
            description: 'Hyperlocal workforce supplier.',
            authorizedPersonName: 'Sunita Sharma',
            authorizedPersonPhone: '9000000055',
            panNumber: 'XYZAB7890C',
            verificationStatus: 'REJECTED',
            rejectionReason: 'Invalid business registration certificate.'
        });
        await CompanyWallet.create({ companyId: comp5._id });
        await CompanyVerificationDocument.create([
            { companyId: comp5._id, documentType: 'BUSINESS_REGISTRATION', documentUrl: '/uploads/verification/mock-inc.pdf', status: 'REJECTED', rejectionReason: 'Invalid business registration certificate.' },
            { companyId: comp5._id, documentType: 'ADDRESS_PROOF', documentUrl: '/uploads/verification/mock-addr.pdf', status: 'APPROVED' },
            { companyId: comp5._id, documentType: 'AUTHORIZED_PERSON_ID', documentUrl: '/uploads/verification/mock-id.pdf', status: 'APPROVED' },
            { companyId: comp5._id, documentType: 'COMPANY_PAN', documentUrl: '/uploads/verification/mock-pan.pdf', status: 'APPROVED' }
        ]);

        console.log('Seeded Companies 1-5 with different verification states & documents successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Company Seed Error:', e);
        process.exit(1);
    }
};

run();
