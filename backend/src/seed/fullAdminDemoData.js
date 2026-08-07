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

        const customer = await getOrCreateUser({
            name: 'John Customer',
            email: 'customer@test.com',
            phone: '9876543211',
            passwordHash: customerPass,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        const worker = await getOrCreateUser({
            name: 'Rahul Worker',
            email: 'worker@test.com',
            phone: '9876543212',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
        });

        // Other dummy users to avoid duplicate keys in verification / reviews / support
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

        await getOrCreateProfile(worker._id, 'Rahul Worker', 'APPROVED');
        await getOrCreateProfile(worker2._id, 'Amit Kumar', 'REJECTED');
        await getOrCreateProfile(worker3._id, 'Suresh Singh', 'PENDING_APPROVAL');

        // ----------------- BOOKINGS SEEDING (13 Bookings) -----------------
        // 5 Completed, 3 Active, 3 Cancelled, 2 Payment Pending
        const createBooking = async (bookingNumber, status, paymentStatus) => {
            let bk = await Booking.findOne({ bookingNumber });
            if (!bk) {
                bk = await Booking.create({
                    bookingNumber,
                    customerId: customer._id,
                    workerId: worker._id,
                    serviceCategoryId: catCleaning._id,
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
                    bookingStatus: status,
                    paymentStatus: paymentStatus,
                    escrowStatus: status === 'COMPLETED' ? 'RELEASED' : 'HELD',
                });
            }
            return bk;
        };

        const bookings = [];
        for (let i = 1; i <= 5; i++) bookings.push(await createBooking(`BK-DEMO-C${i}`, 'COMPLETED', 'PAID'));
        for (let i = 1; i <= 3; i++) bookings.push(await createBooking(`BK-DEMO-A${i}`, 'ACCEPTED', 'PAID'));
        for (let i = 1; i <= 3; i++) bookings.push(await createBooking(`BK-DEMO-X${i}`, 'CANCELLED', 'PAID'));
        for (let i = 1; i <= 2; i++) bookings.push(await createBooking(`BK-DEMO-P${i}`, 'PAYMENT_PENDING', 'PENDING'));

        // ----------------- PAYMENTS SEEDING (10 Payments) -----------------
        // Successful, Pending, Failed, Refund
        // Amounts: 500, 1200, 2500, 5000
        const createPayment = async (orderId, amountPaise, status, bookingId) => {
            let order = await PaymentOrder.findOne({ idempotencyKey: `idem-${orderId}` });
            if (!order) {
                order = await PaymentOrder.create({
                    providerOrderId: orderId,
                    amountPaise,
                    currency: 'INR',
                    bookingId,
                    customerId: customer._id,
                    status: status === 'SUCCESSFUL' ? 'PAID' : status === 'FAILED' ? 'FAILED' : 'CREATED',
                    expiresAt: new Date(Date.now() + 3600000),
                    idempotencyKey: `idem-${orderId}`,
                    bookingAmountSnapshot: {
                        baseAmount: amountPaise,
                        platformFee: 0,
                        taxAmount: 0,
                        totalAmount: amountPaise,
                    },
                });

                if (status === 'SUCCESSFUL') {
                    await PaymentTransaction.create({
                        paymentOrderId: order._id,
                        bookingId,
                        customerId: customer._id,
                        amountPaise,
                        status: 'CAPTURED',
                        idempotencyKey: `idem-tx-${orderId}`,
                        providerPaymentId: `pay_gw_${orderId}`,
                    });
                } else if (status === 'REFUNDED') {
                    await PaymentTransaction.create({
                        paymentOrderId: order._id,
                        bookingId,
                        customerId: customer._id,
                        amountPaise,
                        status: 'REVERSED',
                        idempotencyKey: `idem-tx-${orderId}`,
                        providerPaymentId: `pay_gw_${orderId}`,
                    });
                }
            }
        };

        const paymentAmounts = [50000, 120000, 250000, 500000];
        const paymentStatuses = ['SUCCESSFUL', 'PENDING', 'FAILED', 'REFUNDED'];
        for (let i = 1; i <= 10; i++) {
            const bIdx = i % bookings.length;
            await createPayment(`PAY-DEMO-${i}`, paymentAmounts[i % 4], paymentStatuses[i % 4], bookings[bIdx]._id);
        }

        // ----------------- PAYOUT REQUEST DATA (10 Payouts) -----------------
        const getOrCreatePayoutAccount = async (workerId, name, fingerprint) => {
            let acct = await WorkerPayoutAccount.findOne({ fingerprint });
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

        const pa1 = await getOrCreatePayoutAccount(worker._id, 'Rahul Worker', 'fp-rahul-9999');
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

        const payoutStatuses = ['PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'REJECTED', 'APPROVED', 'PENDING', 'APPROVED', 'REJECTED'];
        for (let i = 1; i <= 10; i++) {
            const status = payoutStatuses[i - 1];
            await createPayout(`PW-DEMO-${i}`, i % 2 === 0 ? worker._id : worker2._id, i % 2 === 0 ? pa1._id : pa2._id, 250000, status, status === 'REJECTED' ? 'Bank verification failed' : '');
        }

        // ----------------- SYSTEM AUDIT LOG DATA (30 Logs) -----------------
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
        const auditActions = ['LOGIN', 'LOGOUT', 'BOOKING_CREATED', 'BOOKING_CANCELLED', 'PAYMENT_SUCCESS', 'REFUND_CREATED', 'WORKER_APPROVED', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'ADMIN_ACTION'];
        for (let i = 1; i <= 30; i++) {
            const act = auditActions[i % auditActions.length];
            await createAuditLog(act, 'User', admin._id.toString(), `Admin test audit log entry #${i}`);
        }

        // ----------------- PLATFORM LEDGER DATA (20 entries) -----------------
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

        const ledgerAcctAsset = await createLedgerAccount('CASH', 'Cash Account', 'ASSET', 'DEBIT');

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
                    accountId: ledgerAcctAsset._id,
                    direction: type === 'CREDIT' || type === 'COMMISSION' ? 'CREDIT' : 'DEBIT',
                    amountPaise,
                    balanceBeforePaise: 0,
                    balanceAfterPaise: amountPaise,
                });
            }
        };

        const ledgerTypes = ['CREDIT', 'COMMISSION', 'DEBIT', 'REFUND'];
        const ledgerAmounts = [100000, 15000, 85000, 50000];
        for (let i = 1; i <= 20; i++) {
            const typeIdx = i % ledgerTypes.length;
            await createLedgerEntry(`LT-DEMO-TX${i}`, ledgerTypes[typeIdx], ledgerAmounts[typeIdx]);
        }

        // ----------------- REVIEW MODERATION (15 Reviews) -----------------
        const createReview = async (booking, comment, rating, status, moderationStatus) => {
            let rev = await Review.findOne({ comment });
            if (!rev && booking) {
                rev = await Review.create({
                    bookingId: booking._id,
                    serviceCategoryId: catCleaning._id,
                    reviewerId: customer._id,
                    revieweeId: worker._id,
                    workerId: worker._id,
                    customerId: customer._id,
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

        const reviewStatuses = ['APPROVED', 'PENDING', 'FLAGGED'];
        for (let i = 1; i <= 15; i++) {
            const status = reviewStatuses[i % 3];
            const revBooking = await createBooking(`BK-DEMO-REV${i}`, 'COMPLETED', 'PAID');
            await createReview(
                revBooking,
                `Review Comment #${i} - ${status}`,
                (i % 5) + 1,
                status === 'APPROVED' ? 'PUBLISHED' : status === 'FLAGGED' ? 'HIDDEN' : 'PENDING_MODERATION',
                status === 'APPROVED' ? 'APPROVED' : status === 'FLAGGED' ? 'FLAGGED' : 'UNDER_REVIEW'
            );
        }

        // ----------------- SUPPORT OPERATIONS (15 Tickets) -----------------
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

        const ticketPriorities = ['HIGH', 'NORMAL', 'LOW'];
        const ticketStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        for (let i = 1; i <= 15; i++) {
            await createSupportTicket(
                `ST-DEMO-${i}`,
                customer._id,
                'PAYMENT',
                `Support ticket issue #${i}`,
                ticketPriorities[i % 3],
                ticketStatuses[i % 4]
            );
        }

        // ----------------- CHAT MODERATION (20 Chat Reports) -----------------
        const createChatReport = async (cust, work, textMsg1, textMsg2, moderationStatus, flagReason, reasonCode) => {
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

        const chatModerationStatuses = ['SAFE', 'FLAGGED', 'REPORTED'];
        for (let i = 1; i <= 20; i++) {
            const status = chatModerationStatuses[i % 3];
            await createChatReport(
                customer,
                worker,
                `Message text #${i} - ${status}`,
                `Replying response #${i}`,
                status === 'SAFE' ? 'CLEAR' : status === 'FLAGGED' ? 'FLAGGED' : 'REPORTED',
                status === 'FLAGGED' ? 'Abusive language' : '',
                status === 'FLAGGED' ? 'HARASSMENT' : 'SPAM'
            );
        }

        // ----------------- COMMISSION RULES -----------------
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

        await createCommissionRule('Default Commission', 'GLOBAL', 1000);
        await createCommissionRule('Cleaning Commission', 'CATEGORY', 1500);
        await createCommissionRule('Premium Worker', 'WORKER', 800);

        console.log('\n================================');
        console.log('ADMIN DEMO DATA CREATED');
        console.log('================================\n');

        console.log('Payouts: 10');
        console.log('Bookings: 13');
        console.log('Payments: 10');
        console.log('Ledger: 20');
        console.log('Audit Logs: 30');
        console.log('Reviews: 15');
        console.log('Support Tickets: 15');
        console.log('Chat Reports: 20\n');

        process.exit(0);
    } catch (err) {
        console.error('Admin demo data Seeding error:', err);
        process.exit(1);
    }
};

runSeed();
