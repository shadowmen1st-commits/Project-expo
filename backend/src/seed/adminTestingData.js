import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import WorkerProfile from '../models/WorkerProfile.js';
import Booking from '../models/Booking.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import PaymentOrder from '../models/PaymentOrder.js';
import WorkerWallet from '../models/WorkerWallet.js';
import WalletLedger from '../models/WalletLedger.js';
import WorkerPayout from '../models/WorkerPayout.js';
import WorkerPayoutAccount from '../models/WorkerPayoutAccount.js';
import DisputeCase from '../models/DisputeCase.js';
import Refund from '../models/Refund.js';
import SupportTicket from '../models/SupportTicket.js';
import Notification from '../models/Notification.js';
import Review from '../models/Review.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationDocument from '../models/VerificationDocument.js';
import LedgerAccount from '../models/LedgerAccount.js';
import LedgerTransaction from '../models/LedgerTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import AuditLog from '../models/AuditLog.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import CommissionRule from '../models/CommissionRule.js';
import MessageReport from '../models/MessageReport.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_marketplace';

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const runSeed = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.');

        // Passwords
        const adminPass = await hashPassword('Admin@123');
        const customerPass = await hashPassword('Customer@123');
        const workerPass = await hashPassword('Worker@123');

        // Helper to find or create User
        const getOrCreateUser = async (data) => {
            let user = await User.findOne({ email: data.email });
            if (!user) {
                user = await User.create(data);
                console.log(`👤 User created: ${data.email}`);
            }
            return user;
        };

        // 1. Get/Create Users
        const admin = await getOrCreateUser({
            name: 'Admin User',
            email: 'admin@test.com',
            phone: '9876543210',
            passwordHash: adminPass,
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        const customer1 = await getOrCreateUser({
            name: 'John Customer',
            email: 'customer1@test.com',
            phone: '9876543211',
            passwordHash: customerPass,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        const worker1 = await getOrCreateUser({
            name: 'Rahul Sharma',
            email: 'worker1@test.com',
            phone: '9876543212',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        const worker2 = await getOrCreateUser({
            name: 'Amit Kumar',
            email: 'worker2@test.com',
            phone: '9876543213',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        const worker3 = await getOrCreateUser({
            name: 'Suresh Singh',
            email: 'worker3@test.com',
            phone: '9876543214',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        // Ensure Service Categories exist
        const getOrCreateCategory = async (name, slug) => {
            let cat = await ServiceCategory.findOne({ slug });
            if (!cat) {
                cat = await ServiceCategory.create({
                    name,
                    slug,
                    description: `${name} services`,
                    icon: 'Home',
                    defaultCommission: 10,
                });
            }
            return cat;
        };

        const catCleaning = await getOrCreateCategory('Home Cleaning', 'home-cleaning');

        // Ensure Worker Profiles exist
        const getOrCreateProfile = async (userId, fullName, status) => {
            let prof = await WorkerProfile.findOne({ userId });
            if (!prof) {
                prof = await WorkerProfile.create({
                    userId,
                    fullName,
                    primaryServiceCategoryId: catCleaning._id,
                    serviceCategoryIds: [catCleaning._id],
                    verificationStatus: status,
                    hourlyRate: 35000,
                    dailyRate: 250000,
                    isOnline: true,
                    isPubliclyVisible: status === 'APPROVED',
                });
            }
            return prof;
        };

        await getOrCreateProfile(worker1._id, 'Rahul Sharma', 'APPROVED');
        await getOrCreateProfile(worker2._id, 'Amit Kumar', 'REJECTED');
        await getOrCreateProfile(worker3._id, 'Suresh Singh', 'PENDING_APPROVAL');

        // ----------------- 1. PAYOUT APPROVALS -----------------
        const getOrCreatePayoutAccount = async (workerId, name, fingerprint) => {
            let acct = await WorkerPayoutAccount.findOne({ workerId, fingerprint });
            if (!acct) {
                acct = await WorkerPayoutAccount.create({
                    workerId,
                    accountType: 'BANK_ACCOUNT',
                    displayName: name,
                    beneficiaryName: name,
                    accountNumberLast4: '9999',
                    bankName: 'SBI',
                    fingerprint,
                });
            }
            return acct;
        };

        const pa1 = await getOrCreatePayoutAccount(worker1._id, 'Rahul Sharma', 'fp-rahul-9999');
        const pa2 = await getOrCreatePayoutAccount(worker2._id, 'Amit Kumar', 'fp-amit-9999');

        const createPayout = async (payoutNumber, workerId, payoutAccountId, amountPaise, status, reason = '') => {
            let po = await WorkerPayout.findOne({ payoutNumber });
            if (!po) {
                po = await WorkerPayout.create({
                    payoutNumber,
                    workerId,
                    payoutAccountId,
                    amountPaise,
                    status,
                    mode: 'IMPS',
                    idempotencyKey: `idem-${payoutNumber}`,
                    requestFingerprint: `req-${payoutNumber}`,
                    rejectionReasonSafe: reason || undefined,
                    approvedBy: status === 'APPROVED' ? admin._id : undefined,
                    rejectedBy: status === 'REJECTED' ? admin._id : undefined,
                });
            }
            return po;
        };

        await createPayout('PW-ADM-101', worker1._id, pa1._id, 250000, 'PENDING');
        await createPayout('PW-ADM-102', worker2._id, pa2._id, 500000, 'PENDING');
        await createPayout('PW-ADM-103', worker1._id, pa1._id, 150000, 'APPROVED');
        await createPayout('PW-ADM-104', worker2._id, pa2._id, 100000, 'REJECTED', 'Bank verification failed');

        // ----------------- 2. SYSTEM AUDIT LOGS -----------------
        const createAuditLog = async (action, resourceType, resourceId, desc) => {
            await AuditLog.create({
                actor: admin._id,
                action,
                resourceType,
                resourceId,
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                beforeSnapshot: {},
                afterSnapshot: { status: desc },
            });
        };

        await AuditLog.deleteMany({ actor: admin._id }); // refresh audit logs
        const actions = ['LOGIN', 'WORKER_APPROVED', 'PAYOUT_APPROVED', 'BOOKING_CANCELLED', 'REFUND_CREATED', 'COMMISSION_UPDATED'];
        for (let i = 1; i <= 22; i++) {
            const act = actions[i % actions.length];
            await createAuditLog(act, 'User', admin._id.toString(), `Admin test audit log entry #${i}`);
        }

        // ----------------- 3. PLATFORM LEDGER DATA -----------------
        const createLedgerAccount = async (code, name, type, normal) => {
            let acct = await LedgerAccount.findOne({ code });
            if (!acct) {
                acct = await LedgerAccount.create({
                    accountNumber: `LA-${code}`,
                    code,
                    name,
                    accountType: type,
                    normalBalance: normal,
                    ownerType: 'PLATFORM',
                });
            }
            return acct;
        };

        const acctAsset = await createLedgerAccount('CASH', 'Cash Account', 'ASSET', 'DEBIT');

        const createLedgerEntry = async (txNumber, type, amountPaise) => {
            let tx = await LedgerTransaction.findOne({ transactionNumber: txNumber });
            if (!tx) {
                tx = await LedgerTransaction.create({
                    transactionNumber: txNumber,
                    transactionType: type === 'CREDIT' ? 'PAYMENT_CAPTURED' : type === 'DEBIT' ? 'WORKER_PAYOUT_RELEASE' : type === 'COMMISSION' ? 'BOOKING_COMPLETION_ALLOCATION' : 'REFUND_PROCESSED',
                    status: 'POSTED',
                    businessEvent: type,
                    idempotencyKey: `idem-${txNumber}`,
                    totalDebitPaise: amountPaise,
                    totalCreditPaise: amountPaise,
                });

                await LedgerEntry.create({
                    ledgerTransactionId: tx._id,
                    lineNumber: 1,
                    accountId: acctAsset._id,
                    direction: type === 'CREDIT' || type === 'COMMISSION' ? 'CREDIT' : 'DEBIT',
                    amountPaise,
                    balanceBeforePaise: 0,
                    balanceAfterPaise: amountPaise,
                });
            }
        };

        const ledgerTypes = ['CREDIT', 'COMMISSION', 'DEBIT', 'REFUND'];
        const ledgerAmounts = [100000, 15000, 85000, 50000];
        for (let i = 1; i <= 16; i++) {
            const typeIdx = i % ledgerTypes.length;
            await createLedgerEntry(`LT-ADM-TX${i}`, ledgerTypes[typeIdx], ledgerAmounts[typeIdx]);
        }

        // ----------------- 4. REVIEW MODERATION DATA -----------------
        const getOrCreateBooking = async (bookingNumber, customerId, workerId, serviceCategoryId) => {
            let booking = await Booking.findOne({ bookingNumber });
            if (!booking) {
                booking = await Booking.create({
                    bookingNumber,
                    customerId,
                    workerId,
                    serviceCategoryId,
                    serviceAddress: '123 Admin St',
                    scheduledStart: new Date(),
                    scheduledEnd: new Date(),
                    durationMinutes: 60,
                    pricingType: 'HOURLY',
                    baseAmount: 30000,
                    platformFee: 5000,
                    taxAmount: 5400,
                    totalAmount: 40400,
                    commissionPercentage: 10,
                    commissionAmount: 3000,
                    workerEarning: 27000,
                    bookingStatus: 'COMPLETED',
                    paymentStatus: 'PAID',
                    escrowStatus: 'RELEASED',
                });
            }
            return booking;
        };

        const b1 = await getOrCreateBooking('BK-ADM-DATA1', customer1._id, worker1._id, catCleaning._id);
        const b2 = await getOrCreateBooking('BK-ADM-DATA2', customer1._id, worker1._id, catCleaning._id);
        const b3 = await getOrCreateBooking('BK-ADM-DATA3', customer1._id, worker1._id, catCleaning._id);

        const createReview = async (booking, comment, rating, status, moderationStatus) => {
            let rev = await Review.findOne({ comment });
            if (!rev && booking) {
                rev = await Review.create({
                    bookingId: booking._id,
                    serviceCategoryId: catCleaning._id,
                    reviewerId: customer1._id,
                    revieweeId: worker1._id,
                    workerId: worker1._id,
                    customerId: customer1._id,
                    rating,
                    comment,
                    status,
                    moderationStatus,
                    bookingCompletedAt: new Date(),
                    idempotencyKey: `idem-${crypto.randomBytes(4).toString('hex')}`,
                    requestFingerprint: 'req-fp-rev-adm',
                    editWindowExpiresAt: new Date(),
                    eligibilitySnapshot: {
                        bookingId: booking._id,
                        reviewerRole: 'CUSTOMER',
                        reviewDirection: 'CUSTOMER_TO_WORKER',
                    },
                    policySnapshot: {},
                });
            }
        };

        await createReview(b1, 'Excellent service', 5, 'PUBLISHED', 'APPROVED');
        await createReview(b2, 'Bad service complaint', 1, 'PENDING_MODERATION', 'UNDER_REVIEW');
        await createReview(b3, 'Spam review', 2, 'HIDDEN', 'FLAGGED');

        // ----------------- 5. SUPPORT OPERATIONS DATA -----------------
        const createSupportTicket = async (ticketNumber, requesterId, category, message, priority, status) => {
            let tk = await SupportTicket.findOne({ ticketNumber });
            if (!tk) {
                tk = await SupportTicket.create({
                    ticketNumber,
                    requesterId,
                    requesterRole: 'CUSTOMER',
                    category,
                    subjectSafe: message.substring(0, 100),
                    descriptionSafe: message,
                    priority,
                    status,
                });
            }
        };

        await createSupportTicket('ST-DATA-1', customer1._id, 'PAYMENT', 'Payment deducted but booking failed', 'HIGH', 'OPEN');
        await createSupportTicket('ST-DATA-2', worker1._id, 'PAYOUT', 'Worker withdrawal pending', 'NORMAL', 'IN_PROGRESS');
        await createSupportTicket('ST-DATA-3', customer1._id, 'REFUND', 'Refund issue', 'LOW', 'RESOLVED');

        for (let i = 4; i <= 12; i++) {
            await createSupportTicket(`ST-DATA-${i}`, customer1._id, 'PAYMENT', `Additional support ticket issue #${i}`, 'LOW', 'RESOLVED');
        }

        // ----------------- 6. CHAT MODERATION DATA -----------------
        const createChat = async (cust, work, textMsg1, textMsg2, moderationStatus, flagReason, reasonCode) => {
            let conv = await Conversation.create({
                customerId: cust._id,
                workerId: work._id,
                participantIds: [cust._id, work._id],
                conversationType: 'SUPPORT_LINKED',
                status: moderationStatus === 'FLAGGED' ? 'RESTRICTED' : 'ACTIVE',
            });

            const m1 = await Message.create({
                conversationId: conv._id,
                senderId: cust._id,
                senderRole: 'CUSTOMER',
                bodySafe: textMsg1,
                sequenceNumber: 1,
                moderationStatus: moderationStatus === 'FLAGGED' ? 'FLAGGED' : 'CLEAR',
                metadataSafe: flagReason ? { flaggedReason: flagReason } : {},
            });

            await Message.create({
                conversationId: conv._id,
                senderId: work._id,
                senderRole: 'WORKER',
                bodySafe: textMsg2,
                sequenceNumber: 2,
                moderationStatus: moderationStatus === 'FLAGGED' ? 'FLAGGED' : 'CLEAR',
                metadataSafe: flagReason ? { flaggedReason: flagReason } : {},
            });

            if (moderationStatus === 'FLAGGED' || moderationStatus === 'REPORTED') {
                await MessageReport.create({
                    messageId: m1._id,
                    conversationId: conv._id,
                    reporterId: work._id,
                    reportedUserId: cust._id,
                    reasonCode: reasonCode || 'ABUSE',
                    descriptionSafe: 'User reported for language/spam.',
                    status: 'OPEN',
                });
            }
        };

        await createChat(customer1, worker1, 'Need home cleaning service', 'Okay, I will arrive at 10 AM', 'CLEAR', '', '');
        await createChat(customer1, worker2, 'Abusive language detected', 'Abusing user warning', 'FLAGGED', 'HARASSMENT', 'HARASSMENT');
        await createChat(customer1, worker3, 'Spam message', 'Worker reported spam offer', 'REPORTED', 'SPAM', 'SPAM');

        // Create remaining chat reports/messages
        for (let i = 4; i <= 16; i++) {
            const tempWorker = await User.create({
                name: `Temp Worker ${i}`,
                email: `tempworker${i}@test.com`,
                phone: `99999990${i}`,
                passwordHash: workerPass,
                role: 'WORKER',
                status: 'ACTIVE',
            });
            await createChat(customer1, tempWorker, `Regular query text ${i}`, 'Replying standard response', 'CLEAR', '', '');
        }

        // ----------------- 7. COMMISSION RULES -----------------
        const createCommissionRule = async (name, scope, bps) => {
            let rule = await CommissionRule.findOne({ name });
            if (!rule) {
                rule = await CommissionRule.create({
                    name,
                    scope,
                    calculationType: 'PERCENTAGE',
                    percentageBps: bps,
                    priority: 2,
                    effectiveFrom: new Date(),
                    isActive: true,
                    status: 'ACTIVE',
                });
            }
        };

        await createCommissionRule('Default Commission', 'GLOBAL', 1000); // 10%
        await createCommissionRule('Cleaning Commission', 'CATEGORY', 1500); // 15%
        await createCommissionRule('Premium Worker', 'WORKER', 800); // 8%

        // ----------------- 8. VERIFICATION QUEUE -----------------
        const docPending = await VerificationDocument.findOne({ workerId: worker3._id });
        if (!docPending) {
            const doc = await VerificationDocument.create({
                workerId: worker3._id,
                documentType: 'AADHAAR',
                documentNumberEncrypted: 'enc_aadhaar_3',
                documentNumberLast4: '3333',
                frontFile: 'https://mock-s3.com/aadhaar3-front.jpg',
                fileMimeType: 'image/jpeg',
                fileSize: 102400,
                verificationStatus: 'PENDING_REVIEW',
            });
            await VerificationSubmission.create({
                workerId: worker3._id,
                submissionNumber: 1,
                profileSnapshot: {},
                serviceSnapshot: {},
                documentIds: [doc._id],
                declarationAccepted: true,
                consentAccepted: true,
                status: 'PENDING_APPROVAL',
                version: 1,
            });
        }

        const docApproved = await VerificationDocument.findOne({ workerId: worker1._id });
        if (!docApproved) {
            const doc = await VerificationDocument.create({
                workerId: worker1._id,
                documentType: 'AADHAAR',
                documentNumberEncrypted: 'enc_aadhaar_1',
                documentNumberLast4: '1111',
                frontFile: 'https://mock-s3.com/aadhaar1-front.jpg',
                fileMimeType: 'image/jpeg',
                fileSize: 102400,
                verificationStatus: 'APPROVED',
            });
            await VerificationSubmission.create({
                workerId: worker1._id,
                submissionNumber: 1,
                profileSnapshot: {},
                serviceSnapshot: {},
                documentIds: [doc._id],
                declarationAccepted: true,
                consentAccepted: true,
                status: 'APPROVED',
                version: 1,
            });
        }

        const docRejected = await VerificationDocument.findOne({ workerId: worker2._id });
        if (!docRejected) {
            const doc = await VerificationDocument.create({
                workerId: worker2._id,
                documentType: 'PAN',
                documentNumberEncrypted: 'enc_pan_2',
                documentNumberLast4: '2222',
                frontFile: 'https://mock-s3.com/pan2-front.jpg',
                fileMimeType: 'image/jpeg',
                fileSize: 102400,
                verificationStatus: 'REJECTED',
                reviewComment: 'Invalid details provided',
            });
            await VerificationSubmission.create({
                workerId: worker2._id,
                submissionNumber: 1,
                profileSnapshot: {},
                serviceSnapshot: {},
                documentIds: [doc._id],
                declarationAccepted: true,
                consentAccepted: true,
                status: 'REJECTED',
                finalComment: 'Rejected by admin panel seed',
                version: 1,
            });
        }

        console.log('\n============================');
        console.log('ADMIN DATA SEEDED SUCCESS');
        console.log('============================\n');

        console.log('Payouts: OK');
        console.log('Audit Logs: OK');
        console.log('Ledger: OK');
        console.log('Reviews: OK');
        console.log('Support: OK');
        console.log('Chats: OK');
        console.log('Commission: OK');
        console.log('Verification: OK\n');

        process.exit(0);
    } catch (err) {
        console.error('Admin testing data Seeding error:', err);
        process.exit(1);
    }
};

runSeed();
