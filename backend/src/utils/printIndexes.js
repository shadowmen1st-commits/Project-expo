import mongoose from 'mongoose';
import { config } from '../config/env.js';

await mongoose.connect(config.MONGODB_URI);
try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    const collection = db.collection('verificationdocuments');
    const indexes = await collection.indexes();
    console.log('Indexes on verificationdocuments:');
    console.log(JSON.stringify(indexes, null, 2));
} catch (err) {
    console.error(err);
} finally {
    await mongoose.disconnect();
}
