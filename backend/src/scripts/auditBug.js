import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import ServiceCategory from '../models/ServiceCategory.js';

async function run() {
    await connectDB();
    const rajesh = await User.findOne({ name: 'Rajesh Kumar' });
    if (!rajesh) {
        console.log('Rajesh not found');
        return;
    }
    const profile = await WorkerProfile.findOne({ userId: rajesh._id }).populate('serviceCategoryIds');
    console.log('Rajesh Categories:', profile.serviceCategoryIds.map(c => c ? { id: c._id, name: c.name } : null));

    const cats = await ServiceCategory.find();
    console.log('All Categories:', cats.map(c => ({ id: c._id, name: c.name })));

    await disconnectDB();
}
run().catch(console.error);
