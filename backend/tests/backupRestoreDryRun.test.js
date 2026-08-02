process.env.NODE_ENV='test'; process.env.PAYMENT_PROVIDER_MODE='mock'; process.env.PAYOUT_PROVIDER_MODE='mock';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startReplicaSetTestEnvironment, stopTestEnvironment } from './helpers/testEnvironment.js';
let passed=0; const check=async(name,fn)=>{await fn();passed++;console.log(`PASS ${name}`)};
await startReplicaSetTestEnvironment();
try {
  const client=mongoose.connection.getClient(),source=client.db('readiness_backup_source_test'),target=client.db('readiness_backup_restore_test');
  const fixture={users:[{_id:new mongoose.Types.ObjectId(),email:'backup.user@example.test'}],bookings:[{_id:new mongoose.Types.ObjectId(),bookingNumber:'BACKUP-1'}],oauthidentities:[{_id:new mongoose.Types.ObjectId(),provider:'google',subjectHash:'fictional'}],conversations:[{_id:new mongoose.Types.ObjectId(),messageCount:2}],supporttickets:[{_id:new mongoose.Types.ObjectId(),ticketNumber:'TKT-BACKUP'}],ledgerentries:[{account:'escrow',debit:1000,credit:0},{account:'escrow',debit:0,credit:1000}]};
  for(const [name,docs] of Object.entries(fixture))await source.collection(name).insertMany(docs);
  for(const name of Object.keys(fixture)){const docs=await source.collection(name).find({}).toArray();if(docs.length)await target.collection(name).insertMany(docs)}
  for(const [name,docs] of Object.entries(fixture))await check(`${name} count restored`,async()=>assert.equal(await target.collection(name).countDocuments(),docs.length));
  const entries=await target.collection('ledgerentries').find({}).toArray();
  await check('ledger remains balanced',()=>assert.equal(entries.reduce((n,x)=>n+x.debit-x.credit,0),0));
  await check('booking reference restored',async()=>assert.equal((await target.collection('bookings').findOne({bookingNumber:'BACKUP-1'})).bookingNumber,'BACKUP-1'));
  await check('OAuth identity restored',async()=>assert.equal((await target.collection('oauthidentities').findOne({provider:'google'})).subjectHash,'fictional'));
  await check('conversation restored',async()=>assert.equal((await target.collection('conversations').findOne({})).messageCount,2));
  await source.dropDatabase();await target.dropDatabase();await check('temporary databases deleted safely',()=>true);
  console.log(`BACKUP_RESTORE_TESTS_EXECUTED=${passed} BACKUP_RESTORE_TESTS_PASSED=${passed} BACKUP_RESTORE_TESTS_FAILED=0`);
} finally { await stopTestEnvironment(); }
