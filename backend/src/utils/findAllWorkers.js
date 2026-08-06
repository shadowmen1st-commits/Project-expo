import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';

await mongoose.connect(config.MONGODB_URI);
try {
    const workers = await User.find({ role: 'WORKER' });
    console.log(`Found ${workers.length} workers:`);
    for (const w of workers) {
        const profile = await WorkerProfile.findOne({ userId: w._id });
        const docs = await VerificationDocument.find({ workerId: w._id });
        console.log(`Worker: id=${w._id}, name=${w.name}, email=${w.email}`);
        if (profile) {
            console.log(`  Profile: fullName=${profile.fullName}, status=${profile.verificationStatus}`);
        }
        console.log(`  Docs:`, docs.map(d => ({ id: d._id, type: d.documentType, number: d.documentNumberLast4, isCurrent: d.isCurrent, status: d.verificationStatus })));
    }
} catch (err) {
    console.error(err);
} finally {
    await mongoose.disconnect();
}
