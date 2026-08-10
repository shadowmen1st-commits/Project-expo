process.env.NODE_ENV='test'; process.env.PAYMENT_PROVIDER='mock'; process.env.PAYMENT_PROVIDER_MODE='mock'; process.env.PAYOUT_PROVIDER='mock'; process.env.PAYOUT_PROVIDER_MODE='mock';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startReplicaSetTestEnvironment, stopTestEnvironment, createTestApp } from './helpers/testEnvironment.js';
import { createCustomer, createAdmin, createServiceCategory, createApprovedWorker, createPricingConfiguration, createCommissionRule, authHeaderFor } from './helpers/testFixtures.js';
import WorkerProfile from '../src/models/WorkerProfile.js';
import Booking from '../src/models/Booking.js';
import AuditLog from '../src/models/AuditLog.js';

let passed=0,failed=0; const failures=[];
async function test(name,fn){try{await fn();passed++;console.log(`PASS ${name}`);}catch(e){failed++;failures.push(`${name}: ${e.message}`);console.error(`FAIL ${name}: ${e.message}`);}}

async function main(){
 await startReplicaSetTestEnvironment(); const app=await createTestApp();
 try {
  const admin=await createAdmin(); const category=await createServiceCategory(); await createPricingConfiguration(admin._id); await createCommissionRule({adminId:admin._id,categoryId:category._id});
  const customer=await createCustomer(); const otherCustomer=await createCustomer(); const worker=await createApprovedWorker({category}); const otherWorker=await createApprovedWorker({category}); const pendingWorker=await createApprovedWorker({category}); await WorkerProfile.findOneAndUpdate({userId:pendingWorker._id},{verificationStatus:'PENDING_APPROVAL'});
  const start=new Date(Date.now()+3*86400000); start.setUTCHours(10,0,0,0); const end=new Date(start.getTime()+2*3600000);
  const payload={workerId:worker._id.toString(),serviceCategoryId:category._id.toString(),serviceAddress:'123 Self Contained Test Street',scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),pricingType:'HOURLY',amount:1,totalAmount:1};
  const created=await request(app).post('/api/v1/bookings').set(authHeaderFor(customer)).send(payload);
  if (created.status !== 201) console.error('CREATE BOOKING ERROR:', created.body);
  await test('customer creates eligible booking',()=>assert.equal(created.status,201)); const bookingId=created.body.booking?.id;
  await test('server ignores client amount',async()=>assert.ok((await Booking.findById(bookingId)).totalAmount>1));
  await test('pricing snapshot is stored',async()=>assert.ok((await Booking.findById(bookingId)).pricingSnapshot.customerTotalPaise>0));
  await test('customer cannot book themselves',async()=>assert.equal((await request(app).post('/api/v1/bookings').set(authHeaderFor(customer)).send({...payload,workerId:customer._id.toString(),scheduledStart:new Date(start.getTime()+86400000).toISOString(),scheduledEnd:new Date(end.getTime()+86400000).toISOString()})).status,400));
  await test('unapproved worker cannot be booked',async()=>assert.ok((await request(app).post('/api/v1/bookings').set(authHeaderFor(customer)).send({...payload,workerId:pendingWorker._id.toString(),scheduledStart:new Date(start.getTime()+2*86400000).toISOString(),scheduledEnd:new Date(end.getTime()+2*86400000).toISOString()})).status>=400));
  // Set worker availability to 09:00 - 18:00 for operating-hours testing
  await WorkerProfile.findOneAndUpdate({ userId: worker._id }, { availability: [0,1,2,3,4,5,6].map(day => ({ day, start: '09:00', end: '18:00', isWorking: true })) });

  // Timezone-aware operating hours regression tests (Asia/Kolkata +05:30)
  // 09:00 IST = 03:30 UTC, 11:00 IST = 05:30 UTC
  const slot09to11 = { workerId: worker._id.toString(), serviceCategoryId: category._id.toString(), scheduledStart: '2026-08-11T03:30:00.000Z', scheduledEnd: '2026-08-11T05:30:00.000Z', pricingType: 'HOURLY' };
  const res09to11 = await request(app).post('/api/v1/bookings/availability/check').set(authHeaderFor(customer)).send(slot09to11);
  await test('09:00-11:00 IST slot is available (HTTP 200)', () => { assert.equal(res09to11.status, 200); assert.equal(res09to11.body.available, true); });

  const slot10to12 = { workerId: worker._id.toString(), serviceCategoryId: category._id.toString(), scheduledStart: '2026-08-11T04:30:00.000Z', scheduledEnd: '2026-08-11T06:30:00.000Z', pricingType: 'HOURLY' };
  const res10to12 = await request(app).post('/api/v1/bookings/availability/check').set(authHeaderFor(customer)).send(slot10to12);
  await test('10:00-12:00 IST slot is available (HTTP 200)', () => { assert.equal(res10to12.status, 200); assert.equal(res10to12.body.available, true); });

  const slot16to18 = { workerId: worker._id.toString(), serviceCategoryId: category._id.toString(), scheduledStart: '2026-08-11T10:30:00.000Z', scheduledEnd: '2026-08-11T12:30:00.000Z', pricingType: 'HOURLY' };
  const res16to18 = await request(app).post('/api/v1/bookings/availability/check').set(authHeaderFor(customer)).send(slot16to18);
  await test('16:00-18:00 IST slot is available (HTTP 200)', () => { assert.equal(res16to18.status, 200); assert.equal(res16to18.body.available, true); });

  const slot17to19 = { workerId: worker._id.toString(), serviceCategoryId: category._id.toString(), scheduledStart: '2026-08-11T11:30:00.000Z', scheduledEnd: '2026-08-11T13:30:00.000Z', pricingType: 'HOURLY' };
  const res17to19 = await request(app).post('/api/v1/bookings/availability/check').set(authHeaderFor(customer)).send(slot17to19);
  await test('17:00+2h slot exceeding 18:00 is rejected (HTTP 409)', () => { assert.equal(res17to19.status, 409); assert.equal(res17to19.body.errorCode, 'WORKER_TIME_SLOT_UNAVAILABLE'); });

  const slot18to19 = { workerId: worker._id.toString(), serviceCategoryId: category._id.toString(), scheduledStart: '2026-08-11T12:30:00.000Z', scheduledEnd: '2026-08-11T13:30:00.000Z', pricingType: 'HOURLY' };
  const res18to19 = await request(app).post('/api/v1/bookings/availability/check').set(authHeaderFor(customer)).send(slot18to19);
  await test('18:00+1h slot starting at 18:00 is rejected (HTTP 409)', () => { assert.equal(res18to19.status, 409); assert.equal(res18to19.body.errorCode, 'WORKER_TIME_SLOT_UNAVAILABLE'); });

  await test('overlapping booking returns 409',async()=>assert.equal((await request(app).post('/api/v1/bookings').set(authHeaderFor(otherCustomer)).send(payload)).status,409));
  await test('another customer cannot access booking',async()=>assert.equal((await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeaderFor(otherCustomer))).status,403));
  await test('another worker cannot access booking',async()=>assert.equal((await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeaderFor(otherWorker))).status,403));
  await test('assigned customer can access booking',async()=>assert.equal((await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeaderFor(customer))).status,200));
  await test('worker cannot accept unpaid booking',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/accept`).set(authHeaderFor(worker))).status,402));
  await Booking.findByIdAndUpdate(bookingId,{paymentStatus:'PAID',bookingStatus:'PAID',escrowStatus:'HELD'}); const snapshot=JSON.stringify((await Booking.findById(bookingId)).pricingSnapshot);
  const accepted=await request(app).post(`/api/v1/bookings/${bookingId}/accept`).set(authHeaderFor(worker));
  await test('worker accepts verified paid booking',()=>assert.equal(accepted.status,200));
  await test('accept action is idempotent',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/accept`).set(authHeaderFor(worker))).status,200));
  await test('invalid completion transition rejected',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/confirm-completion`).set(authHeaderFor(customer))).status,409));
  await test('pricing snapshot remains unchanged',async()=>assert.equal(JSON.stringify((await Booking.findById(bookingId)).pricingSnapshot),snapshot));
  await test('cancellation ownership enforced',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/cancel`).set(authHeaderFor(otherCustomer)).send({reason:'Not owner'})).status,403));
  await test('worker can mark en route',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/en-route`).set(authHeaderFor(worker))).status,200));
  await test('worker can start service',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/start`).set(authHeaderFor(worker))).status,200));
  await test('worker requests completion',async()=>assert.equal((await request(app).post(`/api/v1/bookings/${bookingId}/request-completion`).set(authHeaderFor(worker)).send({notes:'Service completed'})).status,200));
  await test('protected transitions create audit logs',async()=>assert.ok(await AuditLog.countDocuments({resourceType:'Booking',resourceId:bookingId})>=4));
  await test('booking DTO masks email and phone',async()=>{const res=await request(app).get(`/api/v1/bookings/${bookingId}`).set(authHeaderFor(customer));const text=JSON.stringify(res.body);assert.ok(!text.includes(customer.email)&&!text.includes(customer.phone)&&!text.includes(worker.email));});
  console.log(`BOOKING_TESTS_EXECUTED=${passed+failed} BOOKING_TESTS_PASSED=${passed} BOOKING_TESTS_FAILED=${failed}`);
  if(failed) throw new Error(failures.join('\n'));
 } finally { await stopTestEnvironment(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
