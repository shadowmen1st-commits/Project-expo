import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function createFullKycWorker() {
    console.log('--- CREATING FULL KYC APPROVED WORKER ---');
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'hyperlocal';

    await mongoose.connect(uri, { dbName });
    console.log(`Connected to MongoDB Atlas database: ${mongoose.connection.name}`);

    const User = mongoose.model('User', new mongoose.Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: { type: String },
        passwordHash: { type: String },
        authenticationMethods: [{ type: String }],
        primaryAuthenticationMethod: { type: String, default: 'PASSWORD' },
        role: { type: String, default: 'WORKER' },
        status: { type: String, default: 'ACTIVE' },
        emailVerified: { type: Boolean, default: true },
        phoneVerified: { type: Boolean, default: true },
        profileImage: { type: String },
        failedLoginAttempts: { type: Number, default: 0 },
    }, { timestamps: true, strict: false }));

    const WorkerProfile = mongoose.model('WorkerProfile', new mongoose.Schema({}, { strict: false }));
    const ServiceCategory = mongoose.model('ServiceCategory', new mongoose.Schema({}, { strict: false }));
    const VerificationDocument = mongoose.model('VerificationDocument', new mongoose.Schema({}, { strict: false }));
    const WorkerWallet = mongoose.model('WorkerWallet', new mongoose.Schema({}, { strict: false }));

    const categories = await ServiceCategory.find();
    console.log(`Found ${categories.length} service categories.`);

    const workerEmail = 'pro.worker@jobnest.com';
    const workerPass = 'Worker@12345';
    const workerPhone = '9988776655';
    const workerName = 'Ramesh Kumar';

    const passwordHash = await bcrypt.hash(workerPass, 10);

    // 1. User Record
    let user = await User.findOne({ email: workerEmail });
    if (!user) {
        user = new User({
            name: workerName,
            email: workerEmail,
            phone: workerPhone,
            passwordHash,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            profileImage: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400',
        });
        await user.save();
        console.log(`✅ Created User: ${workerEmail}`);
    } else {
        user.name = workerName;
        user.passwordHash = passwordHash;
        user.role = 'WORKER';
        user.status = 'ACTIVE';
        user.emailVerified = true;
        user.phoneVerified = true;
        await user.save();
        console.log(`✅ Updated existing User: ${workerEmail}`);
    }

    // 2. WorkerProfile Record with FULL APPROVED KYC
    let profile = await WorkerProfile.findOne({ userId: user._id });
    const categoryIds = categories.map(c => c._id);

    const profileData = {
        userId: user._id,
        fullName: workerName,
        phone: workerPhone,
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
        address: 'Connaught Place, Central Delhi',
        bio: 'Certified Expert Professional with 6+ years experience in multi-home repair, plumbing, and electrical installations.',
        yearsOfExperience: 6,
        primaryServiceCategoryId: categoryIds[0] || null,
        serviceCategoryIds: categoryIds,
        serviceIds: categoryIds,
        skills: ['Plumbing', 'Electrical Repairs', 'Appliance Installation', 'Deep Cleaning', 'Carpentry'],
        languages: ['Hindi', 'English'],
        hourlyRate: 400,
        dailyRate: 3200,
        serviceRadiusKm: 25,
        workRadiusKm: 25,
        averageRating: 4.95,
        ratingCount: 42,
        completedBookings: 58,
        verificationStatus: 'APPROVED',
        verificationBadge: true,
        isPubliclyVisible: true,
        onboardingProgressPercent: 100,
        approvedAt: new Date(),
        submittedAt: new Date(),
        availability: [
            { day: 0, start: '08:00', end: '20:00', isWorking: true },
            { day: 1, start: '08:00', end: '20:00', isWorking: true },
            { day: 2, start: '08:00', end: '20:00', isWorking: true },
            { day: 3, start: '08:00', end: '20:00', isWorking: true },
            { day: 4, start: '08:00', end: '20:00', isWorking: true },
            { day: 5, start: '08:00', end: '20:00', isWorking: true },
            { day: 6, start: '08:00', end: '20:00', isWorking: true },
        ]
    };

    if (!profile) {
        profile = new WorkerProfile(profileData);
        await profile.save();
        console.log('✅ Created APPROVED WorkerProfile');
    } else {
        Object.assign(profile, profileData);
        await profile.save();
        console.log('✅ Updated WorkerProfile to APPROVED & 100% KYC Complete');
    }

    // 3. Verification Documents (Aadhaar & PAN)
    await VerificationDocument.deleteMany({ workerId: user._id });
    
    await VerificationDocument.create([
        {
            workerId: user._id,
            documentType: 'AADHAAR',
            documentNumberEncrypted: 'ENC_AADHAAR_XXXX',
            documentNumberLast4: '5678',
            frontFile: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
            fileMimeType: 'image/jpeg',
            fileSize: 102400,
            verificationStatus: 'APPROVED',
            reviewedAt: new Date(),
            isCurrent: true,
        },
        {
            workerId: user._id,
            documentType: 'PAN',
            documentNumberEncrypted: 'ENC_PAN_XXXX',
            documentNumberLast4: '9012',
            frontFile: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
            fileMimeType: 'image/jpeg',
            fileSize: 102400,
            verificationStatus: 'APPROVED',
            reviewedAt: new Date(),
            isCurrent: true,
        }
    ]);
    console.log('✅ Created APPROVED Aadhaar & PAN KYC Documents');

    // 4. Worker Wallet
    let wallet = await WorkerWallet.findOne({ workerId: user._id });
    if (!wallet) {
        wallet = new WorkerWallet({
            workerId: user._id,
            availableBalance: 250000, // ₹2,500 in paise
            pendingBalance: 0,
            currency: 'INR',
        });
        await wallet.save();
        console.log('✅ Created Worker Wallet with ₹2,500 balance');
    }

    await mongoose.disconnect();
    console.log('--- WORKER CREATION COMPLETED SUCCESSFULLY ---');
    console.log(`Email:    ${workerEmail}`);
    console.log(`Password: ${workerPass}`);
    console.log(`Role:     WORKER`);
    console.log(`KYC:      APPROVED (100% Verified)`);
}

createFullKycWorker().catch(console.error);
