import mongoose from 'mongoose';
import User from '../src/models/User.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import ServiceCategory from '../src/models/ServiceCategory.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/hyperlocal?appName=Cluster0';

async function fixWorkerMongoose() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected via Mongoose');

  const categories = await ServiceCategory.find();
  const categoryIds = categories.map(c => c._id);

  const worker = await User.findOne({ email: 'worker@test.com' });
  console.log('Worker User:', worker ? { id: worker._id, email: worker.email, role: worker.role } : 'NOT FOUND');

  if (worker) {
    let profile = await WorkerProfile.findOne({ userId: worker._id });
    console.log('Profile before:', profile ? { id: profile._id, status: profile.verificationStatus, visible: profile.isPubliclyVisible } : 'NOT FOUND');

    if (!profile) {
      profile = new WorkerProfile({
        userId: worker._id,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        verificationBadge: true,
        serviceCategoryIds: categoryIds,
        hourlyRate: 350,
        bio: 'Verified Test Worker',
        skills: ['Plumbing', 'Electrical'],
        experienceYears: 5,
        languages: ['English', 'Hindi'],
        dailyRate: 2500,
        minimumBookingDuration: 1,
        serviceRadiusKm: 50,
        latitude: 28.6139,
        longitude: 77.209,
        dob: '1995-01-01'
      });
      await profile.save();
    } else {
      profile.verificationStatus = 'APPROVED';
      profile.isPubliclyVisible = true;
      profile.verificationBadge = true;
      profile.serviceCategoryIds = categoryIds;
      await profile.save();
    }

    worker.verificationStatus = 'APPROVED';
    await worker.save();

    console.log('Worker updated via Mongoose:', {
      userVerification: worker.verificationStatus,
      profileVerification: profile.verificationStatus,
      isPubliclyVisible: profile.isPubliclyVisible
    });
  }

  await mongoose.disconnect();
}

fixWorkerMongoose().catch(console.error);
