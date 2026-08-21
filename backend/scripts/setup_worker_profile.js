import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/hyperlocal?appName=Cluster0';

async function checkWorker() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB: hyperlocal');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const WorkerProfile = mongoose.model('WorkerProfile', new mongoose.Schema({}, { strict: false }));
  const ServiceCategory = mongoose.model('ServiceCategory', new mongoose.Schema({}, { strict: false }));

  const categories = await ServiceCategory.find();
  console.log('Service Categories count:', categories.length);

  const workerUser = await User.findOne({ email: 'worker@jobnest.com' });
  console.log('Worker User:', workerUser ? { id: workerUser._id, name: workerUser.name, role: workerUser.role, status: workerUser.status } : 'NOT FOUND');

  if (workerUser) {
    let profile = await WorkerProfile.findOne({ userId: workerUser._id });
    console.log('WorkerProfile before:', profile ? {
      id: profile._id,
      verificationStatus: profile.verificationStatus,
      isPubliclyVisible: profile.isPubliclyVisible
    } : 'NOT FOUND');

    if (!profile) {
      profile = new WorkerProfile({
        userId: workerUser._id,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        verificationBadge: true,
        hourlyRate: 350,
        yearsOfExperience: 4,
        bio: 'Certified Home & Appliance Repair Specialist with 4+ years experience.',
        skills: ['Plumbing', 'Electrical', 'Appliance Repair'],
        serviceCategoryIds: categories.map(c => c._id),
        averageRating: 4.9,
        ratingCount: 18
      });
      await profile.save();
      console.log('Created and approved WorkerProfile for worker@jobnest.com');
    } else {
      profile.verificationStatus = 'APPROVED';
      profile.isPubliclyVisible = true;
      profile.verificationBadge = true;
      if (!profile.serviceCategoryIds || profile.serviceCategoryIds.length === 0) {
        profile.serviceCategoryIds = categories.map(c => c._id);
      }
      if (!profile.hourlyRate) profile.hourlyRate = 350;
      if (!profile.bio) profile.bio = 'Certified Home & Appliance Repair Specialist with 4+ years experience.';
      await profile.save();
      console.log('Updated WorkerProfile for worker@jobnest.com to APPROVED & Publicly Visible');
    }
  }

  // Also check if there are other workers in DB and list them
  const allProfiles = await WorkerProfile.find().populate('userId');
  console.log(`Total WorkerProfiles in DB: ${allProfiles.length}`);
  for (const p of allProfiles) {
    console.log(`- Worker: ${p.userId?.name} (${p.userId?.email}) -> status: ${p.verificationStatus}, visible: ${p.isPubliclyVisible}`);
    if (p.verificationStatus !== 'APPROVED' || !p.isPubliclyVisible) {
      p.verificationStatus = 'APPROVED';
      p.isPubliclyVisible = true;
      p.verificationBadge = true;
      if (!p.serviceCategoryIds || p.serviceCategoryIds.length === 0) {
        p.serviceCategoryIds = categories.map(c => c._id);
      }
      await p.save();
      console.log(`  -> Activated worker ${p.userId?.name}`);
    }
  }

  await mongoose.disconnect();
}

checkWorker().catch(console.error);
