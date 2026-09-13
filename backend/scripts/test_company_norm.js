import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin@12345'
  });
  const token = loginRes.data.accessToken;

  const compVerifRes = await axios.get('http://localhost:5000/api/admin/company-verifications', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const compListRes = await axios.get('http://localhost:5000/api/admin/companies', {
    headers: { Authorization: `Bearer ${token}` }
  });

  const normalizeCompanies = (rawList) => {
    if (!Array.isArray(rawList)) return [];
    const seenIds = new Set();
    const normalized = [];

    for (let i = 0; i < rawList.length; i++) {
      const raw = rawList[i];
      if (!raw || typeof raw !== 'object') continue;
      const profile = raw.profile || raw;
      const user = raw.user || profile.user || (typeof profile.userId === 'object' ? profile.userId : null);

      const targetId = String(profile._id || raw._id || user?._id || '').trim();
      if (!targetId || seenIds.has(targetId)) continue;
      seenIds.add(targetId);

      normalized.push({
        ...raw,
        ...profile,
        _id: targetId,
        companyName: profile.companyName || user?.name || raw.companyName || 'Corporate Account',
        email: profile.email || user?.email || raw.email,
        phone: profile.phone || user?.phone || raw.phone,
        verificationStatus: profile.verificationStatus || raw.verificationStatus || 'PENDING',
        user: user || undefined,
        documents: Array.isArray(raw.documents) ? raw.documents : Array.isArray(profile.documents) ? profile.documents : [],
      });
    }

    return normalized;
  };

  const c1 = compVerifRes.data.verifications || compVerifRes.data.data || [];
  const c2 = compListRes.data.companies || compListRes.data.data || [];
  const allRaw = [...c1, ...c2];
  const norm = normalizeCompanies(allRaw);

  console.log('Total normalized companies:', norm.length);
  console.log('Companies details:', norm.map(c => ({ id: c._id, name: c.companyName, status: c.verificationStatus })));
}

run().catch(console.error);
