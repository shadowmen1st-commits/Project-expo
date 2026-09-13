import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testCompanyApi() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const companiesInDb = await db.collection('companyprofiles').find({}).toArray();
  console.log('Total CompanyProfiles in DB:', companiesInDb.length);
  console.log('Company Profile Statuses in DB:', companiesInDb.map(c => ({ id: c._id, name: c.companyName, status: c.verificationStatus })));

  // Test API endpoint as admin
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin@12345'
  });
  const token = loginRes.data.accessToken;

  try {
    const verifRes = await axios.get('http://localhost:5000/api/admin/company-verifications', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('/admin/company-verifications response:', JSON.stringify(verifRes.data, null, 2));
  } catch (e) {
    console.error('/admin/company-verifications error:', e.response?.data || e.message);
  }

  try {
    const listRes = await axios.get('http://localhost:5000/api/admin/companies', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('/admin/companies response:', JSON.stringify(listRes.data, null, 2));
  } catch (e) {
    console.error('/admin/companies error:', e.response?.data || e.message);
  }

  await mongoose.disconnect();
}

testCompanyApi().catch(console.error);
