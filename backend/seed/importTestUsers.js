/**
 * importTestUsers.js  
 * Direct Atlas insert — no DNS dependency from mongoimport
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try multiple relative paths to find .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.MONGODB_URI) dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

const TEST_USERS = [
    { name: 'admin',   email: 'admin2@test.com',  password: 'Admin@12345',   phone: '7839213344', role: 'ADMIN' },
    { name: 'user',    email: 'user@test.com',     password: 'User@12345',    phone: '7839213345', role: 'CUSTOMER' },
    { name: 'worker',  email: 'worker@test.com',   password: 'Worker@12345',  phone: '7839213346', role: 'WORKER' },
    { name: 'company', email: 'company@test.com',  password: 'Company@12345', phone: '7839213347', role: 'COMPANY' },
];

(async () => {
    try {
        console.log('\nConnecting to Atlas...');
        console.log(`URI: ${MONGODB_URI.replace(/:([^@]+)@/, ':***@')}\n`);
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection;
        console.log(`Connected! db=${db.name} | host=${db.host}\n`);

        const col = db.collection('users');

        let inserted = 0, updated = 0;
        const seeded = [];

        for (const u of TEST_USERS) {
            const passwordHash = await bcrypt.hash(u.password, 10);
            const now = new Date();

            const existing = await col.findOne({ email: u.email });
            if (existing) {
                await col.updateOne(
                    { email: u.email },
                    {
                        $set: {
                            name: u.name,
                            phone: u.phone,
                            passwordHash,
                            role: u.role,
                            status: 'ACTIVE',
                            emailVerified: false,
                            phoneVerified: false,
                            primaryAuthenticationMethod: 'PASSWORD',
                            authenticationMethods: ['PASSWORD'],
                            preferredLanguage: 'en',
                            failedLoginAttempts: 0,
                            lockedUntil: null,
                            updatedAt: now,
                        }
                    }
                );
                updated++;
                seeded.push({ ...existing, name: u.name, role: u.role });
                console.log(`[UPDATED] ${u.email} (role=${u.role})`);
            } else {
                const doc = {
                    _id: new mongoose.Types.ObjectId(),
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    passwordHash,
                    authenticationMethods: ['PASSWORD'],
                    primaryAuthenticationMethod: 'PASSWORD',
                    role: u.role,
                    status: 'ACTIVE',
                    emailVerified: false,
                    phoneVerified: false,
                    preferredLanguage: 'en',
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                    createdAt: now,
                    updatedAt: now,
                    __v: 0,
                };
                await col.insertOne(doc);
                inserted++;
                seeded.push(doc);
                console.log(`[CREATED] ${u.email} (role=${u.role})`);
            }
        }

        // Verify count
        const count = await col.countDocuments({
            email: { $in: TEST_USERS.map(u => u.email) }
        });

        console.log('\n============================');
        console.log(`Inserted: ${inserted}  Updated: ${updated}`);
        console.log(`\ndb.users.countDocuments({ email: { $in: [...] } }) = ${count}`);
        console.log('\n--- Seeded Documents ---');
        const docs = await col.find({ email: { $in: TEST_USERS.map(u => u.email) } }).toArray();
        for (const d of docs) {
            console.log(`  Name:   ${d.name}`);
            console.log(`  Email:  ${d.email}`);
            console.log(`  Role:   ${d.role}`);
            console.log(`  Status: ${d.status}`);
            console.log(`  _id:    ${d._id}`);
            console.log('');
        }

        await mongoose.disconnect();
        console.log('Done. ✅');
        process.exit(0);
    } catch (err) {
        console.error('\nERROR:', err.message);
        process.exit(1);
    }
})();
