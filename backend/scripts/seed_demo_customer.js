import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function seedDemoCustomerAllDatabases() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const passwordHash = await bcrypt.hash('Demo@123', 10);

    const dbs = ['hyperlocal', 'test'];
    for (const dbName of dbs) {
      const db = conn.connection.useDb(dbName);
      const users = db.collection('users');
      await users.updateOne(
        { email: 'demo@jobnest.com' },
        {
          $set: {
            name: 'Demo Customer',
            email: 'demo@jobnest.com',
            phone: '9876543200',
            passwordHash: passwordHash,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      console.log(`✅ Seeded demo@jobnest.com into database: ${dbName}`);
    }

    console.log('Demo customer seed across all databases completed successfully.');
  } catch (err) {
    console.error('Failed to seed demo customer across databases:', err);
    throw err;
  }
}

seedDemoCustomerAllDatabases().then(() => process.exit(0)).catch(() => process.exit(1));
