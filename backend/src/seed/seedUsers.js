import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

dotenv.config();

const users = [
    {
        name: "Test Admin",
        email: "admin@test.com",
        password: "Admin@12345",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: "Test Customer User",
        email: "user@test.com",
        password: "Customer@12345",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: "Test Customer",
        email: "customer@test.com",
        password: "Customer@12345",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: "Test Worker",
        email: "worker@test.com",
        password: "Worker@12345",
        role: "WORKER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: "Test Company",
        email: "company@test.com",
        password: "Company@12345",
        role: "COMPANY",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    }
];

async function seedUsers() {
    try {
        if (!process.env.MONGODB_URI) {
            console.error("Missing MONGODB_URI environment variable.");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected");

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            const exists = await User.findOne({ email: user.email });

            if (exists) {
                exists.passwordHash = hashedPassword;
                exists.status = 'ACTIVE';
                exists.emailVerified = true;
                exists.phoneVerified = true;
                await exists.save();
                console.log(`Updated password & status for existing user: ${user.email}`);
            } else {
                await User.create({
                    name: user.name,
                    email: user.email,
                    passwordHash: hashedPassword,
                    role: user.role,
                    status: user.status,
                    emailVerified: user.emailVerified,
                    phoneVerified: user.phoneVerified
                });
                console.log(`Created new seeded user: ${user.email}`);
            }
        }

        console.log("Seed completed successfully");
        process.exit(0);


    } catch (error) {

        console.error(
            "Seed Error:",
            error
        );

        process.exit(1);

    }

}


seedUsers();