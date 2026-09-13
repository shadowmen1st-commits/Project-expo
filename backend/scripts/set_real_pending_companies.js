import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import CompanyProfile from '../src/models/CompanyProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function setPendingCompanies() {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Create or Update Company 1: Apex Logistics Pvt Ltd
  let compUser1 = await User.findOne({ email: 'apex.logistics@test.com' });
  if (!compUser1) {
    compUser1 = await User.create({
      name: 'Apex Logistics Pvt Ltd',
      email: 'apex.logistics@test.com',
      phone: '9811223344',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      role: 'COMPANY',
      status: 'ACTIVE',
    });
    await CompanyProfile.create({
      userId: compUser1._id,
      companyName: 'Apex Logistics Pvt Ltd',
      email: 'apex.logistics@test.com',
      phone: '9811223344',
      authorizedPersonName: 'Vikram Singh',
      authorizedPersonPhone: '9811223344',
      businessType: 'Logistics & Warehouse Management',
      gstNumber: '07AAACA1234A1Z5',
      address: 'Plot 42, Okhla Industrial Area Phase 3',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110020',
      description: 'Pan-India logistics and commercial relocation services provider.',
      verificationStatus: 'PENDING',
    });
    console.log('Created new pending company: Apex Logistics Pvt Ltd');
  } else {
    await CompanyProfile.updateOne(
      { userId: compUser1._id },
      { $set: { verificationStatus: 'PENDING' } }
    );
    console.log('Set apex.logistics@test.com to PENDING');
  }

  // 2. Create or Update Company 2: Urban Facility Services LLP
  let compUser2 = await User.findOne({ email: 'urban.services@test.com' });
  if (!compUser2) {
    compUser2 = await User.create({
      name: 'Urban Facility Services LLP',
      email: 'urban.services@test.com',
      phone: '9822334455',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuu',
      role: 'COMPANY',
      status: 'ACTIVE',
    });
    await CompanyProfile.create({
      userId: compUser2._id,
      companyName: 'Urban Facility Services LLP',
      email: 'urban.services@test.com',
      phone: '9822334455',
      authorizedPersonName: 'Sanjay Gupta',
      authorizedPersonPhone: '9822334455',
      businessType: 'Facility & Office Maintenance',
      gstNumber: '07BBBCB5678B1Z2',
      address: 'Tower B, DLF Cyber City',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002',
      description: 'Corporate housekeeping and building maintenance.',
      verificationStatus: 'UNDER_REVIEW',
    });
    console.log('Created new pending company: Urban Facility Services LLP');
  } else {
    await CompanyProfile.updateOne(
      { userId: compUser2._id },
      { $set: { verificationStatus: 'UNDER_REVIEW' } }
    );
    console.log('Set urban.services@test.com to UNDER_REVIEW');
  }

  console.log('Done setting pending companies!');
  await mongoose.disconnect();
}

setPendingCompanies().catch(console.error);
