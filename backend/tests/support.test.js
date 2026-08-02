process.env.NODE_ENV='test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import SupportTicket from '../src/models/SupportTicket.js';
import SupportTicketMessage from '../src/models/SupportTicketMessage.js';
import NotificationOutbox from '../src/models/NotificationOutbox.js';
import AuditLog from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/authUtils.js';

let n=0,passed=0;const t=async(name,fn)=>{n++;try{await fn();passed++;console.log(`PASS ${n} ${name}`)}catch(e){console.error(`FAIL ${n} ${name}`);throw e}};
const repl=await MongoMemoryReplSet.create({replSet:{count:1}});await mongoose.connect(repl.getUri());
for(const M of [User,SupportTicket,SupportTicketMessage,NotificationOutbox,AuditLog])await M.createCollection().catch(()=>{});
const pwd=await hashPassword('Test@123');
const [customer,other,worker,admin]=await User.create([
 {name:'Support Customer',email:'support.customer@test.com',passwordHash:pwd,role:'CUSTOMER',phone:'+12025550101'},
 {name:'Other Customer',email:'support.other@test.com',passwordHash:pwd,role:'CUSTOMER',phone:'+12025550102'},
 {name:'Support Worker',email:'support.worker@test.com',passwordHash:pwd,role:'WORKER',phone:'+12025550103',workerStatus:'VERIFIED'},
 {name:'Support Admin',email:'support.admin@test.com',passwordHash:pwd,role:'ADMIN',phone:'+12025550104'}]);
const app=createApp();const login=async email=>(await request(app).post('/api/auth/login').send({email,password:'Test@123'})).headers['set-cookie'];
const [ch,oh,wh,ah]=await Promise.all([login(customer.email),login(other.email),login(worker.email),login(admin.email)]);const H=c=>({Cookie:c});
try{
 await t('unauthenticated create rejected',async()=>assert.equal((await request(app).post('/api/v1/support').send({})).status,401));
 await t('invalid category rejected',async()=>assert.equal((await request(app).post('/api/v1/support').set(H(ch)).send({category:'ROOT',subject:'x',description:'x'})).status,400));
 await t('script subject rejected',async()=>assert.equal((await request(app).post('/api/v1/support').set(H(ch)).send({category:'PAYMENT',subject:'<script>x</script>',description:'safe'})).status,400));
 const create=await request(app).post('/api/v1/support').set(H(ch)).send({category:'PAYMENT',subject:'Payment missing',description:'Please investigate transaction',priority:'HIGH'});const id=create.body._id;
 await t('customer creates ticket',()=>assert.equal(create.status,201));await t('ticket number generated',()=>assert.match(create.body.ticketNumber,/^TKT-/));
 await t('initial state open',()=>assert.equal(create.body.status,'OPEN'));await t('requester server derived',()=>assert.equal(create.body.requesterId,String(customer._id)));
 await t('first response SLA set',()=>assert.ok(create.body.firstResponseDueAt));await t('resolution SLA set',()=>assert.ok(create.body.resolutionDueAt));
 await t('initial message persisted',async()=>assert.equal(await SupportTicketMessage.countDocuments({ticketId:id}),1));await t('creation outbox atomic',async()=>assert.equal(await NotificationOutbox.countDocuments({aggregateId:id,eventType:'TICKET_CREATED'}),1));
 const own=await request(app).get('/api/v1/support').set(H(ch));await t('owner lists ticket',()=>assert.ok(own.body.some(x=>x._id===id)));
 await t('other list isolated',async()=>assert.equal((await request(app).get('/api/v1/support').set(H(oh))).body.length,0));
 await t('other detail forbidden',async()=>assert.equal((await request(app).get(`/api/v1/support/${id}`).set(H(oh))).status,403));
 const cr=await request(app).post(`/api/v1/support/${id}/messages`).set(H(ch)).send({body:'Any update?',visibility:'INTERNAL_ONLY'});
 await t('requester reply accepted',()=>assert.equal(cr.status,201,JSON.stringify(cr.body)));await t('requester cannot create internal note',()=>assert.equal(cr.body.visibility,'REQUESTER_VISIBLE'));
 await t('nonowner reply forbidden',async()=>assert.equal((await request(app).post(`/api/v1/support/${id}/messages`).set(H(oh)).send({body:'intrude'})).status,403));
 await t('customer blocked from admin queue',async()=>assert.equal((await request(app).get('/api/v1/admin/support/tickets').set(H(ch))).status,403));
 const queue=await request(app).get('/api/v1/admin/support/tickets?status=OPEN&limit=100').set(H(ah));await t('admin queue allowed',()=>assert.equal(queue.status,200));await t('queue limit capped',()=>assert.ok(queue.body.tickets.length<=50));
 await t('invalid queue filter rejected',async()=>assert.equal((await request(app).get('/api/v1/admin/support/tickets?status=HACKED').set(H(ah))).status,400));
 const detail=await request(app).get(`/api/v1/admin/support/tickets/${id}`).set(H(ah));await t('admin detail allowed',()=>assert.equal(detail.status,200));await t('detail has timeline',()=>assert.ok(Array.isArray(detail.body.timeline)));
 const assign=await request(app).post(`/api/v1/admin/support/tickets/${id}/assign`).set(H(ah)).send({agentId:admin._id,team:'PAYMENTS'});await t('assignment succeeds',()=>assert.equal(assign.status,200));await t('assignment team stored',()=>assert.equal(assign.body.ticket.assignedTeam,'PAYMENTS'));
 const tri=await request(app).post(`/api/v1/admin/support/tickets/${id}/triage`).set(H(ah)).send({reasonCode:'VALID'});await t('triage transition succeeds',()=>assert.equal(tri.body.ticket.status,'TRIAGED'));
 await t('invalid direct resolve rejected',async()=>assert.ok((await request(app).post(`/api/v1/admin/support/tickets/${id}/resolve`).set(H(ah)).send({reasonCode:'DONE'})).status>=400));
 await SupportTicket.updateOne({_id:id},{$set:{status:'IN_PROGRESS'}});
 const note=await request(app).post(`/api/v1/admin/support/tickets/${id}/internal-note`).set(H(ah)).set('Idempotency-Key','note-1').send({body:'Internal risk review'});await t('internal note succeeds',()=>assert.equal(note.status,201));await t('internal note visibility stored',()=>assert.equal(note.body.message.visibility,'INTERNAL_ONLY'));
 const note2=await request(app).post(`/api/v1/admin/support/tickets/${id}/internal-note`).set(H(ah)).set('Idempotency-Key','note-1').send({body:'Internal risk review'});await t('internal note idempotent',()=>assert.equal(note2.body.idempotent,true));
 const userDetail=await request(app).get(`/api/v1/support/${id}`).set(H(ch));await t('internal note hidden from requester',()=>assert.ok(!userDetail.body.messages.some(m=>m.visibility==='INTERNAL_ONLY')));
 const reply=await request(app).post(`/api/v1/admin/support/tickets/${id}/reply`).set(H(ah)).set('Idempotency-Key','reply-1').send({body:'We are reviewing this.'});await t('agent reply succeeds',()=>assert.equal(reply.status,201));await t('first response timestamp set',async()=>assert.ok((await SupportTicket.findById(id)).firstRespondedAt));
 await t('agent reply notifies requester',async()=>assert.equal(await NotificationOutbox.countDocuments({aggregateId:id,eventType:'TICKET_REPLY'}),1));
 await SupportTicket.updateOne({_id:id},{$set:{status:'IN_PROGRESS'}});const resolve=await request(app).post(`/api/v1/admin/support/tickets/${id}/resolve`).set(H(ah)).send({reasonCode:'ANSWERED'});await t('resolve succeeds',()=>assert.equal(resolve.body.ticket.status,'RESOLVED'));
 const close=await request(app).post(`/api/v1/admin/support/tickets/${id}/close`).set(H(ah)).send({reasonCode:'COMPLETE'});await t('close succeeds',()=>assert.equal(close.body.ticket.status,'CLOSED'));
 const reopen=await request(app).post(`/api/v1/admin/support/tickets/${id}/reopen`).set(H(ah)).send({reasonCode:'CUSTOMER_REQUEST'});await t('reopen succeeds',()=>assert.equal(reopen.body.ticket.status,'REOPENED'));
 const esc=await request(app).post(`/api/v1/admin/support/tickets/${id}/escalate`).set(H(ah)).send({reasonCode:'SLA'});await t('manual escalation increments',()=>assert.equal(esc.body.ticket.escalationLevel,1));
 await SupportTicket.updateOne({_id:id},{$set:{status:'IN_PROGRESS',firstResponseDueAt:new Date(0),resolutionDueAt:new Date(0),firstRespondedAt:null}});const scan=await request(app).post('/api/v1/admin/support/sla/scan').set(H(ah));await t('SLA scan succeeds',()=>assert.equal(scan.status,200));await t('SLA breach escalates',()=>assert.ok(scan.body.escalated>=1));
 await t('support actions audited',async()=>assert.ok(await AuditLog.countDocuments({resourceType:'SupportTicket',resourceId:String(id)})));
 const wr=await request(app).post('/api/v1/support').set(H(wh)).send({category:'PAYOUT',subject:'Payout pending',description:'Payout has not arrived'});await t('worker creates ticket',()=>assert.equal(wr.status,201));await t('worker requester role preserved',()=>assert.equal(wr.body.requesterRole,'WORKER'));
 console.log(`SUPPORT_TESTS_EXECUTED=${n} SUPPORT_TESTS_PASSED=${passed} SUPPORT_TESTS_FAILED=${n-passed}`);
}finally{await mongoose.disconnect();await repl.stop();}
