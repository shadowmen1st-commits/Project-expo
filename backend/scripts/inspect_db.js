import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/hyperlocal_marketplace');
  const workers = await mongoose.connection.db.collection('workerprofiles').find({}).toArray();
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  const categories = await mongoose.connection.db.collection('servicecategories').find({}).toArray();

  console.log('=== WORKERS ===');
  console.log(workers.map(w => ({
    _id: w._id.toString(),
    userId: w.userId?.toString(),
    verificationStatus: w.verificationStatus,
    isPubliclyVisible: w.isPubliclyVisible,
    services: w.serviceCategoryIds,
    hourlyRate: w.hourlyRate
  })));

  console.log('=== USERS ===');
  console.log(users.map(u => ({
    _id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role
  })));

  console.log('=== CATEGORIES ===');
  console.log(categories.map(c => ({
    _id: c._id.toString(),
    name: c.name,
    slug: c.slug
  })));

  await mongoose.disconnect();
}

run();
