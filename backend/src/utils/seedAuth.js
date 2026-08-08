import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Resolve directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hyperlocal';

const testUsers = [
    {
        name: 'System Admin',
        email: 'admin@test.com',
        password: 'Admin@12345',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: 'Test Customer',
        email: 'user@test.com',
        password: 'User@12345',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true
    },
    {
        name: 'Test Worker',
        email: 'worker@test.com',
        password: 'Worker@12345',
        role: 'WORKER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true
    }
];

const seed = async () => {
    try {
        console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        console.log('\n--- Seeding Auth Test Users ---');
        for (const user of testUsers) {
            const passwordHash = await bcrypt.hash(user.password, 10);
            
            // Check if user exists
            const existingUser = await User.findOne({ email: user.email });
            let seededUser;
            
            if (existingUser) {
                // Update credentials
                existingUser.name = user.name;
                existingUser.passwordHash = passwordHash;
                existingUser.role = user.role;
                existingUser.status = user.status;
                existingUser.emailVerified = user.emailVerified;
                existingUser.phoneVerified = user.phoneVerified;
                existingUser.failedLoginAttempts = 0;
                existingUser.lockedUntil = undefined;
                seededUser = await existingUser.save();
                console.log(`Updated existing user: ${user.email} (ID: ${seededUser._id})`);
            } else {
                // Create user
                seededUser = await User.create({
                    name: user.name,
                    email: user.email,
                    phone: user.role === 'ADMIN' ? '9999911111' : user.role === 'CUSTOMER' ? '9999922222' : '9999933333',
                    passwordHash,
                    role: user.role,
                    status: user.status,
                    emailVerified: user.emailVerified,
                    phoneVerified: user.phoneVerified
                });
                console.log(`Created new user: ${user.email} (ID: ${seededUser._id})`);
            }
        }
        
        console.log('\n--- Seeding Completed Successfully ---');
        console.log('Credentials:');
        testUsers.forEach(u => {
            console.log(`- Role: ${u.role} | Email: ${u.email} | Password: ${u.password}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Seeding Failed:', error);
        process.exit(1);
    }
};

seed();
