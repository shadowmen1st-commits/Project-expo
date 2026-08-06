import crypto from 'node:crypto';
import User from '../../src/models/User.js';
import WorkerProfile from '../../src/models/WorkerProfile.js';
import ServiceCategory from '../../src/models/ServiceCategory.js';
import PlatformPricingConfig from '../../src/models/PlatformPricingConfig.js';
import CommissionRule from '../../src/models/CommissionRule.js';
import Booking from '../../src/models/Booking.js';
import PaymentOrder from '../../src/models/PaymentOrder.js';
import PaymentTransaction from '../../src/models/PaymentTransaction.js';
import { signAccessToken } from '../../src/utils/authUtils.js';

let sequence = 0;
const next = () => ++sequence;
export async function createTestUser(role='CUSTOMER', overrides={}) { const n=next(); return User.create({ name:`${role} Test ${n}`, email:`${role.toLowerCase()}.${n}@isolated.test`, phone:`9${String(n).padStart(9,'0')}`, passwordHash:'not-a-real-password', role, status:'ACTIVE', ...overrides }); }
export const createCustomer = (o={}) => createTestUser('CUSTOMER',o);
export const createAdmin = (o={}) => createTestUser('ADMIN',o);
export async function createServiceCategory(overrides={}) { const n=next(); return ServiceCategory.create({name:`Test Category ${n}`,slug:`test-category-${n}`,description:'Isolated test service category',icon:'Wrench',defaultCommission:10,minimumBookingDuration:1,isActive:true,...overrides}); }
export async function createApprovedWorker({category, profile={}, user={}}={}) { const worker=await createTestUser('WORKER',user); await WorkerProfile.create({userId:worker._id,serviceCategoryIds:category?[category._id]:[],verificationStatus:'APPROVED',isPubliclyVisible:true,hourlyRate:30000,dailyRate:200000,minimumBookingDuration:1,bufferMinutes:0,availability:[0,1,2,3,4,5,6].map(day=>({day,start:'00:00',end:'23:59',isWorking:true})),...profile}); return worker; }
export async function createPricingConfiguration(adminId) { return PlatformPricingConfig.create({customerPlatformFeeType:'FIXED',customerPlatformFeeFixedPaise:5000,taxEnabled:true,taxRateBps:1800,quoteValiditySeconds:900,createdBy:adminId,updatedBy:adminId}); }
export async function createCommissionRule({adminId,categoryId}={}) { return CommissionRule.create({name:`Test Commission ${next()}`,scope:categoryId?'CATEGORY':'GLOBAL',serviceCategoryId:categoryId||null,percentageBps:1000,priority:categoryId?2:3,effectiveFrom:new Date(Date.now()-1000),isActive:true,status:'ACTIVE',createdBy:adminId,updatedBy:adminId}); }
export function authHeaderFor(user) { return { Authorization:`Bearer ${signAccessToken({userId:user._id.toString(),id:user._id.toString(),role:user.role})}` }; }
export async function createPaidBooking({customer,worker,category,status='PAID',amountPaise=70800,start=new Date(Date.now()+86400000)}={}) { const end=new Date(start.getTime()+3600000); const snapshot={baseAmountPaise:60000,platformFeeAmountPaise:0,taxAmountPaise:10800,discountAmountPaise:0,customerTotalPaise:amountPaise,commissionPercentageBps:1000,commissionAmountPaise:6000,workerEarningPaise:54000,currency:'INR'}; return Booking.create({bookingNumber:`TEST-${crypto.randomBytes(5).toString('hex')}`,customerId:customer._id,workerId:worker._id,serviceCategoryId:category._id,serviceAddress:'123 Isolated Test Street',scheduledStart:start,scheduledEnd:end,durationMinutes:60,pricingType:'HOURLY',baseAmount:60000,platformFee:0,taxAmount:10800,discountAmount:0,totalAmount:amountPaise,commissionPercentage:10,commissionAmount:6000,workerEarning:54000,pricingSnapshot:snapshot,currency:'INR',bookingStatus:status,paymentStatus:'PAID',escrowStatus:'HELD',completedAt:status==='COMPLETED'?new Date():undefined}); }
export const createCompletedBooking = args => createPaidBooking({...args,status:'COMPLETED'});
export async function createVerifiedPayment({booking,customer,providerPaymentId=`pay_test_${next()}`}={}) { const order=await PaymentOrder.create({orderNumber:`PO-${next()}`,bookingId:booking._id,customerId:customer._id,provider:'razorpay',providerOrderId:`order_test_${next()}`,amountPaise:booking.totalAmount,currency:'INR',receipt:`receipt-${next()}`,status:'PAID',attemptNumber:1,idempotencyKey:`order-key-${next()}`,requestFingerprint:crypto.randomBytes(16).toString('hex'),expiresAt:new Date(Date.now()+900000)}); const payment=await PaymentTransaction.create({transactionNumber:`PT-${next()}`,bookingId:booking._id,paymentOrderId:order._id,customerId:customer._id,provider:'razorpay',providerOrderId:order.providerOrderId,providerPaymentId,amountPaise:booking.totalAmount,currency:'INR',status:'CAPTURED',verificationSource:'WEBHOOK',signatureVerified:true,idempotencyKey:`payment:${providerPaymentId}`}); return {order,payment}; }
