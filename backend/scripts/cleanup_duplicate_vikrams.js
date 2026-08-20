import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

async function cleanupDuplicateVikrams() {
    console.log('=== CLEANING UP DUPLICATE VIKRAM WORKERS ===');
    const uri = process.env.MONGODB_URI;

    for (const dbName of ['test', 'hyperlocal']) {
        console.log(`\nConnecting to database: ${dbName}...`);
        const conn = await mongoose.createConnection(uri, { dbName }).asPromise();
        const User = conn.model('User', new mongoose.Schema({}, { strict: false }));
        const WorkerProfile = conn.model('WorkerProfile', new mongoose.Schema({}, { strict: false }));
        const ServiceCategory = conn.model('ServiceCategory', new mongoose.Schema({}, { strict: false }));
        const VerificationDocument = conn.model('VerificationDocument', new mongoose.Schema({}, { strict: false }));

        const categories = await ServiceCategory.find();
        const catIds = categories.map(c => c._id);

        // Find all duplicate Vikram workers or e2e generated worker accounts
        const duplicateUsers = await User.find({
            $or: [
                { name: { $regex: 'vikram', $options: 'i' } },
                { email: { $regex: 'worker_e2e', $options: 'i' } }
            ]
        });

        console.log(`Found ${duplicateUsers.length} Vikram / e2e worker accounts in ${dbName}`);
        
        for (const u of duplicateUsers) {
            console.log(` - Deleting duplicate user: ${u.name} (${u.email}) [ID: ${u._id}]`);
            await WorkerProfile.deleteMany({ userId: u._id });
            await VerificationDocument.deleteMany({ workerId: u._id });
            await User.deleteOne({ _id: u._id });
        }

        // Now create exactly ONE clean, single Vikram Mehta account
        const singleEmail = 'vikram.mehta@jobnest.com';
        const singlePhone = '9811002233';
        const passwordHash = await bcrypt.hash('Worker@12345', 10);

        let singleUser = await User.findOne({ email: singleEmail });
        if (!singleUser) {
            singleUser = new User({
                name: 'Vikram Mehta',
                email: singleEmail,
                phone: singlePhone,
                passwordHash,
                authenticationMethods: ['PASSWORD'],
                primaryAuthenticationMethod: 'PASSWORD',
                role: 'WORKER',
                status: 'ACTIVE',
                emailVerified: true,
                phoneVerified: true,
                profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            });
            await singleUser.save();
            console.log(`  ✅ Created single clean Vikram Mehta user (${singleEmail}) in ${dbName}`);
        } else {
            singleUser.name = 'Vikram Mehta';
            singleUser.phone = singlePhone;
            singleUser.passwordHash = passwordHash;
            singleUser.role = 'WORKER';
            singleUser.status = 'ACTIVE';
            singleUser.emailVerified = true;
            singleUser.phoneVerified = true;
            await singleUser.save();
            console.log(`  ✅ Updated single clean Vikram Mehta user (${singleEmail}) in ${dbName}`);
        }

        let profile = await WorkerProfile.findOne({ userId: singleUser._id });
        const profileData = {
            userId: singleUser._id,
            fullName: 'Vikram Mehta',
            phone: singlePhone,
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560001',
            country: 'India',
            address: 'MG Road, Central Bengaluru',
            bio: 'Senior Certified Technician & Multi-Service Professional with 7+ years on-site experience.',
            yearsOfExperience: 7,
            primaryServiceCategoryId: catIds[0] || null,
            serviceCategoryIds: catIds,
            serviceIds: catIds,
            skills: ['Electrical Repairs', 'Plumbing', 'Appliance Installation', 'AC Service'],
            languages: ['English', 'Hindi', 'Kannada'],
            hourlyRate: 450,
            dailyRate: 3500,
            averageRating: 4.96,
            ratingCount: 54,
            completedBookings: 86,
            verificationStatus: 'APPROVED',
            verificationBadge: true,
            isPubliclyVisible: true,
            onboardingProgressPercent: 100,
            approvedAt: new Date(),
        };

        if (!profile) {
            profile = new WorkerProfile(profileData);
            await profile.save();
        } else {
            Object.assign(profile, profileData);
            await profile.save();
        }

        await VerificationDocument.deleteMany({ workerId: singleUser._id });
        await VerificationDocument.create([
            {
                workerId: singleUser._id,
                documentType: 'AADHAAR',
                documentNumberEncrypted: 'ENC_AADHAAR',
                documentNumberLast4: '9988',
                verificationStatus: 'APPROVED',
                frontFile: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
                fileMimeType: 'image/jpeg',
                fileSize: 102400,
                isCurrent: true,
            },
            {
                workerId: singleUser._id,
                documentType: 'PAN',
                documentNumberEncrypted: 'ENC_PAN',
                documentNumberLast4: '7766',
                verificationStatus: 'APPROVED',
                frontFile: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f',
                fileMimeType: 'image/jpeg',
                fileSize: 102400,
                isCurrent: true,
            }
        ]);

        console.log(`  ✅ Exactly ONE Vikram Mehta worker profile approved in ${dbName}`);
        await conn.close();
    }

    console.log('\n=== VIKRAM MEHTA CLEANUP COMPLETED ===');
    console.log('Single Vikram Account: vikram.mehta@jobnest.com (Pass: Worker@12345)');
}

cleanupDuplicateVikrams().catch(console.error);
