import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const profiles = await WorkerProfile.find({
    verificationStatus: { $in: ['PENDING_APPROVAL', 'UNDER_REVIEW', 'APPROVED', 'NOT_SUBMITTED'] }
  });

  console.log(`Total profiles found: ${profiles.length}`);

  for (const p of profiles) {
    const user = await User.findById(p.userId);
    console.log(`Profile ${p._id} | userId: ${p.userId} | status: ${p.verificationStatus} | User: ${user ? user.name + ' (' + user.email + ')' : 'NULL / NOT FOUND'}`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
