import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import WorkerProfile from "../models/WorkerProfile.js";
import WorkerWallet from "../models/WorkerWallet.js";
import CompanyProfile from "../models/CompanyProfile.js";
import CompanyWallet from "../models/CompanyWallet.js";

dotenv.config();

const users = [
    {
        name: "Test Customer",
        email: "user@test.com",
        phone: "9990001001",
        password: "Customer@12345",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        authenticationMethods: ["PASSWORD"],
        primaryAuthenticationMethod: "PASSWORD"
    },
    {
        name: "Test Customer Legacy",
        email: "customer@test.com",
        phone: "9990001005",
        password: "Customer@12345",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        authenticationMethods: ["PASSWORD"],
        primaryAuthenticationMethod: "PASSWORD"
    },
    {
        name: "Test Worker",
        email: "worker@test.com",
        phone: "9990001002",
        password: "Worker@12345",
        role: "WORKER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        authenticationMethods: ["PASSWORD"],
        primaryAuthenticationMethod: "PASSWORD"
    },
    {
        name: "Test Company",
        email: "company@test.com",
        phone: "9990001003",
        password: "Company@12345",
        role: "COMPANY",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        authenticationMethods: ["PASSWORD"],
        primaryAuthenticationMethod: "PASSWORD"
    },
    {
        name: "Test Admin",
        email: "admin@test.com",
        phone: "9990001004",
        password: "Admin@12345",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true,
        authenticationMethods: ["PASSWORD"],
        primaryAuthenticationMethod: "PASSWORD"
    }
];

async function seedUsers() {
    try {
        let uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error("Missing MONGODB_URI environment variable.");
            process.exit(1);
        }
        
        try {
            await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
            console.log("MongoDB Connected to MONGODB_URI");
        } catch (err) {
            console.warn("⚠️ MONGODB_URI failed, connecting to local fallback mongodb://127.0.0.1:27017/marketplace...");
            await mongoose.connect('mongodb://127.0.0.1:27017/marketplace');
        }

        for (const u of users) {
            const hashedPassword = await bcrypt.hash(u.password, 10);
            let userDoc = await User.findOne({ email: u.email });

            if (userDoc) {
                userDoc.name = u.name;
                userDoc.passwordHash = hashedPassword;
                userDoc.role = u.role;
                userDoc.status = u.status;
                userDoc.emailVerified = u.emailVerified;
                userDoc.phoneVerified = u.phoneVerified;
                userDoc.authenticationMethods = u.authenticationMethods;
                userDoc.primaryAuthenticationMethod = u.primaryAuthenticationMethod;
                userDoc.failedLoginAttempts = 0;
                await userDoc.save();
                console.log(`Updated seeded user: ${u.email}`);
            } else {
                userDoc = await User.create({
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    passwordHash: hashedPassword,
                    role: u.role,
                    status: u.status,
                    emailVerified: u.emailVerified,
                    phoneVerified: u.phoneVerified,
                    authenticationMethods: u.authenticationMethods,
                    primaryAuthenticationMethod: u.primaryAuthenticationMethod,
                    failedLoginAttempts: 0
                });
                console.log(`Created new seeded user: ${u.email}`);
            }

            if (u.role === 'WORKER') {
                const wp = await WorkerProfile.findOne({ userId: userDoc._id });
                if (!wp) {
                    await WorkerProfile.create({
                        userId: userDoc._id,
                        verificationStatus: 'APPROVED',
                        isOnline: true,
                        isPubliclyVisible: true,
                        skills: ['Home Cleaning', 'Plumbing'],
                        hourlyRate: 50
                    });
                }
                const ww = await WorkerWallet.findOne({ workerId: userDoc._id });
                if (!ww) {
                    await WorkerWallet.create({
                        workerId: userDoc._id,
                        availableBalancePaise: 500000,
                        pendingBalancePaise: 0
                    });
                }
            } else if (u.role === 'COMPANY') {
                const cp = await CompanyProfile.findOne({ userId: userDoc._id });
                if (!cp) {
                    await CompanyProfile.create({
                        userId: userDoc._id,
                        companyName: u.name,
                        email: u.email,
                        phone: u.phone || '9990000000',
                        address: '127 Test Street',
                        city: 'New York',
                        state: 'NY',
                        pincode: '10001',
                        businessType: 'Other',
                        description: 'Test Company Description',
                        authorizedPersonName: u.name,
                        authorizedPersonPhone: u.phone || '9990000000',
                        verificationStatus: 'APPROVED'
                    });
                }
                const cw = await CompanyWallet.findOne({ companyId: userDoc._id });
                if (!cw) {
                    await CompanyWallet.create({
                        companyId: userDoc._id,
                        availableBalancePaise: 500000,
                        escrowBalancePaise: 0
                    });
                }
            }
        }

        console.log("Seed completed successfully");
        process.exit(0);
    } catch (error) {
        console.error("Seed Error:", error);
        process.exit(1);
    }
}

seedUsers();