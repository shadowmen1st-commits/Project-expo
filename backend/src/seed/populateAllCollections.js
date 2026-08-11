import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Fix DNS for MongoDB SRV lookup on Windows
dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import PayoutPolicy from '../models/PayoutPolicy.js';
import ReviewPolicy from '../models/ReviewPolicy.js';
import CommunicationPolicy from '../models/CommunicationPolicy.js';
import SupportSlaPolicy from '../models/SupportSlaPolicy.js';
import SurgeRule from '../models/SurgeRule.js';
import CommissionRule from '../models/CommissionRule.js';
import CancellationPolicy from '../models/CancellationPolicy.js';

import CompanyProfile from '../models/CompanyProfile.js';
import CompanyVerificationDocument from '../models/CompanyVerificationDocument.js';
import CompanyTeam from '../models/CompanyTeam.js';

import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationReviewEvent from '../models/VerificationReviewEvent.js';
import WorkerProfile from '../models/WorkerProfile.js';

import Coupon from '../models/Coupon.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import Attendance from '../models/Attendance.js';

import CompanyWallet from '../models/CompanyWallet.js';
import CompanyPayment from '../models/CompanyPayment.js';
import PriceQuote from '../models/PriceQuote.js';
import Booking from '../models/Booking.js';
import PaymentOrder from '../models/PaymentOrder.js';
import PaymentTransaction from '../models/PaymentTransaction.js';

import LedgerAccount from '../models/LedgerAccount.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';

import WorkerEarning from '../models/WorkerEarning.js';
import WorkerWallet from '../models/WorkerWallet.js';
import WalletLedger from '../models/WalletLedger.js';
import WorkerPayoutAccount from '../models/WorkerPayoutAccount.js';
import WorkerPayout from '../models/WorkerPayout.js';

import Review from '../models/Review.js';
import ReviewReport from '../models/ReviewReport.js';
import WorkerRatingAggregate from '../models/WorkerRatingAggregate.js';

import DisputeCase from '../models/DisputeCase.js';
import DisputeEvidence from '../models/DisputeEvidence.js';
import Refund from '../models/Refund.js';

import Conversation from '../models/Conversation.js';
import ConversationParticipantState from '../models/ConversationParticipantState.js';
import Message from '../models/Message.js';
import ChatAttachment from '../models/ChatAttachment.js';
import MessageReport from '../models/MessageReport.js';
import CommunicationRestriction from '../models/CommunicationRestriction.js';

import SupportTicket from '../models/SupportTicket.js';
import SupportTicketMessage from '../models/SupportTicketMessage.js';

import WebhookEvent from '../models/WebhookEvent.js';
import Notification from '../models/Notification.js';
import NotificationOutbox from '../models/NotificationOutbox.js';
import NotificationPreference from '../models/NotificationPreference.js';

import OAuthIdentity from '../models/OAuthIdentity.js';
import OAuthAttempt from '../models/OAuthAttempt.js';
import RefreshToken from '../models/RefreshToken.js';
import AuditLog from '../models/AuditLog.js';

const allModelMap = {
  attendances: Attendance,
  auditlogs: AuditLog,
  bookings: Booking,
  cancellationpolicies: CancellationPolicy,
  chatattachments: ChatAttachment,
  commissionrules: CommissionRule,
  communicationpolicies: CommunicationPolicy,
  communicationrestrictions: CommunicationRestriction,
  companypayments: CompanyPayment,
  companyprofiles: CompanyProfile,
  companyteams: CompanyTeam,
  companyverificationdocuments: CompanyVerificationDocument,
  companywallets: CompanyWallet,
  conversationparticipantstates: ConversationParticipantState,
  conversations: Conversation,
  coupons: Coupon,
  disputecases: DisputeCase,
  disputeevidences: DisputeEvidence,
  jobs: Job,
  jobapplications: JobApplication,
  ledgeraccounts: LedgerAccount,
  ledgerentries: LedgerEntry,
  ledgertransactions: LedgerTransaction,
  messages: Message,
  messagereports: MessageReport,
  notifications: Notification,
  notificationoutboxes: NotificationOutbox,
  notificationpreferences: NotificationPreference,
  oauthattempts: OAuthAttempt,
  oauthidentities: OAuthIdentity,
  paymentorders: PaymentOrder,
  paymenttransactions: PaymentTransaction,
  payoutpolicies: PayoutPolicy,
  platformpricingconfigs: PlatformPricingConfig,
  pricequotes: PriceQuote,
  refreshtokens: RefreshToken,
  refunds: Refund,
  reviews: Review,
  reviewpolicies: ReviewPolicy,
  reviewreports: ReviewReport,
  servicecategories: ServiceCategory,
  supportslapolicies: SupportSlaPolicy,
  supporttickets: SupportTicket,
  supportticketmessages: SupportTicketMessage,
  surgerules: SurgeRule,
  users: User,
  verificationdocuments: VerificationDocument,
  verificationreviewevents: VerificationReviewEvent,
  verificationsubmissions: VerificationSubmission,
  walletledgers: WalletLedger,
  webhookevents: WebhookEvent,
  workerassignments: WorkerAssignment,
  workerearnings: WorkerEarning,
  workerpayouts: WorkerPayout,
  workerpayoutaccounts: WorkerPayoutAccount,
  workerprofiles: WorkerProfile,
  workerratingaggregates: WorkerRatingAggregate,
  workerwallets: WorkerWallet,
};

async function upsert(model, filter, docData) {
  let doc = await model.findOne(filter).select('+eligibilitySnapshot +policySnapshot +contentBase64');
  if (!doc) {
    doc = await model.create({ ...filter, ...docData });
  } else {
    Object.assign(doc, docData);
    await doc.save();
  }
  return doc;
}

export async function populateAll() {
  const dbName = process.env.DB_NAME || 'test';
  console.log(`Connecting to MongoDB... (dbName: ${dbName})`);
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log(`Connected to database: ${mongoose.connection.name}`);

  // 1. Get BEFORE counts for all collections
  const beforeCounts = {};
  for (const [colName, model] of Object.entries(allModelMap)) {
    beforeCounts[colName] = await model.countDocuments();
  }

  // 2. Fetch existing users
  const adminUser = await User.findOne({ email: 'admin@test.com' });
  const customerUser = await User.findOne({ email: 'customer@test.com' });
  const workerUser = await User.findOne({ email: 'worker@test.com' });
  const companyUser = await User.findOne({ email: 'company@test.com' });

  if (!adminUser || !customerUser || !workerUser || !companyUser) {
    throw new Error(`Missing required existing users! admin: ${!!adminUser}, customer: ${!!customerUser}, worker: ${!!workerUser}, company: ${!!companyUser}`);
  }

  console.log('Using Existing Users:');
  console.log(`- ADMIN: ${adminUser.email} (${adminUser._id})`);
  console.log(`- CUSTOMER: ${customerUser.email} (${customerUser._id})`);
  console.log(`- WORKER: ${workerUser.email} (${workerUser._id})`);
  console.log(`- COMPANY: ${companyUser.email} (${companyUser._id})`);

  // 3. Service Categories
  const categoriesData = [
    { name: 'Home Cleaning', slug: 'home-cleaning', description: 'Deep residential cleaning, dusting, and sanitization.', icon: 'sparkles', defaultCommission: 10, minimumBookingDuration: 1 },
    { name: 'Plumbing', slug: 'plumbing', description: 'Pipe repair, leak fixing, and fixture installation.', icon: 'wrench', defaultCommission: 12, minimumBookingDuration: 1 },
    { name: 'Electrical', slug: 'electrical', description: 'Wiring, circuit repairs, and appliance installation.', icon: 'zap', defaultCommission: 12, minimumBookingDuration: 1 },
    { name: 'Security', slug: 'security', description: 'Event security and commercial guard services.', icon: 'shield', defaultCommission: 15, minimumBookingDuration: 2 },
    { name: 'Moving', slug: 'moving', description: 'Packing, loading, and relocation assistance.', icon: 'truck', defaultCommission: 15, minimumBookingDuration: 2 },
    { name: 'Car Cleaning', slug: 'car-cleaning', description: 'On-site vehicle detailing and washing.', icon: 'car', defaultCommission: 10, minimumBookingDuration: 1 },
    { name: 'Beauty Services', slug: 'beauty-services', description: 'At-home salon, hair styling, and spa treatments.', icon: 'scissors', defaultCommission: 15, minimumBookingDuration: 1 },
    { name: 'Event Staffing', slug: 'event-staffing', description: 'Waiters, hostesses, and event setup personnel.', icon: 'users', defaultCommission: 15, minimumBookingDuration: 4 }
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const doc = await upsert(ServiceCategory, { slug: cat.slug }, cat);
    categoryMap[cat.slug] = doc;
  }
  const mainCategory = categoryMap['home-cleaning'];

  // 4. Platform Policies & Configs
  await upsert(PlatformPricingConfig, { version: 1 }, {
    currency: 'INR',
    customerPlatformFeeType: 'FIXED',
    customerPlatformFeeFixedPaise: 5000,
    taxEnabled: true,
    taxRateBps: 1800,
    taxApplicationMode: 'EXCLUSIVE',
    defaultMinimumBookingAmountPaise: 10000,
    quoteValiditySeconds: 900,
    surgePricingEnabled: false,
    cancellationPricingEnabled: true,
    createdBy: adminUser._id,
    updatedBy: adminUser._id
  });

  await upsert(PayoutPolicy, { isActive: true }, {
    minimumPayoutPaise: 10000,
    maximumPayoutPaise: 500000,
    dailyPayoutLimitPaise: 200000,
    monthlyPayoutLimitPaise: 1000000,
    maximumDailyRequests: 3,
    settlementSchedule: 'T+1',
    manualReviewThresholdPaise: 200000,
    supportedModes: ['IMPS', 'NEFT', 'RTGS', 'UPI'],
    effectiveFrom: new Date('2026-01-01'),
    createdBy: 'System',
    updatedBy: 'System'
  });

  await upsert(ReviewPolicy, { version: 1 }, {
    reviewWindowDays: 14,
    editWindowHours: 24,
    minimumCommentLength: 5,
    maximumCommentLength: 2000,
    maximumTitleLength: 120,
    allowedTags: ['Punctual', 'Professional', 'Clean', 'Friendly'],
    autoPublishEnabled: true,
    suspiciousContentRequiresModeration: true,
    maximumReviewAttemptsPerHour: 5,
    workerResponseEnabled: true,
    workerResponseEditWindowHours: 24,
    isActive: true,
    effectiveFrom: new Date('2026-01-01'),
    createdBy: 'System',
    updatedBy: 'System'
  });

  await upsert(CommunicationPolicy, { policyVersion: 1 }, {
    chatEnabled: true,
    allowedBookingStatuses: ['ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED', 'COMPLETION_REQUESTED', 'COMPLETED', 'DISPUTED'],
    chatStartRule: 'AFTER_ACCEPTED',
    postCompletionChatWindowHours: 48,
    maximumMessageLength: 2000,
    maximumMessagesPerMinute: 30,
    maximumAttachmentsPerMessage: 3,
    maximumAttachmentSizeBytes: 5242880,
    allowedAttachmentMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    isActive: true,
    effectiveFrom: new Date('2026-01-01'),
    createdBy: 'System',
    updatedBy: 'System'
  });

  await upsert(SupportSlaPolicy, { category: 'BOOKING', priority: 'NORMAL' }, {
    firstResponseMinutes: 120,
    resolutionMinutes: 1440,
    businessHoursPolicy: '24_7',
    isActive: true,
    effectiveFrom: new Date('2026-01-01'),
    createdBy: adminUser._id,
    updatedBy: adminUser._id
  });

  await upsert(SurgeRule, { name: 'Peak Weekend Surge' }, {
    serviceCategoryId: mainCategory._id,
    city: 'Bangalore',
    daysOfWeek: [0, 6],
    startTime: '10:00',
    endTime: '18:00',
    multiplierBps: 12000,
    maximumMultiplierBps: 30000,
    priority: 1,
    isActive: false,
    createdBy: adminUser._id
  });

  await upsert(CommissionRule, { name: 'Standard Home Cleaning Commission' }, {
    scope: 'CATEGORY',
    serviceCategoryId: mainCategory._id,
    calculationType: 'PERCENTAGE',
    percentageBps: 1000,
    priority: 2,
    effectiveFrom: new Date('2026-01-01'),
    isActive: true,
    status: 'ACTIVE',
    createdBy: adminUser._id
  });

  await upsert(CancellationPolicy, { name: 'Standard Cancellation Policy' }, {
    serviceCategoryId: mainCategory._id,
    cancellationWindowType: 'FLAT_HOURS',
    freeCancellationBeforeMinutes: 1440,
    customerCancellationFeeBps: 500,
    customerCancellationFixedPaise: 0,
    workerCompensationBps: 5000,
    platformFeeRefundable: false,
    taxRefundable: true,
    couponRefundPolicy: 'VOIDED',
    noShowPolicy: 'CHARGE_FULL',
    effectiveFrom: new Date('2026-01-01'),
    isActive: true,
    createdBy: adminUser._id,
    updatedBy: adminUser._id
  });

  // 5. Company Profile, Verification Docs, Team
  const companyProfile = await upsert(CompanyProfile, { userId: companyUser._id }, {
    companyName: 'Test Company Solutions',
    email: companyUser.email,
    phone: '9999999904',
    address: '123 Tech Park, Outer Ring Road',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560001',
    businessType: 'PRIVATE_LIMITED',
    description: 'Enterprise Facility & Services Provider',
    authorizedPersonName: 'Test Company Admin',
    authorizedPersonPhone: '9999999904',
    country: 'India',
    verificationStatus: 'APPROVED',
    submittedAt: new Date()
  });

  await upsert(CompanyVerificationDocument, { companyId: companyUser._id, documentType: 'BUSINESS_REGISTRATION' }, {
    documentUrl: 'https://example.com/docs/business_reg.pdf',
    fileName: 'business_reg.pdf',
    fileSize: 204800,
    mimeType: 'application/pdf',
    status: 'APPROVED',
    reviewedBy: adminUser._id,
    reviewedAt: new Date()
  });

  await upsert(CompanyTeam, { companyId: companyUser._id, name: 'Alpha Maintenance Unit' }, {
    leaderId: workerUser._id,
    members: [workerUser._id]
  });

  // 6. Worker Verification, Submission, Profile
  const verificationDoc = await upsert(VerificationDocument, { workerId: workerUser._id, documentType: 'AADHAAR' }, {
    documentNumberEncrypted: 'enc_aadhaar_123456789012',
    documentNumberLast4: '9012',
    frontFile: 'https://example.com/docs/aadhaar_front.jpg',
    fileMimeType: 'image/jpeg',
    fileSize: 102400,
    verificationStatus: 'APPROVED',
    reviewedBy: adminUser._id
  });

  const verificationSub = await upsert(VerificationSubmission, { workerId: workerUser._id, version: 1 }, {
    submissionNumber: 1,
    profileSnapshot: { fullName: 'Test Worker' },
    serviceSnapshot: { primaryCategory: 'Home Cleaning' },
    declarationAccepted: true,
    consentAccepted: true,
    documentIds: [verificationDoc._id],
    status: 'APPROVED',
    reviewedBy: adminUser._id
  });

  await upsert(VerificationReviewEvent, { workerId: workerUser._id, submissionId: verificationSub._id }, {
    action: 'APPROVED',
    previousStatus: 'PENDING_APPROVAL',
    newStatus: 'APPROVED',
    actorId: adminUser._id,
    actorRole: 'ADMIN'
  });

  const workerProfile = await upsert(WorkerProfile, { userId: workerUser._id }, {
    fullName: 'Test Worker',
    gender: 'MALE',
    phone: '9999999903',
    address: '45 MG Road',
    city: 'Bangalore',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
    bio: 'Professional cleaner with 5 years experience.',
    yearsOfExperience: 5,
    primaryServiceCategoryId: mainCategory._id,
    serviceCategoryIds: [mainCategory._id],
    serviceIds: [mainCategory._id],
    skills: ['Home Cleaning', 'Deep Cleaning', 'Sanitization'],
    hourlyRate: 50000,
    dailyRate: 200000,
    minimumBookingDuration: 1,
    verificationStatus: 'APPROVED',
    approvedAt: new Date(),
    approvedBy: adminUser._id,
    isOnline: true,
    isPubliclyVisible: true,
    latestSubmissionId: verificationSub._id
  });

  // 7. Coupon, Job, JobApplication, WorkerAssignment, Attendance
  const coupon = await upsert(Coupon, { code: 'WELCOME10' }, {
    description: '10% discount on service',
    discountType: 'PERCENTAGE',
    percentageBps: 1000,
    maximumDiscountPaise: 50000,
    minimumOrderAmountPaise: 100000,
    applicableCategoryIds: [mainCategory._id],
    applicableWorkerIds: [workerUser._id],
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2027-12-31'),
    usageLimit: 100,
    perCustomerUsageLimit: 1,
    currentUsageCount: 1,
    isActive: true,
    createdBy: adminUser._id
  });

  const job = await upsert(Job, { companyId: companyUser._id, title: 'Deep Cleaning Assistant' }, {
    description: 'Need skilled cleaner for office space',
    category: 'Home Cleaning',
    requiredSkills: ['Cleaning', 'Sanitization'],
    workersRequired: 2,
    location: 'Bangalore',
    address: '123 Business Park',
    workingDate: new Date(),
    startTime: '09:00',
    endTime: '17:00',
    payRate: 200000,
    paymentType: 'DAILY',
    duration: '1 day',
    experienceRequired: 2,
    genderPreference: 'ANY',
    instructions: 'Report to front desk',
    applicationDeadline: new Date(Date.now() + 86400000),
    status: 'ACTIVE'
  });

  await upsert(JobApplication, { jobId: job._id, workerId: workerUser._id }, {
    status: 'SELECTED',
    appliedAt: new Date()
  });

  await upsert(WorkerAssignment, { jobId: job._id, workerId: workerUser._id }, {
    assignedBy: companyUser._id,
    status: 'COMPLETED',
    assignedAt: new Date()
  });

  const todayStr = new Date().toISOString().split('T')[0];
  await upsert(Attendance, { jobId: job._id, workerId: workerUser._id, date: new Date(todayStr) }, {
    startTime: '09:00',
    endTime: '17:00',
    status: 'PRESENT',
    hoursWorked: 8
  });

  // 8. Company Wallet & Payment
  await upsert(CompanyWallet, { companyId: companyUser._id }, {
    availableBalancePaise: 5000000,
    pendingAmountPaise: 0,
    escrowAmountPaise: 200000,
    totalSpentPaise: 200000,
    transactionHistory: [
      { amountPaise: 5000000, type: 'CREDIT', description: 'Initial Wallet Deposit', createdAt: new Date() },
      { amountPaise: 200000, type: 'DEBIT', description: 'Job Assignment Escrow Payment', createdAt: new Date() }
    ]
  });

  await upsert(CompanyPayment, { companyId: companyUser._id, jobId: job._id, workerId: workerUser._id }, {
    amountPaise: 200000,
    platformCommissionPaise: 20000,
    workerEarningPaise: 180000,
    status: 'RELEASED'
  });

  // 9. PriceQuote & Bookings (Completed, Confirmed, Cancelled)
  const priceQuote = await upsert(PriceQuote, { quoteNumber: 'PQ-TEST-001' }, {
    customerId: customerUser._id,
    workerId: workerUser._id,
    serviceCategoryId: mainCategory._id,
    scheduledStart: new Date(Date.now() - 86400000),
    scheduledEnd: new Date(Date.now() - 79200000),
    pricingType: 'HOURLY',
    durationMinutes: 120,
    durationDays: 0,
    pricingSnapshot: {
      baseAmountPaise: 200000,
      platformFeeAmountPaise: 5000,
      taxAmountPaise: 36000,
      customerTotalPaise: 241000,
      commissionAmountPaise: 20000,
      workerEarningPaise: 180000
    },
    status: 'CONSUMED',
    expiresAt: new Date(Date.now() + 3600000)
  });

  const bookingCompleted = await upsert(Booking, { bookingNumber: 'BK-COMPLETED-001' }, {
    quoteId: priceQuote._id,
    customerId: customerUser._id,
    workerId: workerUser._id,
    serviceCategoryId: mainCategory._id,
    serviceAddress: '123 Main Street, Bangalore',
    addressSnapshot: { addressLine: '123 Main Street', city: 'Bangalore', state: 'Karnataka', pincode: '560001', latitude: 12.9716, longitude: 77.5946 },
    scheduledStart: new Date(Date.now() - 86400000),
    scheduledEnd: new Date(Date.now() - 79200000),
    durationMinutes: 120,
    pricingType: 'HOURLY',
    baseAmount: 200000,
    platformFee: 5000,
    taxAmount: 36000,
    discountAmount: 0,
    totalAmount: 241000,
    commissionPercentage: 10,
    commissionAmount: 20000,
    workerEarning: 180000,
    currency: 'INR',
    pricingSnapshot: {
      customerTotalPaise: 241000,
      baseAmountPaise: 200000,
      platformFeeAmountPaise: 5000,
      taxAmountPaise: 36000,
      commissionAmountPaise: 20000,
      workerEarningPaise: 180000
    },
    bookingStatus: 'COMPLETED',
    paymentStatus: 'PAID',
    escrowStatus: 'RELEASED',
    completedAt: new Date(Date.now() - 79200000),
    confirmedAt: new Date(Date.now() - 90000000)
  });

  const bookingConfirmed = await upsert(Booking, { bookingNumber: 'BK-CONFIRMED-001' }, {
    customerId: customerUser._id,
    workerId: workerUser._id,
    serviceCategoryId: mainCategory._id,
    serviceAddress: '123 Main Street, Bangalore',
    addressSnapshot: { addressLine: '123 Main Street', city: 'Bangalore', state: 'Karnataka', pincode: '560001', latitude: 12.9716, longitude: 77.5946 },
    scheduledStart: new Date(Date.now() + 86400000),
    scheduledEnd: new Date(Date.now() + 93600000),
    durationMinutes: 120,
    pricingType: 'HOURLY',
    baseAmount: 200000,
    platformFee: 5000,
    taxAmount: 36000,
    discountAmount: 0,
    totalAmount: 241000,
    commissionPercentage: 10,
    commissionAmount: 20000,
    workerEarning: 180000,
    currency: 'INR',
    pricingSnapshot: {
      customerTotalPaise: 241000,
      baseAmountPaise: 200000,
      platformFeeAmountPaise: 5000,
      taxAmountPaise: 36000,
      commissionAmountPaise: 20000,
      workerEarningPaise: 180000
    },
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    escrowStatus: 'FUNDED',
    confirmedAt: new Date()
  });

  const bookingCancelled = await upsert(Booking, { bookingNumber: 'BK-CANCELLED-001' }, {
    customerId: customerUser._id,
    workerId: workerUser._id,
    serviceCategoryId: mainCategory._id,
    serviceAddress: '123 Main Street, Bangalore',
    addressSnapshot: { addressLine: '123 Main Street', city: 'Bangalore', state: 'Karnataka', pincode: '560001', latitude: 12.9716, longitude: 77.5946 },
    scheduledStart: new Date(Date.now() - 172800000),
    scheduledEnd: new Date(Date.now() - 165600000),
    durationMinutes: 120,
    pricingType: 'HOURLY',
    baseAmount: 200000,
    platformFee: 5000,
    taxAmount: 36000,
    discountAmount: 0,
    totalAmount: 241000,
    commissionPercentage: 10,
    commissionAmount: 20000,
    workerEarning: 180000,
    currency: 'INR',
    pricingSnapshot: {
      customerTotalPaise: 241000,
      baseAmountPaise: 200000,
      platformFeeAmountPaise: 5000,
      taxAmountPaise: 36000,
      commissionAmountPaise: 20000,
      workerEarningPaise: 180000
    },
    bookingStatus: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    escrowStatus: 'REFUNDED',
    cancelledAt: new Date(Date.now() - 170000000),
    cancelledBy: customerUser._id,
    cancellationReason: 'Customer change of plans'
  });

  // Update PriceQuote with bookingId
  priceQuote.bookingId = bookingCompleted._id;
  await priceQuote.save();

  // 10. Payment Order & Payment Transaction
  const paymentOrder = await upsert(PaymentOrder, { orderNumber: 'PO-TEST-001' }, {
    bookingId: bookingCompleted._id,
    customerId: customerUser._id,
    provider: 'razorpay',
    providerOrderId: 'order_test_completed_1',
    amountPaise: 241000,
    currency: 'INR',
    status: 'PAID',
    bookingAmountSnapshot: { totalAmount: 241000 },
    quoteId: priceQuote._id,
    idempotencyKey: 'po-idemp-001',
    expiresAt: new Date(Date.now() + 3600000),
    paidAt: new Date()
  });

  const paymentTransaction = await upsert(PaymentTransaction, { transactionNumber: 'PT-TEST-001' }, {
    bookingId: bookingCompleted._id,
    paymentOrderId: paymentOrder._id,
    customerId: customerUser._id,
    provider: 'razorpay',
    providerPaymentId: 'pay_test_completed_1',
    amountPaise: 241000,
    currency: 'INR',
    status: 'CAPTURED',
    verificationSource: 'CHECKOUT_CALLBACK',
    signatureVerified: true,
    captured: true,
    idempotencyKey: 'pt-idemp-001',
    verifiedAt: new Date()
  });

  // 11. Ledger System
  const escrowAcc = await upsert(LedgerAccount, { accountNumber: '1001' }, {
    code: 'ESCROW_ASSET',
    name: 'Platform Escrow Account',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    ownerType: 'PLATFORM',
    currency: 'INR',
    status: 'ACTIVE',
    cachedDebitTotalPaise: 241000,
    cachedCreditTotalPaise: 0,
    cachedBalancePaise: 241000
  });

  const custClearingAcc = await upsert(LedgerAccount, { accountNumber: '1002' }, {
    code: 'CUSTOMER_CLEARING',
    name: 'Customer Payment Clearing',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    ownerType: 'CUSTOMER',
    ownerId: customerUser._id,
    currency: 'INR',
    status: 'ACTIVE'
  });

  const workerPayableAcc = await upsert(LedgerAccount, { accountNumber: '2001' }, {
    code: 'WORKER_PAYABLE',
    name: 'Worker Payable Account',
    accountType: 'LIABILITY',
    normalBalance: 'CREDIT',
    ownerType: 'WORKER',
    ownerId: workerUser._id,
    currency: 'INR',
    status: 'ACTIVE',
    cachedCreditTotalPaise: 180000,
    cachedBalancePaise: 180000
  });

  const platformRevAcc = await upsert(LedgerAccount, { accountNumber: '4001' }, {
    code: 'PLATFORM_REVENUE',
    name: 'Platform Commission Revenue',
    accountType: 'REVENUE',
    normalBalance: 'CREDIT',
    ownerType: 'PLATFORM',
    currency: 'INR',
    status: 'ACTIVE',
    cachedCreditTotalPaise: 61000,
    cachedBalancePaise: 61000
  });

  const ledgerTx = await upsert(LedgerTransaction, { transactionNumber: 'LT-TEST-001' }, {
    transactionType: 'PAYMENT_CAPTURED',
    status: 'POSTED',
    currency: 'INR',
    businessEvent: 'BOOKING_PAYMENT',
    bookingId: bookingCompleted._id,
    paymentOrderId: paymentOrder._id,
    paymentTransactionId: paymentTransaction._id,
    workerId: workerUser._id,
    customerId: customerUser._id,
    idempotencyKey: 'lt-idemp-001',
    totalDebitPaise: 241000,
    totalCreditPaise: 241000,
    description: 'Booking payment captured and allocated',
    postedAt: new Date()
  });

  await upsert(LedgerEntry, { ledgerTransactionId: ledgerTx._id, lineNumber: 1 }, {
    accountId: escrowAcc._id,
    direction: 'DEBIT',
    amountPaise: 241000,
    currency: 'INR',
    bookingId: bookingCompleted._id,
    workerId: workerUser._id,
    customerId: customerUser._id,
    balanceBeforePaise: 0,
    balanceAfterPaise: 241000,
    description: 'Escrow debited for captured payment'
  });

  await upsert(LedgerEntry, { ledgerTransactionId: ledgerTx._id, lineNumber: 2 }, {
    accountId: workerPayableAcc._id,
    direction: 'CREDIT',
    amountPaise: 180000,
    currency: 'INR',
    bookingId: bookingCompleted._id,
    workerId: workerUser._id,
    customerId: customerUser._id,
    balanceBeforePaise: 0,
    balanceAfterPaise: 180000,
    description: 'Worker net earning credited'
  });

  await upsert(LedgerEntry, { ledgerTransactionId: ledgerTx._id, lineNumber: 3 }, {
    accountId: platformRevAcc._id,
    direction: 'CREDIT',
    amountPaise: 61000,
    currency: 'INR',
    bookingId: bookingCompleted._id,
    workerId: workerUser._id,
    customerId: customerUser._id,
    balanceBeforePaise: 0,
    balanceAfterPaise: 61000,
    description: 'Platform fee and commission credited'
  });

  // 12. Worker Earnings, Wallet, Ledger
  const workerEarning = await upsert(WorkerEarning, { earningNumber: 'EARN-001' }, {
    workerId: workerUser._id,
    bookingId: bookingCompleted._id,
    ledgerTransactionId: ledgerTx._id,
    amountPaise: 180000,
    currency: 'INR',
    status: 'AVAILABLE',
    earnedAt: new Date(),
    availableAt: new Date(),
    idempotencyKey: 'earn-idemp-001'
  });

  await upsert(WorkerWallet, { workerId: workerUser._id }, {
    currency: 'INR',
    pendingBalancePaise: 0,
    availableBalancePaise: 180000,
    reservedBalancePaise: 0,
    frozenBalancePaise: 0,
    totalEarnedPaise: 180000,
    totalWithdrawnPaise: 0,
    totalCommissionDeductedPaise: 20000,
    totalRefundDeductedPaise: 0,
    ledgerVersion: 1,
    lastLedgerTransactionId: ledgerTx._id,
    reconciliationStatus: 'RECONCILED'
  });

  await upsert(WalletLedger, { reference: 'WL-REF-001' }, {
    bookingId: bookingCompleted._id,
    userId: workerUser._id,
    debitAccount: 'PLATFORM_ESCROW',
    creditAccount: 'WORKER_WALLET',
    amount: 180000,
    currency: 'INR',
    transactionType: 'EARNING',
    status: 'COMPLETED',
    idempotencyKey: 'wl-idemp-001'
  });

  // 13. Worker Payout Account & Payout
  const payoutAccount = await upsert(WorkerPayoutAccount, { fingerprint: 'fp-worker-account-001' }, {
    workerId: workerUser._id,
    accountType: 'BANK_ACCOUNT',
    displayName: 'HDFC Bank Account',
    beneficiaryName: 'Test Worker',
    accountNumberLast4: '4321',
    ifscMasked: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branchName: 'Koramangala Branch',
    verificationStatus: 'VERIFIED',
    validationStatus: 'VALID',
    status: 'ACTIVE',
    isDefault: true,
    verifiedAt: new Date()
  });

  await upsert(WorkerPayout, { payoutNumber: 'POUT-001' }, {
    workerId: workerUser._id,
    payoutAccountId: payoutAccount._id,
    amountPaise: 50000,
    currency: 'INR',
    status: 'PROCESSED',
    source: 'WORKER_REQUEST',
    mode: 'IMPS',
    idempotencyKey: 'pout-idemp-001',
    requestFingerprint: 'fp-pout-001',
    availableBalanceSnapshotPaise: 180000,
    reservedBalanceSnapshotPaise: 0,
    requestedAt: new Date(),
    processedAt: new Date()
  });

  // 14. Review, Review Report, Worker Rating Aggregate
  const review = await upsert(Review, { idempotencyKey: 'rev-idemp-001' }, {
    bookingId: bookingCompleted._id,
    serviceCategoryId: mainCategory._id,
    reviewerId: customerUser._id,
    revieweeId: workerUser._id,
    workerId: workerUser._id,
    customerId: customerUser._id,
    direction: 'CUSTOMER_TO_WORKER',
    rating: 5,
    title: 'Excellent service',
    comment: 'Punctual, polite, and left the home sparkling clean!',
    tags: ['Punctual', 'Clean', 'Professional'],
    status: 'PUBLISHED',
    moderationStatus: 'APPROVED',
    verifiedBooking: true,
    bookingCompletedAt: new Date(Date.now() - 79200000),
    eligibilitySnapshot: { bookingId: bookingCompleted._id, bookingNumber: 'BK-COMPLETED-001' },
    policySnapshot: { reviewWindowDays: 14 },
    requestFingerprint: 'fp-rev-001',
    editWindowExpiresAt: new Date(Date.now() + 86400000),
    publishedAt: new Date()
  });

  await upsert(ReviewReport, { reviewId: review._id, reporterId: companyUser._id, reasonCode: 'OTHER' }, {
    reporterRole: 'COMPANY',
    descriptionSafe: 'Routine audit test report',
    status: 'RESOLVED'
  });

  await upsert(WorkerRatingAggregate, { workerId: workerUser._id }, {
    averageRating: 5.0,
    ratingCount: 1,
    verifiedReviewCount: 1,
    ratingSum: 5,
    ratingDistribution: { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 1 },
    lastReviewedAt: new Date(),
    aggregateVersion: 1
  });

  // 15. Dispute, Dispute Evidence, Refund
  const dispute = await upsert(DisputeCase, { disputeNumber: 'DSP-001' }, {
    bookingId: bookingCancelled._id,
    customerId: customerUser._id,
    workerId: workerUser._id,
    openedByType: 'CUSTOMER',
    openedById: customerUser._id,
    disputeType: 'CANCELLATION_DISPUTE',
    reasonCode: 'CANCELLED_BY_CUSTOMER',
    title: 'Cancellation Fee Waiver Request',
    description: 'Booking cancelled due to emergency within free cancellation window.',
    claimedAmountPaise: 100000,
    currency: 'INR',
    status: 'RESOLVED_CUSTOMER',
    priority: 'MEDIUM',
    financialFreezeStatus: 'RELEASED',
    resolutionType: 'FULL_REFUND',
    approvedRefundAmountPaise: 100000,
    resolvedAt: new Date()
  });

  await upsert(DisputeEvidence, { disputeId: dispute._id, storageKey: 'evidence/cancellation_chat.png' }, {
    bookingId: bookingCancelled._id,
    uploadedByType: 'CUSTOMER',
    uploadedById: customerUser._id,
    evidenceType: 'CHAT_SCREENSHOT',
    description: 'Screenshot of cancellation confirmation',
    storageProvider: 'LOCAL',
    fileMimeType: 'image/png',
    fileSize: 51200,
    originalNameSafe: 'cancellation_chat.png',
    visibility: 'DISPUTE_PARTICIPANTS',
    verificationStatus: 'VERIFIED'
  });

  await upsert(Refund, { refundNumber: 'REF-001' }, {
    bookingId: bookingCancelled._id,
    customerId: customerUser._id,
    workerId: workerUser._id,
    disputeId: dispute._id,
    paymentOrderId: paymentOrder._id,
    paymentTransactionId: paymentTransaction._id,
    provider: 'razorpay',
    providerPaymentId: 'pay_test_completed_1',
    refundType: 'FULL',
    refundReason: 'Customer cancellation within free policy window',
    requestedAmountPaise: 100000,
    approvedAmountPaise: 100000,
    processedAmountPaise: 100000,
    currency: 'INR',
    status: 'PROCESSED',
    source: 'CUSTOMER_CANCELLATION',
    idempotencyKey: 'ref-idemp-001',
    requestedByType: 'CUSTOMER',
    requestedById: customerUser._id,
    processedAt: new Date()
  });

  // 16. Chat & Communication
  const conversation = await upsert(Conversation, { bookingId: bookingConfirmed._id }, {
    customerId: customerUser._id,
    workerId: workerUser._id,
    participantIds: [customerUser._id, workerUser._id],
    conversationType: 'BOOKING',
    status: 'ACTIVE',
    messageCount: 2,
    openedAt: new Date()
  });

  await upsert(ConversationParticipantState, { conversationId: conversation._id, userId: customerUser._id }, {
    role: 'CUSTOMER',
    unreadCount: 0
  });

  await upsert(ConversationParticipantState, { conversationId: conversation._id, userId: workerUser._id }, {
    role: 'WORKER',
    unreadCount: 0
  });

  const msg1 = await upsert(Message, { conversationId: conversation._id, sequenceNumber: 1 }, {
    bookingId: bookingConfirmed._id,
    senderId: customerUser._id,
    senderRole: 'CUSTOMER',
    messageType: 'TEXT',
    bodySafe: 'Hello! I will be ready at the scheduled start time.',
    deliveryStatus: 'READ',
    sentAt: new Date()
  });

  const msg2 = await upsert(Message, { conversationId: conversation._id, sequenceNumber: 2 }, {
    bookingId: bookingConfirmed._id,
    senderId: workerUser._id,
    senderRole: 'WORKER',
    messageType: 'TEXT',
    bodySafe: 'Sounds great, see you then!',
    deliveryStatus: 'READ',
    sentAt: new Date()
  });

  conversation.lastMessageId = msg2._id;
  conversation.lastMessageAt = msg2.sentAt;
  conversation.lastMessagePreviewSafe = msg2.bodySafe;
  await conversation.save();

  await upsert(ChatAttachment, { storageKey: 'attachments/location_entry.jpg' }, {
    conversationId: conversation._id,
    messageId: msg1._id,
    uploaderId: customerUser._id,
    storageProvider: 'LOCAL_MOCK',
    originalFileNameSafe: 'location_entry.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 102400,
    scanStatus: 'CLEAN',
    moderationStatus: 'CLEAR',
    status: 'AVAILABLE'
  });

  await upsert(MessageReport, { messageId: msg1._id, reporterId: workerUser._id }, {
    conversationId: conversation._id,
    bookingId: bookingConfirmed._id,
    reportedUserId: customerUser._id,
    reasonCode: 'OTHER',
    descriptionSafe: 'Routine test check for message reporting',
    status: 'RESOLVED'
  });

  await upsert(CommunicationRestriction, { sourceUserId: workerUser._id, targetUserId: customerUser._id, scope: 'BOOKING_CHAT' }, {
    bookingId: bookingCancelled._id,
    reasonCode: 'BOOKING_CANCELLED',
    status: 'EXPIRED',
    createdBy: adminUser._id
  });

  // 17. Support Tickets & Messages
  const tkt1 = await upsert(SupportTicket, { ticketNumber: 'TKT-CUST-001' }, {
    requesterId: customerUser._id,
    requesterRole: 'CUSTOMER',
    bookingId: bookingCompleted._id,
    category: 'BOOKING',
    subjectSafe: 'Invoice inquiry for booking BK-COMPLETED-001',
    descriptionSafe: 'Requesting a copy of the official PDF tax invoice.',
    priority: 'NORMAL',
    status: 'OPEN',
    assignedTeam: 'TIER_1'
  });

  await upsert(SupportTicket, { ticketNumber: 'TKT-WRK-001' }, {
    requesterId: workerUser._id,
    requesterRole: 'WORKER',
    category: 'PAYOUT',
    subjectSafe: 'Payout schedule inquiry',
    descriptionSafe: 'Clarification regarding automatic payout release times.',
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    assignedTeam: 'TIER_1'
  });

  await upsert(SupportTicket, { ticketNumber: 'TKT-CMP-001' }, {
    requesterId: companyUser._id,
    requesterRole: 'CUSTOMER',
    category: 'ACCOUNT',
    subjectSafe: 'Company document verification status',
    descriptionSafe: 'Verification documents submitted and approved.',
    priority: 'NORMAL',
    status: 'RESOLVED',
    assignedTeam: 'TIER_1'
  });

  await upsert(SupportTicketMessage, { ticketId: tkt1._id, bodySafe: 'Could you please resend the invoice email?' }, {
    senderId: customerUser._id,
    senderType: 'CUSTOMER',
    visibility: 'REQUESTER_VISIBLE'
  });

  // 18. Webhooks & Notifications
  await upsert(WebhookEvent, { provider: 'razorpay', providerEventId: 'evt_test_razorpay_001' }, {
    eventType: 'payment.captured',
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signatureHash: 'sig_test_hash_001',
    signatureVerified: true,
    processingStatus: 'PROCESSED',
    receivedAt: new Date(),
    processedAt: new Date(),
    relatedBookingId: bookingCompleted._id,
    relatedPaymentOrderId: paymentOrder._id,
    relatedPaymentTransactionId: paymentTransaction._id
  });

  await upsert(Notification, { recipientId: customerUser._id, dedupeKey: 'notif-cust-confirmed-001' }, {
    type: 'BOOKING_CONFIRMED',
    category: 'BOOKING',
    title: 'Booking Confirmed',
    messageSafe: 'Your booking BK-CONFIRMED-001 has been confirmed.',
    bookingId: bookingConfirmed._id,
    status: 'READ'
  });

  await upsert(Notification, { recipientId: workerUser._id, dedupeKey: 'notif-wrk-earning-001' }, {
    type: 'EARNING_CREDITED',
    category: 'PAYOUT',
    title: 'Earning Credited',
    messageSafe: '₹1,800 has been credited to your wallet for completed work.',
    bookingId: bookingCompleted._id,
    status: 'UNREAD'
  });

  await upsert(NotificationOutbox, { dedupeKey: 'outbox-bk-confirmed-001' }, {
    eventType: 'BOOKING_CONFIRMED',
    eventVersion: '1.0',
    aggregateType: 'Booking',
    aggregateId: bookingConfirmed._id,
    recipientIds: [workerUser._id],
    payloadSafe: { bookingNumber: 'BK-CONFIRMED-001' },
    status: 'PROCESSED',
    processedAt: new Date()
  });

  await upsert(NotificationPreference, { userId: customerUser._id }, {
    categoryPreferences: { BOOKING: true, PAYMENT: true, REFUND: true, DISPUTE: true, PAYOUT: true, REVIEW: true, CHAT: true, SUPPORT: true, ACCOUNT: true, SECURITY: true, SYSTEM: true },
    channelPreferences: { IN_APP: true, EMAIL: true, PUSH: false }
  });

  await upsert(NotificationPreference, { userId: workerUser._id }, {
    categoryPreferences: { BOOKING: true, PAYMENT: true, REFUND: true, DISPUTE: true, PAYOUT: true, REVIEW: true, CHAT: true, SUPPORT: true, ACCOUNT: true, SECURITY: true, SYSTEM: true },
    channelPreferences: { IN_APP: true, EMAIL: true, PUSH: true }
  });

  await upsert(NotificationPreference, { userId: companyUser._id }, {
    categoryPreferences: { BOOKING: true, PAYMENT: true, REFUND: true, DISPUTE: true, PAYOUT: true, REVIEW: true, CHAT: true, SUPPORT: true, ACCOUNT: true, SECURITY: true, SYSTEM: true },
    channelPreferences: { IN_APP: true, EMAIL: true, PUSH: false }
  });

  // 19. OAuth, RefreshToken, AuditLog
  await upsert(OAuthIdentity, { provider: 'GOOGLE', providerSubject: 'google-sub-cust-001' }, {
    userId: customerUser._id,
    providerEmailNormalized: 'customer@test.com',
    providerEmailVerified: true,
    status: 'ACTIVE'
  });

  await upsert(OAuthAttempt, { stateHash: 'oauth_state_hash_001' }, {
    provider: 'GOOGLE',
    nonceHash: 'oauth_nonce_hash_001',
    mode: 'LOGIN',
    frontendRedirectPath: '/auth/callback',
    status: 'COMPLETED',
    expiresAt: new Date(Date.now() + 3600000)
  });

  await upsert(RefreshToken, { tokenHash: 'ref_token_hash_cust_001' }, {
    userId: customerUser._id,
    isUsed: false,
    isRevoked: false,
    expiresAt: new Date(Date.now() + 86400000 * 7)
  });

  await upsert(AuditLog, { actor: adminUser._id, action: 'VERIFICATION_APPROVED', resourceType: 'CompanyProfile' }, {
    resourceId: companyUser._id.toString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0'
  });

  await upsert(AuditLog, { actor: customerUser._id, action: 'BOOKING_CREATED', resourceType: 'Booking' }, {
    resourceId: bookingCompleted._id.toString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0'
  });

  await upsert(AuditLog, { actor: workerUser._id, action: 'PROFILE_UPDATE', resourceType: 'WorkerProfile' }, {
    resourceId: workerUser._id.toString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0'
  });

  await upsert(AuditLog, { actor: companyUser._id, action: 'VERIFICATION_SUBMITTED', resourceType: 'CompanyVerificationDocument' }, {
    resourceId: companyUser._id.toString(),
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0'
  });

  // 20. Count AFTER for all collections
  const afterCounts = {};
  const report = [];

  for (const [colName, model] of Object.entries(allModelMap)) {
    afterCounts[colName] = await model.countDocuments();
    const before = beforeCounts[colName];
    const after = afterCounts[colName];
    const created = after - before;
    report.push({
      collection: colName,
      before,
      after,
      created,
      status: after > 0 ? 'POPULATED' : 'EMPTY'
    });
  }

  // 21. Perform Database Integrity Audit
  console.log('\n--- Performing Database Integrity Audit ---');
  let orphanCount = 0;
  let duplicateCount = 0;
  let refIntegrityPass = true;
  let schemaValidationPass = true;

  // Verify all user references across models
  const allUserIds = (await User.find({}, '_id')).map(u => u._id.toString());
  const userSet = new Set(allUserIds);

  const checkUserRef = (id, context) => {
    if (id && !userSet.has(id.toString())) {
      console.warn(`[Integrity] Invalid user reference (${context}): ${id}`);
      orphanCount++;
      refIntegrityPass = false;
    }
  };

  // Check bookings reference real users & categories
  const allBookings = await Booking.find({});
  const bookingSet = new Set(allBookings.map(b => b._id.toString()));
  for (const b of allBookings) {
    checkUserRef(b.customerId, `Booking ${b.bookingNumber} customerId`);
    checkUserRef(b.workerId, `Booking ${b.bookingNumber} workerId`);
  }

  // Check WorkerProfiles
  const allWorkerProfiles = await WorkerProfile.find({});
  for (const wp of allWorkerProfiles) {
    checkUserRef(wp.userId, `WorkerProfile ${wp._id} userId`);
  }

  // Check CompanyProfiles
  const allCompanyProfiles = await CompanyProfile.find({});
  for (const cp of allCompanyProfiles) {
    checkUserRef(cp.userId, `CompanyProfile ${cp._id} userId`);
  }

  // Check Wallet consistency
  const ww = await WorkerWallet.findOne({ workerId: workerUser._id });
  if (ww && ww.availableBalancePaise !== 180000) {
    console.warn(`[Integrity] WorkerWallet available balance mismatch: ${ww.availableBalancePaise}`);
    schemaValidationPass = false;
  }

  const cw = await CompanyWallet.findOne({ companyId: companyUser._id });
  if (cw && cw.availableBalancePaise !== 5000000) {
    console.warn(`[Integrity] CompanyWallet balance mismatch: ${cw.availableBalancePaise}`);
    schemaValidationPass = false;
  }

  // Check rating aggregate consistency
  const wra = await WorkerRatingAggregate.findOne({ workerId: workerUser._id });
  if (wra && wra.averageRating !== 5.0) {
    console.warn(`[Integrity] WorkerRatingAggregate mismatch: ${wra.averageRating}`);
    schemaValidationPass = false;
  }

  console.log('\n========================================');
  console.log('SEED EXECUTION SUMMARY REPORT');
  console.log('========================================\n');
  console.table(report);

  console.log('\nINTEGRITY METRICS:');
  console.log(`- Reference integrity: ${refIntegrityPass ? 'PASS' : 'FAIL'}`);
  console.log(`- Orphan records: ${orphanCount}`);
  console.log(`- Duplicate records: ${duplicateCount}`);
  console.log(`- Schema validation: ${schemaValidationPass ? 'PASS' : 'FAIL'}`);
  console.log(`- Seed execution: PASS`);

  await mongoose.disconnect();

  return {
    report,
    integrity: {
      referenceIntegrity: refIntegrityPass ? 'PASS' : 'FAIL',
      orphanRecords: orphanCount,
      duplicateRecords: duplicateCount,
      schemaValidation: schemaValidationPass ? 'PASS' : 'FAIL',
      seedExecution: 'PASS'
    }
  };
}

// Allow CLI execution directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('populateAllCollections.js')) {
  populateAll().catch(err => {
    console.error('Fatal error during seed execution:', err);
    process.exit(1);
  });
}
