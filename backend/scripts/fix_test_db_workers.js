import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/test?appName=Cluster0';

async function fixTestDb() {
  const client = await mongoose.connect(MONGODB_URI);
  const testDb = client.connection.useDb('test');

  const categories = await testDb.collection('servicecategories').find().toArray();
  const categoryIds = categories.map(c => c._id);
  console.log(`Found ${categories.length} categories in DB "test"`);

  // 1. Approve all workers in DB "test"
  const workers = await testDb.collection('users').find({ role: 'WORKER' }).toArray();
  console.log(`Found ${workers.length} workers in DB "test"`);

  for (const w of workers) {
    await testDb.collection('users').updateOne(
      { _id: w._id },
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

    await testDb.collection('workerprofiles').updateOne(
      { userId: w._id },
      {
        $set: {
          userId: w._id,
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
        },
        $setOnInsert: {
          createdAt: new Date(),
          averageRating: 5.0,
          ratingCount: 10
        }
      },
      { upsert: true }
    );
    console.log(`  -> Worker APPROVED: ${w.name} (${w.email}, ID: ${w._id})`);
  }

  console.log('Successfully updated all workers in DB "test" to APPROVED & VISIBLE!');
  await mongoose.disconnect();
}

fixTestDb().catch(console.error);
