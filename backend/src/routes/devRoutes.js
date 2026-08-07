import { Router } from 'express';
import bcrypt from 'bcryptjs';
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
import crypto from 'crypto';

const router = Router();

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const CATEGORIES_DATA = [
    { name: 'Home Cleaning', slug: 'home-cleaning', description: 'Deep cleaning and dusting for homes.', icon: 'Home', defaultCommission: 10 },
    { name: 'AC Repair', slug: 'ac-repair', description: 'Air conditioner servicing and maintenance.', icon: 'Wind', defaultCommission: 12 },
    { name: 'Electrician', slug: 'electrician', description: 'Electrical repairs, wiring, and fixing.', icon: 'Zap', defaultCommission: 12 },
    { name: 'Plumber', slug: 'plumber', description: 'Plumbing services and pipe leak fixes.', icon: 'Wrench', defaultCommission: 10 },
    { name: 'Gardening', slug: 'gardening', description: 'Lawn care and plant upkeep.', icon: 'Flower', defaultCommission: 8 },
    { name: 'Senior Care', slug: 'senior-care', description: 'Attendant service for seniors.', icon: 'Heart', defaultCommission: 15 },
    { name: 'Driver Service', slug: 'driver-service', description: 'Reliable private driver services.', icon: 'Car', defaultCommission: 12 },
];

router.post('/seed', async (req, res, next) => {
    try {
        console.log('Starting full DB Seeding via API...');

        // 1. Clear existing documents for seeding idempotency
        await User.deleteMany({});
        await ServiceCategory.deleteMany({});
        await WorkerProfile.deleteMany({});
        await Booking.deleteMany({});
        await PaymentOrder.deleteMany({});
        await PaymentTransaction.deleteMany({});
        await WorkerWallet.deleteMany({});
        await WalletLedger.deleteMany({});
        await WorkerPayoutAccount.deleteMany({});
        await WorkerPayout.deleteMany({});
        await DisputeCase.deleteMany({});
        await Refund.deleteMany({});
        await SupportTicket.deleteMany({});
        await Notification.deleteMany({});
        await Review.deleteMany({});
        await VerificationSubmission.deleteMany({});
        await VerificationDocument.deleteMany({});
        await LedgerAccount.deleteMany({});
        await LedgerTransaction.deleteMany({});
        await LedgerEntry.deleteMany({});

        // Hash Passwords
        const adminPass = await hashPassword('Admin@123');
        const customerPass = await hashPassword('Customer@123');
        const workerPass = await hashPassword('Worker@123');

        // ----------------- USERS -----------------
        const admin = await User.create({
            name: 'System Admin',
            email: 'admin@test.com',
            phone: '9999999900',
            passwordHash: adminPass,
            role: 'ADMIN',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
        });

        const customer1 = await User.create({
            name: 'John Customer',
            email: 'customer1@test.com',
            phone: '9999999901',
            passwordHash: customerPass,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
        });

        const customer2 = await User.create({
            name: 'Alice Customer',
            email: 'customer2@test.com',
            phone: '9999999902',
            passwordHash: customerPass,
            role: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
        });

        const workerUser1 = await User.create({
            name: 'Rahul Sharma',
            email: 'worker1@test.com',
            phone: '9999999903',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
        });

        const workerUser2 = await User.create({
            name: 'Amit Kumar',
            email: 'worker2@test.com',
            phone: '9999999904',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            authenticationMethods: ['PASSWORD'],
            primaryAuthenticationMethod: 'PASSWORD',
        });

        // ----------------- SERVICE CATEGORIES -----------------
        const categories = {};
        for (const data of CATEGORIES_DATA) {
            const cat = await ServiceCategory.create({
                ...data,
                requiredDocuments: ['AADHAAR', 'PAN'],
            });
            categories[data.slug] = cat;
        }

        // ----------------- WORKER PROFILES -----------------
        await WorkerProfile.create({
            userId: workerUser1._id,
            fullName: 'Rahul Sharma',
            phone: '9999999903',
            primaryServiceCategoryId: categories['home-cleaning']._id,
            serviceCategoryIds: [categories['home-cleaning']._id, categories['ac-repair']._id],
            skills: ['Cleaning', 'AC Repair'],
            languages: ['English', 'Hindi'],
            hourlyRate: 35000,
            dailyRate: 250000,
            yearsOfExperience: 5,
            averageRating: 4.8,
            ratingCount: 15,
            verificationStatus: 'APPROVED',
            verificationBadge: true,
            isOnline: true,
            isPubliclyVisible: true,
        });

        await WorkerProfile.create({
            userId: workerUser2._id,
            fullName: 'Amit Kumar',
            phone: '9999999904',
            primaryServiceCategoryId: categories['electrician']._id,
            serviceCategoryIds: [categories['electrician']._id, categories['plumber']._id],
            skills: ['Electrician', 'Plumbing'],
            languages: ['Hindi'],
            hourlyRate: 30000,
            dailyRate: 220000,
            yearsOfExperience: 3,
            averageRating: 4.5,
            ratingCount: 8,
            verificationStatus: 'APPROVED',
            verificationBadge: true,
            isOnline: true,
            isPubliclyVisible: true,
        });

        // ----------------- BOOKINGS -----------------
        const now = new Date();
        
        const bookingCompleted = await Booking.create({
            bookingNumber: 'BK-1001',
            customerId: customer1._id,
            workerId: workerUser1._id,
            serviceCategoryId: categories['home-cleaning']._id,
            serviceAddress: '123 Test Lane, Delhi',
            scheduledStart: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000),
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 70000,
            platformFee: 5000,
            taxAmount: 12600,
            totalAmount: 87600,
            commissionPercentage: 10,
            commissionAmount: 7000,
            workerEarning: 63000,
            bookingStatus: 'COMPLETED',
            paymentStatus: 'PAID',
            escrowStatus: 'RELEASED',
        });

        const bookingConfirmed = await Booking.create({
            bookingNumber: 'BK-1002',
            customerId: customer1._id,
            workerId: workerUser1._id,
            serviceCategoryId: categories['home-cleaning']._id,
            serviceAddress: '123 Test Lane, Delhi',
            scheduledStart: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000),
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 70000,
            platformFee: 5000,
            taxAmount: 12600,
            totalAmount: 87600,
            commissionPercentage: 10,
            commissionAmount: 7000,
            workerEarning: 63000,
            bookingStatus: 'CONFIRMED',
            paymentStatus: 'PAID',
            escrowStatus: 'FUNDED',
        });

        const bookingPending = await Booking.create({
            bookingNumber: 'BK-1003',
            customerId: customer2._id,
            workerId: workerUser2._id,
            serviceCategoryId: categories['electrician']._id,
            serviceAddress: '456 Sample Street, Noida',
            scheduledStart: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            durationMinutes: 60,
            pricingType: 'HOURLY',
            baseAmount: 30000,
            platformFee: 5000,
            taxAmount: 5400,
            totalAmount: 40400,
            commissionPercentage: 12,
            commissionAmount: 3600,
            workerEarning: 26400,
            bookingStatus: 'PAYMENT_PENDING',
            paymentStatus: 'PENDING',
            escrowStatus: 'NOT_FUNDED',
        });

        const bookingCancelled = await Booking.create({
            bookingNumber: 'BK-1004',
            customerId: customer1._id,
            workerId: workerUser2._id,
            serviceCategoryId: categories['plumber']._id,
            serviceAddress: '789 Ring Road, Gurgaon',
            scheduledStart: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
            durationMinutes: 60,
            pricingType: 'HOURLY',
            baseAmount: 30000,
            platformFee: 5000,
            taxAmount: 5400,
            totalAmount: 40400,
            commissionPercentage: 10,
            commissionAmount: 3000,
            workerEarning: 27000,
            bookingStatus: 'CANCELLED',
            paymentStatus: 'FAILED',
            escrowStatus: 'NOT_FUNDED',
            customerNotes: 'Customer cancelled',
        });

        const bookingRefund = await Booking.create({
            bookingNumber: 'BK-1005',
            customerId: customer2._id,
            workerId: workerUser1._id,
            serviceCategoryId: categories['home-cleaning']._id,
            serviceAddress: '456 Sample Street, Noida',
            scheduledStart: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000),
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 70000,
            platformFee: 5000,
            taxAmount: 12600,
            totalAmount: 87600,
            commissionPercentage: 10,
            commissionAmount: 7000,
            workerEarning: 63000,
            bookingStatus: 'CANCELLED',
            paymentStatus: 'PAID',
            escrowStatus: 'REFUND_PENDING',
        });

        // ----------------- PAYMENTS -----------------
        const poCompleted = await PaymentOrder.create({
            bookingId: bookingCompleted._id,
            customerId: customer1._id,
            provider: 'razorpay',
            providerOrderId: 'order_completed_dummy',
            providerReceipt: 'receipt_completed_dummy',
            status: 'PAID',
            amountPaise: bookingCompleted.totalAmount,
            bookingAmountSnapshot: { totalAmount: bookingCompleted.totalAmount },
            idempotencyKey: 'idem_po_completed',
            expiresAt: new Date(now.getTime() + 15 * 60000),
        });
        const ptCompleted = await PaymentTransaction.create({
            bookingId: bookingCompleted._id,
            paymentOrderId: poCompleted._id,
            customerId: customer1._id,
            provider: 'razorpay',
            providerOrderId: 'order_completed_dummy',
            providerPaymentId: 'pay_completed_dummy',
            amountPaise: 50000,
            status: 'CAPTURED',
            captured: true,
            idempotencyKey: 'idem_pt_completed',
        });

        const poPending = await PaymentOrder.create({
            bookingId: bookingPending._id,
            customerId: customer2._id,
            provider: 'razorpay',
            providerOrderId: 'order_pending_dummy',
            providerReceipt: 'receipt_pending_dummy',
            status: 'PROVIDER_ORDER_CREATED',
            amountPaise: bookingPending.totalAmount,
            bookingAmountSnapshot: { totalAmount: bookingPending.totalAmount },
            idempotencyKey: 'idem_po_pending',
            expiresAt: new Date(now.getTime() + 15 * 60000),
        });
        const ptPending = await PaymentTransaction.create({
            bookingId: bookingPending._id,
            paymentOrderId: poPending._id,
            customerId: customer2._id,
            provider: 'razorpay',
            providerOrderId: 'order_pending_dummy',
            providerPaymentId: 'pay_pending_dummy',
            amountPaise: 80000,
            status: 'INITIATED',
            captured: false,
            idempotencyKey: 'idem_pt_pending',
        });

        const poFailed = await PaymentOrder.create({
            bookingId: bookingCancelled._id,
            customerId: customer1._id,
            provider: 'razorpay',
            providerOrderId: 'order_failed_dummy',
            providerReceipt: 'receipt_failed_dummy',
            status: 'FAILED',
            amountPaise: bookingCancelled.totalAmount,
            bookingAmountSnapshot: { totalAmount: bookingCancelled.totalAmount },
            idempotencyKey: 'idem_po_failed',
            expiresAt: new Date(now.getTime() + 15 * 60000),
        });
        const ptFailed = await PaymentTransaction.create({
            bookingId: bookingCancelled._id,
            paymentOrderId: poFailed._id,
            customerId: customer1._id,
            provider: 'razorpay',
            providerOrderId: 'order_failed_dummy',
            providerPaymentId: 'pay_failed_dummy',
            amountPaise: 100000,
            status: 'FAILED',
            captured: false,
            idempotencyKey: 'idem_pt_failed',
        });

        const poRefund = await PaymentOrder.create({
            bookingId: bookingRefund._id,
            customerId: customer2._id,
            provider: 'razorpay',
            providerOrderId: 'order_refund_dummy',
            providerReceipt: 'receipt_refund_dummy',
            status: 'PAID',
            amountPaise: bookingRefund.totalAmount,
            bookingAmountSnapshot: { totalAmount: bookingRefund.totalAmount },
            idempotencyKey: 'idem_po_refund',
            expiresAt: new Date(now.getTime() + 15 * 60000),
        });
        const ptRefund = await PaymentTransaction.create({
            bookingId: bookingRefund._id,
            paymentOrderId: poRefund._id,
            customerId: customer2._id,
            provider: 'razorpay',
            providerOrderId: 'order_refund_dummy',
            providerPaymentId: 'pay_refund_dummy',
            amountPaise: 50000,
            status: 'CAPTURED',
            captured: true,
            idempotencyKey: 'idem_pt_refund',
        });

        // ----------------- WALLETS & TRANSACTIONS -----------------
        await WorkerWallet.create({
            workerId: customer1._id,
            currency: 'INR',
            availableBalancePaise: 500000,
        });

        await WorkerWallet.create({
            workerId: workerUser1._id,
            currency: 'INR',
            availableBalancePaise: 350000,
        });

        await WalletLedger.create({
            reference: 'TXN-001',
            userId: customer1._id,
            debitAccount: 'BANK',
            creditAccount: 'CUSTOMER_WALLET',
            amount: 500000,
            transactionType: 'DEPOSIT',
            status: 'COMPLETED',
            idempotencyKey: 'DEPOSIT-C1',
        });

        await WalletLedger.create({
            reference: 'TXN-002',
            userId: workerUser1._id,
            debitAccount: 'CUSTOMER_WALLET',
            creditAccount: 'WORKER_WALLET',
            amount: 350000,
            transactionType: 'EARNING',
            status: 'COMPLETED',
            idempotencyKey: 'EARNING-W1',
        });

        await WalletLedger.create({
            reference: 'TXN-003',
            userId: customer1._id,
            debitAccount: 'CUSTOMER_WALLET',
            creditAccount: 'ESCROW',
            bookingId: bookingCompleted._id,
            amount: 87600,
            transactionType: 'HOLD',
            status: 'COMPLETED',
            idempotencyKey: 'BOOKING_PAYMENT-C1',
        });

        await WalletLedger.create({
            reference: 'TXN-004',
            userId: workerUser1._id,
            debitAccount: 'ESCROW',
            creditAccount: 'PLATFORM_REVENUE',
            bookingId: bookingCompleted._id,
            amount: 7000,
            transactionType: 'COMMISSION',
            status: 'COMPLETED',
            idempotencyKey: 'COMMISSION-W1',
        });

        // ----------------- WITHDRAWALS -----------------
        const payoutAccount1 = await WorkerPayoutAccount.create({
            workerId: workerUser1._id,
            accountType: 'BANK_ACCOUNT',
            displayName: 'Rahul Savings',
            beneficiaryName: 'Rahul Sharma',
            accountNumberLast4: '1234',
            bankName: 'HDFC Bank',
            fingerprint: 'fp-rahul-1234',
            verificationStatus: 'VERIFIED',
        });

        const payoutAccount2 = await WorkerPayoutAccount.create({
            workerId: workerUser2._id,
            accountType: 'BANK_ACCOUNT',
            displayName: 'Amit Savings',
            beneficiaryName: 'Amit Kumar',
            accountNumberLast4: '5678',
            bankName: 'ICICI Bank',
            fingerprint: 'fp-amit-5678',
            verificationStatus: 'VERIFIED',
        });

        await WorkerPayout.create({
            payoutNumber: 'PW-2001',
            workerId: workerUser1._id,
            payoutAccountId: payoutAccount1._id,
            amountPaise: 200000,
            status: 'PENDING',
            mode: 'IMPS',
            idempotencyKey: 'PW-2001-IDEM',
            requestFingerprint: 'req-fp-pw-2001',
            availableBalanceSnapshotPaise: 350000,
        });

        await WorkerPayout.create({
            payoutNumber: 'PW-2002',
            workerId: workerUser2._id,
            payoutAccountId: payoutAccount2._id,
            amountPaise: 150000,
            status: 'APPROVED',
            mode: 'IMPS',
            idempotencyKey: 'PW-2002-IDEM',
            requestFingerprint: 'req-fp-pw-2002',
            availableBalanceSnapshotPaise: 200000,
        });

        await WorkerPayout.create({
            payoutNumber: 'PW-2003',
            workerId: workerUser1._id,
            payoutAccountId: payoutAccount1._id,
            amountPaise: 100000,
            status: 'REJECTED',
            mode: 'IMPS',
            idempotencyKey: 'PW-2003-IDEM',
            requestFingerprint: 'req-fp-pw-2003',
            availableBalanceSnapshotPaise: 150000,
        });

        // ----------------- ADMIN PANEL DATA & VERIFICATIONS -----------------
        const docPending = await VerificationDocument.create({
            workerId: workerUser2._id,
            documentType: 'AADHAAR',
            documentNumberEncrypted: 'encrypted_aadhaar_2',
            documentNumberLast4: '9902',
            frontFile: 'https://mock-s3.com/aadhaar-front.jpg',
            fileMimeType: 'image/jpeg',
            fileSize: 102400,
            verificationStatus: 'PENDING_REVIEW',
        });
        await VerificationSubmission.create({
            workerId: workerUser2._id,
            submissionNumber: 1,
            profileSnapshot: {},
            serviceSnapshot: {},
            documentIds: [docPending._id],
            declarationAccepted: true,
            consentAccepted: true,
            status: 'PENDING_APPROVAL',
            version: 1,
        });

        const docApproved = await VerificationDocument.create({
            workerId: workerUser1._id,
            documentType: 'AADHAAR',
            documentNumberEncrypted: 'encrypted_aadhaar_1',
            documentNumberLast4: '9901',
            frontFile: 'https://mock-s3.com/aadhaar-front1.jpg',
            fileMimeType: 'image/jpeg',
            fileSize: 102400,
            verificationStatus: 'APPROVED',
        });
        await VerificationSubmission.create({
            workerId: workerUser1._id,
            submissionNumber: 1,
            profileSnapshot: {},
            serviceSnapshot: {},
            documentIds: [docApproved._id],
            declarationAccepted: true,
            consentAccepted: true,
            status: 'APPROVED',
            version: 1,
        });

        const workerUser3 = await User.create({
            name: 'Failed Worker',
            email: 'failedworker@test.com',
            phone: '9999999905',
            passwordHash: workerPass,
            role: 'WORKER',
            status: 'ACTIVE',
        });
        const docRejected = await VerificationDocument.create({
            workerId: workerUser3._id,
            documentType: 'PAN',
            documentNumberEncrypted: 'encrypted_pan_3',
            documentNumberLast4: '5566',
            frontFile: 'https://mock-s3.com/pan-front3.jpg',
            fileMimeType: 'image/jpeg',
            fileSize: 102400,
            verificationStatus: 'REJECTED',
            reviewComment: 'Illegible document copy.',
        });
        await VerificationSubmission.create({
            workerId: workerUser3._id,
            submissionNumber: 1,
            profileSnapshot: {},
            serviceSnapshot: {},
            documentIds: [docRejected._id],
            declarationAccepted: true,
            consentAccepted: true,
            status: 'REJECTED',
            finalComment: 'PAN verification failed',
            version: 1,
        });

        const dispute = await DisputeCase.create({
            disputeNumber: 'DS-3001',
            bookingId: bookingRefund._id,
            customerId: customer2._id,
            workerId: workerUser1._id,
            openedByType: 'CUSTOMER',
            openedById: customer2._id,
            disputeType: 'SERVICE_NOT_PROVIDED',
            reasonCode: 'WORKER_NO_SHOW',
            title: 'Worker did not show up',
            description: 'The worker did not arrive at the scheduled start time.',
            claimedAmountPaise: 87600,
            status: 'OPEN',
            priority: 'HIGH',
        });

        await Refund.create({
            refundNumber: 'RF-4001',
            bookingId: bookingRefund._id,
            customerId: customer2._id,
            workerId: workerUser1._id,
            disputeId: dispute._id,
            paymentOrderId: poRefund._id,
            paymentTransactionId: ptRefund._id,
            providerPaymentId: 'pay_refund_dummy',
            refundType: 'FULL',
            refundReason: 'Worker No Show Dispute Resolution',
            requestedAmountPaise: 87600,
            approvedAmountPaise: 87600,
            status: 'APPROVED',
            source: 'ADMIN_DISPUTE_RESOLUTION',
            idempotencyKey: 'RF-4001-IDEM',
            requestedByType: 'ADMIN',
            requestedById: admin._id,
        });

        await SupportTicket.create({
            ticketNumber: 'ST-5001',
            requesterId: customer1._id,
            requesterRole: 'CUSTOMER',
            category: 'PAYMENT',
            subjectSafe: 'Double debited during BK-1004 booking',
            descriptionSafe: 'The money was cut twice from my account for BK-1004.',
            priority: 'NORMAL',
            status: 'OPEN',
        });

        // ----------------- REVIEWS -----------------
        await Review.create({
            bookingId: bookingCompleted._id,
            serviceCategoryId: categories['home-cleaning']._id,
            reviewerId: customer1._id,
            revieweeId: workerUser1._id,
            workerId: workerUser1._id,
            customerId: customer1._id,
            direction: 'CUSTOMER_TO_WORKER',
            rating: 5,
            comment: 'Excellent service',
            bookingCompletedAt: now,
            idempotencyKey: 'REV-001',
            requestFingerprint: 'fingerprint-rev-001',
            editWindowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            publishedAt: now,
            eligibilitySnapshot: {
                bookingId: bookingCompleted._id,
                bookingNumber: bookingCompleted.bookingNumber,
                customerId: customer1._id,
                workerId: workerUser1._id,
                serviceCategoryId: categories['home-cleaning']._id,
                bookingStatus: 'COMPLETED',
                paymentStatus: 'PAID',
                completedAt: now,
                reviewerRole: 'CUSTOMER',
                reviewDirection: 'CUSTOMER_TO_WORKER',
                eligibilityCalculatedAt: now,
            },
            policySnapshot: {},
        });

        const bookingCompleted2 = await Booking.create({
            bookingNumber: 'BK-1006',
            customerId: customer2._id,
            workerId: workerUser2._id,
            serviceCategoryId: categories['electrician']._id,
            serviceAddress: '123 Main St',
            scheduledStart: now,
            scheduledEnd: now,
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

        await Review.create({
            bookingId: bookingCompleted2._id,
            serviceCategoryId: categories['electrician']._id,
            reviewerId: customer2._id,
            revieweeId: workerUser2._id,
            workerId: workerUser2._id,
            customerId: customer2._id,
            direction: 'CUSTOMER_TO_WORKER',
            rating: 4,
            comment: 'Good experience',
            bookingCompletedAt: now,
            idempotencyKey: 'REV-002',
            requestFingerprint: 'fingerprint-rev-002',
            editWindowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            publishedAt: now,
            eligibilitySnapshot: {
                bookingId: bookingCompleted2._id,
                bookingNumber: bookingCompleted2.bookingNumber,
                customerId: customer2._id,
                workerId: workerUser2._id,
                serviceCategoryId: categories['electrician']._id,
                bookingStatus: 'COMPLETED',
                paymentStatus: 'PAID',
                completedAt: now,
                reviewerRole: 'CUSTOMER',
                reviewDirection: 'CUSTOMER_TO_WORKER',
                eligibilityCalculatedAt: now,
            },
            policySnapshot: {},
        });

        // ----------------- NOTIFICATIONS -----------------
        await Notification.create({
            recipientId: customer1._id,
            type: 'BOOKING_CONFIRMED',
            category: 'BOOKING',
            title: 'Booking Confirmed',
            messageSafe: 'Your booking has been confirmed by the worker.',
            dedupeKey: 'c1-bk-confirmed',
        });
        await Notification.create({
            recipientId: customer1._id,
            type: 'PAYMENT_SUCCESSFUL',
            category: 'PAYMENT',
            title: 'Payment Successful',
            messageSafe: 'Your payment of ₹876 has been processed successfully.',
            dedupeKey: 'c1-pm-success',
        });
        await Notification.create({
            recipientId: customer2._id,
            type: 'REFUND_PROCESSED',
            category: 'REFUND',
            title: 'Refund Processed',
            messageSafe: 'Your refund of ₹876 has been processed.',
            dedupeKey: 'c2-rf-processed',
        });

        await Notification.create({
            recipientId: workerUser1._id,
            type: 'NEW_BOOKING_RECEIVED',
            category: 'BOOKING',
            title: 'New Booking Received',
            messageSafe: 'You have received a new booking request.',
            dedupeKey: 'w1-bk-new',
        });
        await Notification.create({
            recipientId: workerUser1._id,
            type: 'PAYMENT_CREDITED',
            category: 'PAYMENT',
            title: 'Payment Credited',
            messageSafe: 'Earning of ₹630 has been credited to your wallet.',
            dedupeKey: 'w1-pay-credit',
        });
        await Notification.create({
            recipientId: workerUser2._id,
            type: 'WITHDRAWAL_APPROVED',
            category: 'PAYOUT',
            title: 'Withdrawal Approved',
            messageSafe: 'Your payout request of ₹1500 has been approved.',
            dedupeKey: 'w2-wd-approved',
        });

        await Notification.create({
            recipientId: admin._id,
            type: 'NEW_WORKER_APPROVAL_REQUEST',
            category: 'ACCOUNT',
            title: 'New Worker Approval Request',
            messageSafe: 'A new worker profile is pending verification.',
            dedupeKey: 'adm-wk-pending',
        });
        await Notification.create({
            recipientId: admin._id,
            type: 'NEW_DISPUTE_CREATED',
            category: 'DISPUTE',
            title: 'New Dispute Created',
            messageSafe: 'A new dispute case DS-3001 has been registered.',
            dedupeKey: 'adm-ds-created',
        });

        res.status(200).json({
            success: true,
            message: 'Database seeded successfully with full test suite!',
        });
    } catch (err) {
        next(err);
    }
});

router.post('/seed-admin', async (req, res, next) => {
    try {
        console.log('Starting Admin DB Seeding via API...');

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

        await createPayout('PW-ADM-1', worker1._id, pa1._id, 250000, 'PENDING');
        await createPayout('PW-ADM-2', worker2._id, pa2._id, 500000, 'APPROVED');
        await createPayout('PW-ADM-3', worker1._id, pa1._id, 150000, 'REJECTED', 'Bank details mismatch');

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
        await createAuditLog('LOGIN', 'User', admin._id.toString(), 'Admin login');
        await createAuditLog('WORKER_APPROVED', 'WorkerProfile', worker1._id.toString(), 'Worker Rahul approved');
        await createAuditLog('REFUND_PROCESSED', 'Refund', 'RF-ADM-99', 'Refund processed for dispute');
        await createAuditLog('COMMISSION_UPDATED', 'CommissionRule', 'CR-ADM-99', 'Commission updated to 10%');
        await createAuditLog('BOOKING_CANCELLED', 'Booking', 'BK-ADM-99', 'Booking BK-1004 cancelled');

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

        await createLedgerEntry('LT-ADM-1', 'CREDIT', 100000);
        await createLedgerEntry('LT-ADM-2', 'COMMISSION', 15000);
        await createLedgerEntry('LT-ADM-3', 'DEBIT', 50000);
        await createLedgerEntry('LT-ADM-4', 'REFUND', 30000);

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

        const b1 = await getOrCreateBooking('BK-ADM-REV1', customer1._id, worker1._id, catCleaning._id);
        const b2 = await getOrCreateBooking('BK-ADM-REV2', customer1._id, worker1._id, catCleaning._id);
        const b3 = await getOrCreateBooking('BK-ADM-REV3', customer1._id, worker1._id, catCleaning._id);

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
        await createReview(b2, 'Fake review complaint', 1, 'PENDING_MODERATION', 'UNDER_REVIEW');
        await createReview(b3, 'Abusive language', 2, 'HIDDEN', 'FLAGGED');

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

        await createSupportTicket('ST-ADM-1', customer1._id, 'PAYMENT', 'Payment deducted but booking not confirmed', 'HIGH', 'OPEN');
        await createSupportTicket('ST-ADM-2', worker1._id, 'PAYOUT', 'Withdrawal pending', 'NORMAL', 'IN_PROGRESS');
        await createSupportTicket('ST-ADM-3', customer1._id, 'REFUND', 'Refund complaint', 'LOW', 'RESOLVED');

        // ----------------- 6. CHAT MODERATION DATA -----------------
        const createChat = async (cust, work, textMsg1, textMsg2, moderationStatus, flagReason) => {
            let conv = await Conversation.findOne({ customerId: cust._id, workerId: work._id, conversationType: 'SUPPORT_LINKED' });
            if (!conv) {
                conv = await Conversation.create({
                    customerId: cust._id,
                    workerId: work._id,
                    participantIds: [cust._id, work._id],
                    conversationType: 'SUPPORT_LINKED',
                    status: moderationStatus === 'FLAGGED' ? 'RESTRICTED' : 'ACTIVE',
                });
            }

            await Message.deleteMany({ conversationId: conv._id }); // refresh messages

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

            if (moderationStatus === 'FLAGGED') {
                let report = await MessageReport.findOne({ messageId: m1._id });
                if (!report) {
                    await MessageReport.create({
                        messageId: m1._id,
                        conversationId: conv._id,
                        reporterId: work._id,
                        reportedUserId: cust._id,
                        reasonCode: 'ABUSE',
                        descriptionSafe: 'User sent abusive words in chat.',
                        status: 'OPEN',
                    });
                }
            }
        };

        await createChat(customer1, worker1, 'Hello I need cleaning service', 'Sure I can help you', 'CLEAR', '');
        await createChat(customer1, worker2, 'Bad words example', 'Abusive content response', 'FLAGGED', 'ABUSIVE_CONTENT');

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

        await createCommissionRule('Default Commission', 'GLOBAL', 1000);
        await createCommissionRule('Cleaning Commission', 'CATEGORY', 1500);
        await createCommissionRule('Premium Worker', 'WORKER', 800);

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

        res.status(200).json({
            success: true,
            message: 'Admin Panel database seeded successfully!',
        });
    } catch (err) {
        next(err);
    }
});

export default router;
