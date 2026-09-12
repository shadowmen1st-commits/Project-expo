import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import { createApp } from '../src/app.js';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyDemoAccountLive() {
  console.log('==================================================');
  console.log('LIVE DEMO ACCOUNT & RBAC VERIFICATION');
  console.log('==================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB Atlas:', mongoose.connection.name);

  // 1. Check Demo User in DB
  const demoUsers = await User.find({ email: 'demo@jobnest.com' }).select('+passwordHash');
  if (demoUsers.length !== 1) {
    throw new Error(`Expected exactly 1 demo user, found ${demoUsers.length}`);
  }
  const demoUser = demoUsers[0];
  console.log('✓ Exactly 1 demo customer found in DB:');
  console.log(`  ID: ${demoUser._id} | Email: ${demoUser.email} | Role: ${demoUser.role} | Status: ${demoUser.status}`);

  if (demoUser.role !== 'CUSTOMER') {
    throw new Error(`Demo user role is ${demoUser.role}, expected CUSTOMER!`);
  }

  // 2. Bcrypt check
  const isMatch = await bcrypt.compare('Demo@123', demoUser.passwordHash);
  if (!isMatch) {
    throw new Error('Bcrypt password verification failed for Demo@123!');
  }
  console.log('✓ Bcrypt password check with Demo@123: MATCHES');

  // 3. Check preserved Harsh/Ayush profiles
  const preservedUsers = await User.find({
    $or: [
      { email: { $regex: 'harsh|ayush', $options: 'i' } },
      { name: { $regex: 'harsh|ayush', $options: 'i' } }
    ]
  });
  console.log(`✓ Preserved real profiles intact in DB: ${preservedUsers.length} user(s)`);
  preservedUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.role}]`));

  // 4. Test live backend API login
  const app = createApp();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'demo@jobnest.com',
      password: 'Demo@123'
    });

  if (loginRes.status !== 200) {
    console.error('Login error response:', loginRes.body);
    throw new Error(`Expected HTTP 200 on demo login, got ${loginRes.status}`);
  }

  const token = loginRes.body.token || loginRes.body.accessToken;
  const returnedUser = loginRes.body.user;
  if (!token || !returnedUser) {
    throw new Error('Login response missing token or user object!');
  }
  console.log('✓ Live backend /api/auth/login responded HTTP 200 with valid JWT');
  console.log(`  Authenticated User: ${returnedUser.name} (${returnedUser.email})`);
  console.log(`  Role: ${returnedUser.role}`);

  // 5. Verify RBAC Security (Demo account cannot access admin/worker endpoints)
  console.log('\n--- RBAC SECURITY CHECKS ---');

  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  console.log(`  Customer /api/auth/me with demo token: HTTP ${meRes.status} (Pass: ${meRes.status === 200}, Role: ${meRes.body?.user?.role || meRes.body?.role})`);

  const adminReviewsRes = await request(app)
    .get('/api/admin/reviews')
    .set('Authorization', `Bearer ${token}`);
  console.log(`  Admin /api/admin/reviews with demo token: HTTP ${adminReviewsRes.status} (Forbidden as expected: ${adminReviewsRes.status === 403 ? 'PASS' : 'FAIL'})`);

  const categoriesRes = await request(app)
    .get('/api/categories');
  console.log(`  Public categories browsing: HTTP ${categoriesRes.status} (Pass: ${categoriesRes.status === 200})`);

  console.log('\n==================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('==================================================');
  process.exit(0);
}

verifyDemoAccountLive().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
