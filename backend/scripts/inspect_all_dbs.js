import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://shadowmen1st_db_user:HyperLocal%402026%23Db@cluster0.lvbyzay.mongodb.net/hyperlocal?appName=Cluster0';

async function inspectAllDbs() {
  const client = await mongoose.connect(MONGODB_URI);
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('Databases in cluster:', dbs.databases.map(d => d.name));

  for (const dbInfo of dbs.databases) {
    if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
    const currentDb = client.connection.useDb(dbInfo.name);
    const usersCount = await currentDb.collection('users').countDocuments();
    const profilesCount = await currentDb.collection('workerprofiles').countDocuments();
    console.log(`DB "${dbInfo.name}": ${usersCount} users, ${profilesCount} worker profiles`);

    const workerUser = await currentDb.collection('users').findOne({ email: 'worker@test.com' });
    if (workerUser) {
      console.log(`  -> In DB "${dbInfo.name}", worker@test.com is: ID=${workerUser._id}, status=${workerUser.status}, verification=${workerUser.verificationStatus}`);
      const profile = await currentDb.collection('workerprofiles').findOne({ userId: workerUser._id });
      console.log(`  -> In DB "${dbInfo.name}", profile:`, profile ? { id: profile._id, status: profile.verificationStatus, visible: profile.isPubliclyVisible } : 'NOT FOUND');
    }
  }

  await mongoose.disconnect();
}

inspectAllDbs().catch(console.error);
