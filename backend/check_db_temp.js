import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function check() {
    const uri = process.env.MONGODB_URI;
    console.log(`Connecting to MongoDB...`);
    try {
        await mongoose.connect(uri);
        console.log('Connected successfully!');
        console.log('Connection state:', mongoose.connection.readyState);
        await mongoose.disconnect();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

check();
