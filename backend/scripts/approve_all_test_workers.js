import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/hyperlocal?appName=Cluster0';

async function approveAllWorkers() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB Atlas');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');
  const profilesCol = db.collection('workerprofiles');
  const categoriesCol = db.collection('servicecategories');

  const categories = await categoriesCol.find().toArray();
  const categoryIds = categories.map(c => c._id);
  console.log(`Found ${categories.length} categories.`);

  const workers = await usersCol.find({ role: 'WORKER' }).toArray();
  console.log(`Found ${workers.length} worker users in database.`);

  for (const worker of workers) {
    console.log(`Processing worker: ${worker.name} (${worker.email}, ID: ${worker._id})`);
    
    await profilesCol.updateOne(
      { userId: worker._id },
      {
        $set: {
          userId: worker._id,
          verificationStatus: 'APPROVED',
          isPubliclyVisible: true,
          isOnline: true,
          verificationBadge: true,
          serviceCategoryIds: categoryIds,
          hourlyRate: 350,
          yearsOfExperience: 5,
          bio: 'Verified Professional Service Provider on JobNest.',
          skills: ['Plumbing', 'Electrical', 'Cleaning', 'Repairs'],
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
    console.log(`  -> WorkerProfile APPROVED & Publicly Visible for ${worker.email}`);
  }

  console.log('All workers successfully approved in MongoDB Atlas!');
  await mongoose.disconnect();
}

approveAllWorkers().catch(console.error);
