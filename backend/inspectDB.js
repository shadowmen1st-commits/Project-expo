import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from './src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const inspect = async () => {
    try {
        console.log(`Connecting to MongoDB Atlas...`);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');

        const collectionName = User.collection.name;
        console.log(`\n1. Model Name: User`);
        console.log(`2. MongoDB Collection Name: ${collectionName}`);
        console.log(`3. User Schema File Path: backend/src/models/User.js`);
        console.log(`4. Database: ${mongoose.connection.name}`);
        console.log(`5. Is collection name explicitly configured? No (uses Mongoose default pluralization)`);

        const emailsToCheck = [
            'admin@test.com',
            'user@test.com',
            'worker@test.com',
            'company@test.com',
            'shadowmen1st@gmail.com'
        ];

        console.log('\n--- Checking Users in Database ---');
        let matchCount = 0;
        for (const email of emailsToCheck) {
            const user = await User.findOne({ email });
            if (user) {
                matchCount++;
                console.log(`[FOUND] Email: ${email} | Role: ${user.role} | Status: ${user.status} | ID: ${user._id}`);
            } else {
                console.log(`[NOT FOUND] Email: ${email}`);
            }
        }

        console.log(`\nTotal matching test users found: ${matchCount}`);
        process.exit(0);
    } catch (error) {
        console.error('Inspection Failed:', error);
        process.exit(1);
    }
};

inspect();
