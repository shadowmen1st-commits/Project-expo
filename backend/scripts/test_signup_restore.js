import axios from 'axios';
const API_URL = 'https://project-expo-md7o.onrender.com/api';

async function testSignupFlow() {
    console.log('--- Testing New Customer Signup & State Restoration Flow ---');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const testUser = {
        name: `Customer Test ${randomSuffix}`,
        email: `cust_${randomSuffix}@example.com`,
        phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
        password: 'Password@123',
        role: 'CUSTOMER'
    };

    console.log(`1. Registering new customer: ${testUser.email}`);
    const regRes = await axios.post(`${API_URL}/auth/register`, testUser);
    if (!regRes.data?.success) throw new Error('Registration failed');
    console.log('   ✅ Registration successful');

    console.log('2. Authenticating new customer via login');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: testUser.email,
        password: testUser.password
    });
    if (!loginRes.data?.accessToken) throw new Error('Login failed: no accessToken');
    const token = loginRes.data.accessToken;
    console.log('   ✅ Customer authenticated, accessToken received');

    console.log('3. Verifying customer profile fetch');
    const meRes = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.data?.user || meRes.data.user.role !== 'CUSTOMER') {
        throw new Error('Profile mismatch');
    }
    console.log(`   ✅ Validated session for real customer: ${meRes.data.user.name} (${meRes.data.user.role})`);
    console.log('🎉 Real Customer Registration & Authentication: PASS');
}

testSignupFlow().catch(err => {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
});
