import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const users = await db.collection('users').find({ role: 'WORKER' }).toArray();
        console.log('\n--- USERS (WORKERS) ---');
        users.forEach(u => {
            console.log(`User ID: ${u._id}, Name: ${u.name}, profileImage: ${u.profileImage}`);
        });

        const profiles = await db.collection('workerprofiles').find().toArray();
        console.log('\n--- WORKER PROFILES ---');
        profiles.forEach(p => {
            console.log(`Profile ID: ${p._id}, UserID: ${p.userId}, profilePhotoId: ${p.profilePhotoId}, name: ${p.name}`);
        });

        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
