import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CompanyWallet from '../models/CompanyWallet.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import CompanyTeam from '../models/CompanyTeam.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import Attendance from '../models/Attendance.js';
import CompanyPayment from '../models/CompanyPayment.js';
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

        // Create Workers
        let w1 = await User.findOne({ email: 'worker1@test.com' });
        if (!w1) {
            w1 = await User.create({
                name: 'Amit Kumar',
                email: 'worker1@test.com',
                phone: '7777700001',
                passwordHash: await hashPassword('Worker@12345'),
                role: 'WORKER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }
        let w2 = await User.findOne({ email: 'worker2@test.com' });
        if (!w2) {
            w2 = await User.create({
                name: 'Sumit Singh',
                email: 'worker2@test.com',
                phone: '7777700002',
                passwordHash: await hashPassword('Worker@12345'),
                role: 'WORKER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }
        console.log('Workers seeded.');

        // Create Customers
        let c1 = await User.findOne({ email: 'customer1@test.com' });
        if (!c1) {
            c1 = await User.create({
                name: 'Rohan Verma',
                email: 'customer1@test.com',
                phone: '8888800001',
                passwordHash: await hashPassword('Customer@12345'),
                role: 'CUSTOMER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }
        let c2 = await User.findOne({ email: 'customer2@test.com' });
        if (!c2) {
            c2 = await User.create({
                name: 'Vikram Sharma',
                email: 'customer2@test.com',
                phone: '8888800002',
                passwordHash: await hashPassword('Customer@12345'),
                role: 'CUSTOMER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true
            });
        }
        console.log('Customers seeded.');

        // Create Companies
        let comp1 = await User.findOne({ email: 'company1@test.com' });
        if (!comp1) {
            comp1 = await User.create({
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
                gstNumber: '09AAAAA1111A1Z1',
                website: 'https://apexevents.example.com',
                verificationStatus: 'VERIFIED'
            });

            await CompanyWallet.create({
                companyId: comp1._id,
                availableBalancePaise: 5000000, // ₹50,000
                pendingAmountPaise: 0,
                escrowAmountPaise: 0,
                totalSpentPaise: 0
            });
        }

        let comp2 = await User.findOne({ email: 'company2@test.com' });
        if (!comp2) {
            comp2 = await User.create({
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
                gstNumber: '07BBBBB2222B2Z2',
                website: 'https://delhilogistics.example.com',
                verificationStatus: 'PENDING'
            });

            await CompanyWallet.create({
                companyId: comp2._id,
                availableBalancePaise: 1000000, // ₹10,000
                pendingAmountPaise: 0,
                escrowAmountPaise: 0,
                totalSpentPaise: 0
            });
        }
        console.log('Companies seeded.');

        // Seed sample company jobs
        await Job.deleteMany({ companyId: { $in: [comp1._id, comp2._id] } });
        const j1 = await Job.create({
            companyId: comp1._id,
            title: 'Event Helper / Marshal',
            description: 'Marshal duties and ticketing management for upcoming concert.',
            category: 'Event Management',
            requiredSkills: ['Crowd Management', 'Ticketing', 'English'],
            workersRequired: 10,
            location: 'Noida Stadium',
            address: 'Sector 21, Noida',
            workingDate: new Date(Date.now() + 86400000 * 2),
            startTime: '14:00',
            endTime: '22:00',
            payRate: 80000, // ₹800.00 in paise
            paymentType: 'DAILY',
            duration: '1 day',
            experienceRequired: 0,
            genderPreference: 'ANY',
            instructions: 'Report at Gate 4 by 1:30 PM in black dress.',
            applicationDeadline: new Date(Date.now() + 86400000),
            status: 'ACTIVE'
        });

        // Set wallet escrow for Job 1
        const wallet1 = await CompanyWallet.findOne({ companyId: comp1._id });
        wallet1.escrowAmountPaise += 80000 * 10;
        await wallet1.save();

        // Seed Application
        await JobApplication.deleteMany({ jobId: j1._id });
        await JobApplication.create({
            jobId: j1._id,
            workerId: w1._id,
            status: 'SELECTED'
        });
        await JobApplication.create({
            jobId: j1._id,
            workerId: w2._id,
            status: 'PENDING'
        });

        // Seed Assignment
        await WorkerAssignment.deleteMany({ jobId: j1._id });
        await WorkerAssignment.create({
            jobId: j1._id,
            workerId: w1._id,
            assignedBy: comp1._id,
            status: 'ASSIGNED'
        });

        // Seed Team
        await CompanyTeam.deleteMany({ companyId: comp1._id });
        await CompanyTeam.create({
            companyId: comp1._id,
            name: 'Concert Team A',
            leaderId: w1._id,
            members: [w1._id, w2._id]
        });

        // Seed Attendance
        await Attendance.deleteMany({ jobId: j1._id });
        await Attendance.create({
            jobId: j1._id,
            workerId: w1._id,
            date: new Date(),
            startTime: '14:00',
            endTime: '22:00',
            status: 'PRESENT',
            hoursWorked: 8
        });

        console.log('Seeded company job, applications, assignments, and teams.');
        console.log('Company Seed successful.');
        process.exit(0);
    } catch (e) {
        console.error('Company Seed Error:', e);
        process.exit(1);
    }
};

run();
