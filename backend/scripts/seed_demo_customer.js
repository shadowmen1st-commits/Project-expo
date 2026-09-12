import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function seedDemoCustomer() {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const demoEmail = 'demo@jobnest.com';
    const demoPassword = 'Demo@123';
    const demoName = 'Demo Customer';
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      user = await User.create({
        name: demoName,
        email: demoEmail,
        phone: '9876543200',
        passwordHash: passwordHash,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerified: true,
        authenticationMethods: ['PASSWORD'],
        primaryAuthenticationMethod: 'PASSWORD'
      });
      console.log(`✅ [CREATED] Dedicated Demo Customer Account: ${demoEmail} (Role: ${user.role}, ID: ${user._id})`);
    } else {
      user.name = demoName;
      user.passwordHash = passwordHash;
      user.role = 'CUSTOMER'; // strictly CUSTOMER
      user.status = 'ACTIVE';
      user.emailVerified = true;
      if (!user.authenticationMethods?.includes('PASSWORD')) {
        user.authenticationMethods = ['PASSWORD'];
      }
      user.primaryAuthenticationMethod = 'PASSWORD';
      await user.save();
      console.log(`✅ [VERIFIED/UPDATED] Dedicated Demo Customer Account: ${demoEmail} (Role: ${user.role}, ID: ${user._id})`);
    }

    // Verify bcrypt check
    const userWithPass = await User.findOne({ email: demoEmail }).select('+passwordHash');
    const isMatch = await bcrypt.compare(demoPassword, userWithPass.passwordHash);
    console.log(`Bcrypt check for ${demoEmail}: ${isMatch ? '✅ MATCHES' : '❌ FAILED'}`);

    return user;
  } catch (err) {
    console.error('Failed to seed demo customer:', err);
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDemoCustomer().then(() => {
    console.log('Seed demo customer script completed.');
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
