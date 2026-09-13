import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import VerificationDocument from '../src/models/VerificationDocument.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function seedPendingWorkers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find 4 worker users
  const workerProfiles = await WorkerProfile.find({}).limit(4);
  console.log(`Found ${workerProfiles.length} worker profiles`);

  for (let i = 0; i < workerProfiles.length; i++) {
    const wp = workerProfiles[i];
    const newStatus = i % 2 === 0 ? 'PENDING_APPROVAL' : 'UNDER_REVIEW';
    wp.verificationStatus = newStatus;
    wp.isKycVerified = false;
    wp.isPubliclyVisible = false;
    await wp.save();

    // Ensure dummy document exists for testing
    const existingDoc = await VerificationDocument.findOne({ workerId: wp.userId });
    if (!existingDoc) {
      await VerificationDocument.create({
        workerId: wp.userId,
        documentType: 'AADHAAR',
        documentNumber: '1234-5678-9012',
        frontFile: 'https://placehold.co/600x400.png',
        backFile: 'https://placehold.co/600x400.png',
        verificationStatus: 'PENDING',
      });
    }

    const u = await User.findById(wp.userId);
    console.log(`Worker: ${u?.name || 'Worker'} (${u?.email}) -> Status set to ${newStatus}`);
  }

  console.log('Successfully set workers to PENDING status!');
  await mongoose.disconnect();
}

seedPendingWorkers().catch(console.error);
