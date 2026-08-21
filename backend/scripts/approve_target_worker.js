import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/hyperlocal?appName=Cluster0';

async function approveTargetWorker() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const usersCol = db.collection('users');
  const profilesCol = db.collection('workerprofiles');
  const categoriesCol = db.collection('servicecategories');

  const categories = await categoriesCol.find().toArray();
  const categoryIds = categories.map(c => c._id);

  const targetId = new mongoose.Types.ObjectId('6a79fa8eae59211930f36045');

  // Update user
  await usersCol.updateMany(
    { email: 'worker@test.com' },
    {
      $set: {
        verificationStatus: 'APPROVED',
        kycStatus: 'APPROVED',
        status: 'ACTIVE',
        isKycVerified: true,
        updatedAt: new Date()
      }
    }
  );

  // Update/upsert WorkerProfile
  await profilesCol.updateMany(
    { $or: [{ userId: targetId }, { userId: '6a79fa8eae59211930f36045' }] },
    {
      $set: {
        userId: targetId,
        verificationStatus: 'APPROVED',
        isPubliclyVisible: true,
        isOnline: true,
        verificationBadge: true,
        serviceCategoryIds: categoryIds,
        hourlyRate: 350,
        yearsOfExperience: 5,
        bio: 'Verified Professional Worker on JobNest',
        skills: ['Plumbing', 'Electrical', 'Cleaning'],
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );

  console.log('Successfully set target worker 6a79fa8eae59211930f36045 to APPROVED & VISIBLE in Atlas!');
  await mongoose.disconnect();
}

approveTargetWorker().catch(console.error);
