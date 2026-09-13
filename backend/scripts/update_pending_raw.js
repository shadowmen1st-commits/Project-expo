import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const workers = await db.collection('workerprofiles').find({}).limit(4).toArray();
  for (let i = 0; i < workers.length; i++) {
    const status = i % 2 === 0 ? 'PENDING_APPROVAL' : 'UNDER_REVIEW';
    await db.collection('workerprofiles').updateOne(
      { _id: workers[i]._id },
      { $set: { verificationStatus: status, isKycVerified: false, isPubliclyVisible: false } }
    );
    console.log(`Updated worker ${workers[i]._id} to ${status}`);
  }

  console.log('Done updating worker profiles!');
  await mongoose.disconnect();
}

run().catch(console.error);
