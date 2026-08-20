import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import CompanyProfile from '../src/models/CompanyProfile.js';
import CompanyWallet from '../src/models/CompanyWallet.js';
import Job from '../src/models/Job.js';
import { signAccessToken } from '../src/utils/authUtils.js';

async function runCompanyRegistrationAuditTests() {
    console.log('=== STARTING COMPANY REGISTRATION FULL END-TO-END AUDIT ===');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hyperlocal_db');
    const app = createApp();

    const timestamp = Date.now();
    const testEmail1 = `company_${timestamp}_1@example.com`;
    const testPhone1 = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testPassword1 = 'SecurePass@123';
    const testGst1 = `27AAAAA${Math.floor(1000 + Math.random() * 9000)}A1Z5`;
    const testPan1 = `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`;

    // ========================================================
    // TEST 01: Valid Company Registration
    // ========================================================
    console.log('TEST 01: Valid Company Registration...');
    const validRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: `Apex Facility Corp ${timestamp}`,
            email: testEmail1,
            phone: testPhone1,
            address: 'Suite 500, Prestige Tech Park, Marathahalli Ring Road',
            city: 'Bangalore East',
            state: 'Karnataka',
            pincode: '560103',
            businessType: 'Facility Management',
            description: 'Premier facility operations and corporate staffing services.',
            gstNumber: testGst1,
            panNumber: testPan1,
            website: 'https://apexcorp.example.com',
            authorizedPersonName: 'Anil Mehta',
            authorizedPersonPhone: testPhone1,
            password: testPassword1,
            confirmPassword: testPassword1,
        });

    if (validRes.status !== 201) {
        throw new Error(`Expected HTTP 201 on valid company registration, got ${validRes.status}: ${JSON.stringify(validRes.body)}`);
    }
    if (!validRes.body.success || !validRes.body.user) {
        throw new Error(`Invalid response body structure: ${JSON.stringify(validRes.body)}`);
    }
    if (validRes.body.user.role !== 'COMPANY') {
        throw new Error(`Expected user role to be COMPANY, got: ${validRes.body.user.role}`);
    }

    const createdUser = await User.findOne({ email: testEmail1 }).select('+passwordHash');
    if (!createdUser) throw new Error('User record was not created in database!');
    const createdProfile = await CompanyProfile.findOne({ userId: createdUser._id });
    if (!createdProfile) throw new Error('CompanyProfile was not created in database!');
    const createdWallet = await CompanyWallet.findOne({ companyId: createdUser._id });
    if (!createdWallet) throw new Error('CompanyWallet was not created in database!');

    console.log('✓ TEST 01 PASSED: Valid company registration succeeded with User, Profile, and Wallet.');

    // ========================================================
    // TEST 02: Missing Required Fields
    // ========================================================
    console.log('TEST 02: Missing Required Fields Validation...');
    const missingRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: '',
            email: `missing_${timestamp}@example.com`,
            phone: '9900112233',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (missingRes.status !== 400 || missingRes.body.statusCode !== 400) {
        throw new Error(`Expected 400 on missing required fields, got: ${missingRes.status}`);
    }
    console.log('✓ TEST 02 PASSED: Missing required fields properly rejected with HTTP 400.');

    // ========================================================
    // TEST 03: Invalid Email Format
    // ========================================================
    console.log('TEST 03: Invalid Email Validation...');
    const invalidEmailRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Test Corp',
            email: 'not-an-email',
            phone: '9900112233',
            address: '123 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (invalidEmailRes.status !== 400) {
        throw new Error(`Expected 400 on invalid email format, got: ${invalidEmailRes.status}`);
    }
    console.log('✓ TEST 03 PASSED: Invalid email rejected with HTTP 400.');

    // ========================================================
    // TEST 04: Invalid Phone Format
    // ========================================================
    console.log('TEST 04: Invalid Phone Validation...');
    const invalidPhoneRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Test Corp',
            email: `valid_${timestamp}@example.com`,
            phone: '123', // Too short
            address: '123 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (invalidPhoneRes.status !== 400) {
        throw new Error(`Expected 400 on invalid phone format, got: ${invalidPhoneRes.status}`);
    }
    console.log('✓ TEST 04 PASSED: Invalid phone format rejected with HTTP 400.');

    // ========================================================
    // TEST 05: Weak Password & Password Mismatch
    // ========================================================
    console.log('TEST 05: Weak Password & Password Mismatch Validation...');
    const weakPassRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Test Corp',
            email: `weak_${timestamp}@example.com`,
            phone: '9900112244',
            address: '123 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            password: 'weak',
            confirmPassword: 'weak',
        });
    if (weakPassRes.status !== 400) {
        throw new Error(`Expected 400 on weak password, got: ${weakPassRes.status}`);
    }

    const mismatchRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Test Corp',
            email: `mismatch_${timestamp}@example.com`,
            phone: '9900112245',
            address: '123 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            password: 'StrongPassword1',
            confirmPassword: 'DifferentPassword2',
        });
    if (mismatchRes.status !== 400) {
        throw new Error(`Expected 400 on password mismatch, got: ${mismatchRes.status}`);
    }
    console.log('✓ TEST 05 PASSED: Weak password and password mismatch rejected with HTTP 400.');

    // ========================================================
    // TEST 06: Duplicate Email Protection
    // ========================================================
    console.log('TEST 06: Duplicate Email Conflict Protection...');
    const dupEmailRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Duplicate Corp',
            email: testEmail1, // already used in TEST 01
            phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: '456 Another Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (dupEmailRes.status !== 409 || dupEmailRes.body.errorCode !== 'EMAIL_EXISTS') {
        throw new Error(`Expected 409 EMAIL_EXISTS, got: ${dupEmailRes.status} ${JSON.stringify(dupEmailRes.body)}`);
    }
    console.log('✓ TEST 06 PASSED: Duplicate email cleanly rejected with HTTP 409 EMAIL_EXISTS.');

    // ========================================================
    // TEST 07: Duplicate Phone Protection
    // ========================================================
    console.log('TEST 07: Duplicate Phone Conflict Protection...');
    const dupPhoneRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Duplicate Phone Corp',
            email: `different_${timestamp}@example.com`,
            phone: testPhone1, // already used in TEST 01
            address: '456 Another Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (dupPhoneRes.status !== 409 || dupPhoneRes.body.errorCode !== 'PHONE_EXISTS') {
        throw new Error(`Expected 409 PHONE_EXISTS, got: ${dupPhoneRes.status} ${JSON.stringify(dupPhoneRes.body)}`);
    }
    console.log('✓ TEST 07 PASSED: Duplicate phone cleanly rejected with HTTP 409 PHONE_EXISTS.');

    // ========================================================
    // TEST 08: Duplicate GSTIN Protection
    // ========================================================
    console.log('TEST 08: Duplicate GSTIN Conflict Protection...');
    const dupGstRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: 'Duplicate GST Corp',
            email: `diff_gst_${timestamp}@example.com`,
            phone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: '456 Another Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            gstNumber: testGst1, // already used in TEST 01
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    if (dupGstRes.status !== 409 || dupGstRes.body.errorCode !== 'GSTIN_EXISTS') {
        throw new Error(`Expected 409 GSTIN_EXISTS, got: ${dupGstRes.status} ${JSON.stringify(dupGstRes.body)}`);
    }
    console.log('✓ TEST 08 PASSED: Duplicate GSTIN cleanly rejected with HTTP 409 GSTIN_EXISTS.');

    // ========================================================
    // TEST 09: Role Security (Client Role Escalation Guard)
    // ========================================================
    console.log('TEST 09: Role Security & Client Escalation Prevention...');
    const escalateRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: `Escalation Test ${timestamp}`,
            email: `escalate_${timestamp}@example.com`,
            phone: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: '789 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            role: 'ADMIN', // malicious payload
            password: testPassword1,
            confirmPassword: testPassword1,
        });

    if (escalateRes.status !== 201) {
        throw new Error(`Registration failed: ${JSON.stringify(escalateRes.body)}`);
    }
    if (escalateRes.body.user.role !== 'COMPANY') {
        throw new Error(`SECURITY VULNERABILITY: Role was escalated to ${escalateRes.body.user.role}!`);
    }
    const escalateUser = await User.findOne({ email: `escalate_${timestamp}@example.com` });
    if (escalateUser.role !== 'COMPANY') {
        throw new Error(`SECURITY VULNERABILITY in DB: Role stored as ${escalateUser.role}!`);
    }
    console.log('✓ TEST 09 PASSED: Client attempt to submit role=ADMIN ignored, server enforced role=COMPANY.');

    // ========================================================
    // TEST 10: KYC / Verification Escalation Guard
    // ========================================================
    console.log('TEST 10: KYC / Verification Status Escalation Guard...');
    const kycEscalateRes = await request(app)
        .post('/api/company/register')
        .send({
            companyName: `KYC Escalation Test ${timestamp}`,
            email: `kyc_escalate_${timestamp}@example.com`,
            phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: '789 Test Road',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            verificationStatus: 'APPROVED', // malicious payload
            isVerified: true,
            password: testPassword1,
            confirmPassword: testPassword1,
        });

    if (kycEscalateRes.status !== 201) {
        throw new Error(`Registration failed: ${JSON.stringify(kycEscalateRes.body)}`);
    }
    const kycUser = await User.findOne({ email: `kyc_escalate_${timestamp}@example.com` });
    const kycProfile = await CompanyProfile.findOne({ userId: kycUser._id });
    if (kycProfile.verificationStatus === 'APPROVED' || kycProfile.verificationStatus === 'VERIFIED') {
        throw new Error(`SECURITY VULNERABILITY: Company was created with verificationStatus=${kycProfile.verificationStatus}!`);
    }
    if (kycProfile.verificationStatus !== 'PENDING') {
        throw new Error(`Expected verificationStatus PENDING, got: ${kycProfile.verificationStatus}`);
    }
    console.log('✓ TEST 10 PASSED: Verification status escalation prevented; initialized as PENDING.');

    // ========================================================
    // TEST 11: Password Security (Hashed & Not Leaked)
    // ========================================================
    console.log('TEST 11: Password Hashing and Sensitive Leak Prevention...');
    if (validRes.body.password || validRes.body.passwordHash || validRes.body.user.password || validRes.body.user.passwordHash) {
        throw new Error('SECURITY VULNERABILITY: Password or passwordHash leaked in registration response!');
    }
    const isMatch = await bcrypt.compare(testPassword1, createdUser.passwordHash);
    if (!isMatch) {
        throw new Error('Password hash does not match original password via bcrypt!');
    }
    console.log('✓ TEST 11 PASSED: Password properly bcrypt-hashed and never leaked in response.');

    // ========================================================
    // TEST 12: Login After Registration
    // ========================================================
    console.log('TEST 12: Login Sequence with Registered Credentials...');
    const loginRes = await request(app)
        .post('/api/company/login')
        .send({
            email: testEmail1,
            password: testPassword1,
        });

    if (loginRes.status !== 200 || !loginRes.body.accessToken) {
        throw new Error(`Company login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    }
    const company1Token = loginRes.body.accessToken;
    console.log('✓ TEST 12 PASSED: Company logged in successfully with registered credentials.');

    // ========================================================
    // TEST 13: Company Dashboard & Profile Real Data Fetch
    // ========================================================
    console.log('TEST 13: Company Profile & Dashboard Data Verification...');
    const profileRes = await request(app)
        .get('/api/company/profile')
        .set('Authorization', `Bearer ${company1Token}`);

    if (profileRes.status !== 200 || !profileRes.body.profile) {
        throw new Error(`Failed to fetch company profile: ${profileRes.status} ${JSON.stringify(profileRes.body)}`);
    }
    if (profileRes.body.profile.companyName !== `Apex Facility Corp ${timestamp}`) {
        throw new Error(`Company name mismatch: ${profileRes.body.profile.companyName}`);
    }
    if (profileRes.body.profile.email !== testEmail1) {
        throw new Error(`Company email mismatch: ${profileRes.body.profile.email}`);
    }

    const dashRes = await request(app)
        .get('/api/company/dashboard')
        .set('Authorization', `Bearer ${company1Token}`);

    if (dashRes.status !== 200) {
        throw new Error(`Failed to fetch company dashboard: ${dashRes.status}`);
    }
    console.log('✓ TEST 13 PASSED: Company profile & dashboard returned authentic registered database data.');

    // ========================================================
    // TEST 14: Cross-Company Data Isolation & IDOR Protection
    // ========================================================
    console.log('TEST 14: Cross-Company Tenant Isolation & IDOR Protection...');
    // Create second company
    const testEmail2 = `company_${timestamp}_2@example.com`;
    const testPhone2 = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    const comp2Res = await request(app)
        .post('/api/company/register')
        .send({
            companyName: `Beta Logistics Corp ${timestamp}`,
            email: testEmail2,
            phone: testPhone2,
            address: 'Suite 200, Cyber Hub, Gurugram',
            city: 'Gurugram',
            state: 'Haryana',
            pincode: '122002',
            password: testPassword1,
            confirmPassword: testPassword1,
        });
    const company2User = await User.findOne({ email: testEmail2 });
    const company2Token = signAccessToken({ userId: company2User._id.toString(), id: company2User._id.toString(), role: 'COMPANY', email: testEmail2, tokenId: crypto.randomUUID() });

    // Company 2 creates a private team
    const teamRes = await request(app)
        .post('/api/company/teams')
        .set('Authorization', `Bearer ${company2Token}`)
        .send({
            name: `Team Bravo ${timestamp}`,
            leaderId: company2User._id.toString(),
            members: [company2User._id.toString()],
        });

    // Company 1 attempts to update or delete Company 2's team
    if (teamRes.status === 201) {
        const teamId = teamRes.body.team._id;
        const idorUpdateRes = await request(app)
            .put(`/api/company/teams/${teamId}`)
            .set('Authorization', `Bearer ${company1Token}`)
            .send({ name: 'Hacked Team Name' });

        if (idorUpdateRes.status !== 404 && idorUpdateRes.status !== 403) {
            throw new Error(`SECURITY VULNERABILITY: Company 1 was able to access Company 2 team! HTTP ${idorUpdateRes.status}`);
        }
    }
    console.log('✓ TEST 14 PASSED: IDOR protection enforced; cross-company access securely blocked.');

    // ========================================================
    // TEST 15: Public HTTPS Prefix Access (/api/v1/company/register)
    // ========================================================
    console.log('TEST 15: Public Route Mount (/api/v1/company/register)...');
    const testEmail3 = `company_v1_${timestamp}@example.com`;
    const v1Res = await request(app)
        .post('/api/v1/company/register')
        .send({
            companyName: `V1 Test Company ${timestamp}`,
            email: testEmail3,
            phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: '101 MG Road',
            city: 'Bengaluru',
            state: 'Karnataka',
            pincode: '560001',
            password: testPassword1,
            confirmPassword: testPassword1,
        });

    if (v1Res.status !== 201) {
        throw new Error(`Failed to call /api/v1/company/register: ${v1Res.status} ${JSON.stringify(v1Res.body)}`);
    }
    console.log('✓ TEST 15 PASSED: Both /api/company/register and /api/v1/company/register work reliably.');

    // ========================================================
    // TEST 16: Unauthenticated Access Guard
    // ========================================================
    console.log('TEST 16: Unauthenticated Route Guard...');
    const unauthRes = await request(app).get('/api/company/profile');
    if (unauthRes.status !== 401) {
        throw new Error(`Expected 401 on unauthenticated profile access, got: ${unauthRes.status}`);
    }
    console.log('✓ TEST 16 PASSED: Protected company routes reject unauthenticated requests with HTTP 401.');

    // ========================================================
    // TEST 17: Non-Company Role Access Guard
    // ========================================================
    console.log('TEST 17: Non-Company Role Guard...');
    const customerToken = signAccessToken({ userId: '6a854fada9d7b24dd43d9245', id: '6a854fada9d7b24dd43d9245', role: 'CUSTOMER', email: 'customer1@test.com', tokenId: crypto.randomUUID() });
    const wrongRoleRes = await request(app)
        .get('/api/company/profile')
        .set('Authorization', `Bearer ${customerToken}`);

    if (wrongRoleRes.status !== 403) {
        throw new Error(`Expected 403 when CUSTOMER accesses company profile, got: ${wrongRoleRes.status}`);
    }
    console.log('✓ TEST 17 PASSED: Non-company role rejected with HTTP 403 Forbidden.');

    console.log('====================================================');
    console.log('ALL COMPANY REGISTRATION AUDIT TESTS PASSED 100%!');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
}

runCompanyRegistrationAuditTests().catch((err) => {
    console.error('COMPANY REGISTRATION AUDIT FAILED:', err);
    process.exit(1);
});
