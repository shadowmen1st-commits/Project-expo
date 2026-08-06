import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';
import VerificationDocument from '../models/VerificationDocument.js';

await mongoose.connect(config.MONGODB_URI);
try {
    const user = await User.findOne({ name: /dfbdfg/i });
    if (!user) {
        console.log('User dfbdfg not found');
    } else {
        console.log('User found:', { id: user._id, name: user.name, email: user.email });
        const docs = await VerificationDocument.find({ workerId: user._id });
        console.log('Documents for this worker:');
        console.log(JSON.stringify(docs, null, 2));
    }
} catch (err) {
    console.error(err);
} finally {
    await mongoose.disconnect();
}
