import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testApi() {
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin@12345'
  });

  const token = loginRes.data.accessToken;

  const res = await axios.get('http://localhost:5000/api/admin/workers/pending', {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log('Pending Workers API Response:', JSON.stringify(res.data, null, 2));
}

testApi().catch(console.error);
