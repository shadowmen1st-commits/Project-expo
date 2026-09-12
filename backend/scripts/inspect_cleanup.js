import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB:', mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const col of collections) {
    const c = mongoose.connection.db.collection(col.name);
    const count = await c.countDocuments();
    const matches = await c.find({
      $or: [
        { email: { $regex: 'ayush|harsh', $options: 'i' } },
        { name: { $regex: 'ayush|harsh', $options: 'i' } },
        { fullName: { $regex: 'ayush|harsh', $options: 'i' } },
        { phone: { $regex: 'ayush|harsh', $options: 'i' } }
      ]
    }).toArray();
    console.log(`Collection [${col.name}] - Total: ${count}, Matches: ${matches.length}`);
    if (matches.length > 0) {
      console.log('Sample match:', JSON.stringify(matches.map(m => ({ _id: m._id, name: m.name, email: m.email, role: m.role })), null, 2));
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
