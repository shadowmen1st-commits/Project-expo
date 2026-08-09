import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verify() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admin = await User.findOne({ email: 'admin@test.com' });
        if (admin && admin.role === 'ADMIN') {
            console.log('PASS: Admin account exists in production DB.');
        } else {
            console.log('FAIL: Admin account missing or incorrect role in production DB.');
        }
        process.exit(0);
    } catch (e) {
        console.error('Database connection failed:', e.message);
        process.exit(1);
    }
}
verify();
