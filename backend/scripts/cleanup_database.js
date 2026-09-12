import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function cleanupDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB:', mongoose.connection.name);

    const db = mongoose.connection.db;

    // 1. Identify users to KEEP (Harsh & Ayush profiles)
    const usersCollection = db.collection('users');
    const allUsers = await usersCollection.find({}).toArray();

    const preserveFilter = (u) => {
      const email = (u.email || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      return (
        email.includes('harsh') ||
        name.includes('harsh') ||
        email.includes('ayush') ||
        name.includes('ayush')
      );
    };

    const preservedUsers = allUsers.filter(preserveFilter);
    const deleteUsers = allUsers.filter(u => !preserveFilter(u));

    console.log('\n--- PRESERVED USERS (Harsh & Ayush) ---');
    preservedUsers.forEach(u => {
      console.log(`[PRESERVED] ID: ${u._id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
    });

    console.log(`\nPreserving ${preservedUsers.length} user(s). Deleting ${deleteUsers.length} test user(s).`);

    const preservedUserIds = preservedUsers.map(u => u._id);
    const preservedUserIdStrings = preservedUsers.map(u => u._id.toString());
    const deletedUserIds = deleteUsers.map(u => u._id);

    // Delete non-preserved users
    if (deletedUserIds.length > 0) {
      const delUserResult = await usersCollection.deleteMany({ _id: { $in: deletedUserIds } });
      console.log(`Deleted ${delUserResult.deletedCount} test users from 'users' collection.`);
    }

    // 2. Clear transactional and test collections:
    const collectionsToClear = [
      'bookings',
      'bookinglocations',
      'paymentorders',
      'paymenttransactions',
      'refunds',
      'disputecases',
      'disputeevidences',
      'workerearnings',
      'workerpayouts',
      'walletledgers',
      'ledgertransactions',
      'ledgerentries',
      'notifications',
      'notificationoutboxes',
      'pricequotes',
      'supporttickets',
      'supportticketmessages',
      'reviews',
      'reviewreports',
      'auditlogs',
      'refreshtokens',
      'conversations',
      'messages',
      'chatattachments',
      'conversationparticipantstates',
      'oauthattempts',
      'oauthidentities',
      'jobapplications',
      'companyteams',
      'workerassignments'
    ];

    console.log('\n--- CLEARING TRANSACTION & HISTORY DATA ---');
    for (const colName of collectionsToClear) {
      try {
        const col = db.collection(colName);
        const countBefore = await col.countDocuments();
        if (countBefore > 0) {
          const res = await col.deleteMany({});
          console.log(`Cleared collection [${colName}]: Deleted ${res.deletedCount} documents.`);
        } else {
          console.log(`Collection [${colName}] is already empty.`);
        }
      } catch (err) {
        console.warn(`Could not clear ${colName}:`, err.message);
      }
    }

    // 3. Clean up WorkerProfiles, CompanyProfiles, WorkerWallets, CompanyWallets for deleted users
    const userRelatedCollections = [
      { name: 'workerprofiles', userKey: 'user' },
      { name: 'companyprofiles', userKey: 'user' },
      { name: 'workerwallets', userKey: 'worker' },
      { name: 'companywallets', userKey: 'company' },
      { name: 'workerpayoutaccounts', userKey: 'worker' },
      { name: 'verificationsubmissions', userKey: 'user' },
      { name: 'verificationdocuments', userKey: 'user' },
      { name: 'ledgeraccounts', userKey: 'owner' }
    ];

    for (const item of userRelatedCollections) {
      try {
        const col = db.collection(item.name);
        const res = await col.deleteMany({
          $and: [
            { [item.userKey]: { $nin: [...preservedUserIds, ...preservedUserIdStrings] } },
            { [item.userKey]: { $exists: true } }
          ]
        });
        console.log(`Cleaned orphaned records from [${item.name}]: Deleted ${res.deletedCount}`);
      } catch (err) {
        console.warn(`Error cleaning ${item.name}:`, err.message);
      }
    }

    // 4. Verify system summary
    console.log('\n--- VERIFICATION SUMMARY ---');
    const remainingUsers = await usersCollection.find({}).toArray();
    console.log(`Total remaining users in DB: ${remainingUsers.length}`);
    remainingUsers.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.role}]`));

    const remainingBookings = await db.collection('bookings').countDocuments();
    const remainingPayments = await db.collection('paymenttransactions').countDocuments();
    const serviceCategories = await db.collection('servicecategories').countDocuments();

    console.log(`Remaining Bookings: ${remainingBookings}`);
    console.log(`Remaining Payment Transactions: ${remainingPayments}`);
    console.log(`Service Categories (Master data intact): ${serviceCategories}`);

    console.log('\nDatabase cleanup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Database cleanup failed:', err);
    process.exit(1);
  }
}

cleanupDatabase();
