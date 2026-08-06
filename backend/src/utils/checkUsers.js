import mongoose from 'mongoose';
import { config } from '../config/env.js';
import User from '../models/User.js';

await mongoose.connect(config.MONGODB_URI);
try {
  const users = await User.find({}, { name: 1, email: 1, role: 1, status: 1 });
  console.log('--- ALL USERS IN DB ---');
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await mongoose.disconnect();
}
