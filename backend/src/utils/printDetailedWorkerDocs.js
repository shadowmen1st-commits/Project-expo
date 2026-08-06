import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';
import VerificationDocument from '../models/VerificationDocument.js';

await mongoose.connect(config.MONGODB_URI);
try {
    const user = await User.findOne({ email: 'harshsingh7839291402@gmail.com' });
    if (user) {
        const docs = await VerificationDocument.find({ workerId: user._id }).sort({ createdAt: -1 });
        console.log(JSON.stringify(docs, null, 2));
    }
} finally {
    await mongoose.disconnect();
}
