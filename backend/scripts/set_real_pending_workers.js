import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function setPending() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Rahul Sharma
  const worker1 = await User.findOne({ email: 'worker1@test.com' });
  if (worker1) {
    await WorkerProfile.updateOne(
      { userId: worker1._id },
      { $set: { verificationStatus: 'PENDING_APPROVAL', isKycVerified: false, isPubliclyVisible: false } }
    );
    console.log('Set worker1@test.com (Rahul Sharma) to PENDING_APPROVAL');
  }

  // Demo Worker
  const demoWorker = await User.findOne({ email: 'worker@jobnest.com' });
  if (demoWorker) {
    await WorkerProfile.updateOne(
      { userId: demoWorker._id },
      { $set: { verificationStatus: 'UNDER_REVIEW', isKycVerified: false, isPubliclyVisible: false } }
    );
    console.log('Set worker@jobnest.com (Demo Worker) to UNDER_REVIEW');
  }

  // Create a brand new pending worker user too
  let newWorker = await User.findOne({ email: 'pending.worker@test.com' });
  if (!newWorker) {
    newWorker = await User.create({
      name: 'Amit Kumar (Plumber)',
      email: 'pending.worker@test.com',
      phone: '9876543210',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      role: 'WORKER',
      status: 'ACTIVE',
    });
    await WorkerProfile.create({
      userId: newWorker._id,
      fullName: 'Amit Kumar',
      phone: '9876543210',
      skills: ['Plumbing', 'Pipe Repair'],
      yearsOfExperience: 4,
      verificationStatus: 'PENDING_APPROVAL',
      isKycVerified: false,
      isPubliclyVisible: false,
      hourlyRate: 35000,
      dailyRate: 200000,
    });
    console.log('Created new pending worker: Amit Kumar (pending.worker@test.com)');
  } else {
    await WorkerProfile.updateOne(
      { userId: newWorker._id },
      { $set: { verificationStatus: 'PENDING_APPROVAL', isKycVerified: false, isPubliclyVisible: false } }
    );
    console.log('Set pending.worker@test.com to PENDING_APPROVAL');
  }

  await mongoose.disconnect();
}

setPending().catch(console.error);
