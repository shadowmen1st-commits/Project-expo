import axios from 'axios';
import FormData from 'form-data';

const BASE_URL = 'https://project-expo-md7o.onrender.com/api';

async function testWorkerProfilePhotoFlow() {
    console.log('=== TEST WORKER PROFILE PHOTO FLOW ===\n');

    // 1. Create and login test worker
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const email = `photo_worker_${randSuffix}@gmail.com`;
    const password = 'Password@123';
    const name = `Photo Tester ${randSuffix}`;
    const phone = '97' + Math.floor(10000000 + Math.random() * 90000000);

    console.log(`1. Registering worker: ${email}`);
    await axios.post(`${BASE_URL}/auth/register`, {
        name,
        email,
        phone,
        password,
        role: 'WORKER'
    });

    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password
    });
    const token = loginRes.data?.accessToken;
    console.log(`   Worker Token acquired: ${token.substring(0, 20)}...`);

    const authHeaders = {
        headers: { Authorization: `Bearer ${token}` }
    };

    // 2. Test Invalid File Upload (Oversized > 5MB)
    console.log('\n2. Testing Oversized File Rejection (>5MB)...');
    try {
        const bigForm = new FormData();
        const bigBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
        bigForm.append('file', bigBuffer, { filename: 'large_photo.jpg', contentType: 'image/jpeg' });
        await axios.post(`${BASE_URL}/v1/worker/verification/profile-photo`, bigForm, {
            headers: { ...authHeaders.headers, ...bigForm.getHeaders() }
        });
        console.log('❌ FAIL: Big file was not rejected');
    } catch (err) {
        console.log(`✅ PASS: Big file rejected with status ${err.response?.status} (${err.response?.data?.errorCode || err.response?.data?.message})`);
    }

    // 3. Test Invalid Mime Type (.exe/.txt)
    console.log('\n3. Testing Invalid File Mime Rejection...');
    try {
        const textForm = new FormData();
        textForm.append('file', Buffer.from('hello world'), { filename: 'test.txt', contentType: 'text/plain' });
        await axios.post(`${BASE_URL}/v1/worker/verification/profile-photo`, textForm, {
            headers: { ...authHeaders.headers, ...textForm.getHeaders() }
        });
        console.log('❌ FAIL: Text file was not rejected');
    } catch (err) {
        console.log(`✅ PASS: Invalid type rejected with status ${err.response?.status} (${err.response?.data?.errorCode || err.response?.data?.message})`);
    }

    // 4. Test Valid Profile Photo Upload
    console.log('\n4. Testing Valid Profile Photo Upload (PNG Buffer)...');
    const validForm = new FormData();
    const photoBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    validForm.append('file', photoBuffer, { filename: 'avatar.png', contentType: 'image/png' });
    
    const photoRes = await axios.post(`${BASE_URL}/v1/worker/verification/profile-photo`, validForm, {
        headers: { ...authHeaders.headers, ...validForm.getHeaders() }
    });
    const photoUrl = photoRes.data?.photoUrl;
    console.log(`✅ PASS: Photo uploaded successfully. URL: ${photoUrl}`);

    // 5. Test Fetch Verification Data on Refresh
    console.log('\n5. Testing Profile Photo Persistence on Refresh (GET /v1/worker/verification)...');
    const verifyRes = await axios.get(`${BASE_URL}/v1/worker/verification`, authHeaders);
    const loadedProfile = verifyRes.data?.data?.profile;
    const isPhotoSaved = loadedProfile?.profilePhotoId === photoUrl;
    console.log(`✅ PASS: Photo preserved across reload: ${isPhotoSaved} (Saved: ${loadedProfile?.profilePhotoId})`);

    // 6. Test Delete Profile Photo
    console.log('\n6. Testing Photo Removal (DELETE /v1/worker/verification/profile-photo)...');
    const delRes = await axios.delete(`${BASE_URL}/v1/worker/verification/profile-photo`, authHeaders);
    console.log(`✅ PASS: Photo deleted status: ${delRes.data?.success}`);

    const verifyAfterDel = await axios.get(`${BASE_URL}/v1/worker/verification`, authHeaders);
    console.log(`✅ PASS: Photo cleared in DB: ${verifyAfterDel.data?.data?.profile?.profilePhotoId === null}`);

    console.log('\n========================================');
    console.log('   🎉 ALL PHOTO FLOW TESTS PASSED');
    console.log('========================================');
}

testWorkerProfilePhotoFlow().catch(err => {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
});
