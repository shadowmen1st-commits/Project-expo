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
        name: "Test User",
        email: "user@test.com",
        password: "User@12345",
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: "Test Service Provider",
        email: "service@test.com",
        password: "Service@12345",
        role: "SERVICE",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: true
    }
];


async function seedUsers() {

    try {

        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB Connected");


        for (const user of users) {

            const exists = await User.findOne({
                email: user.email
            });


            if (exists) {
                console.log(
                    `${user.email} already exists`
                );
                continue;
            }


            const hashedPassword = await bcrypt.hash(
                user.password,
                10
            );


            await User.create({
                ...user,
                password: hashedPassword
            });


            console.log(
                `Created: ${user.email}`
            );
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