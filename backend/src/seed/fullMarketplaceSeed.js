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

        console.log('Cleared existing data.');

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

        console.log('✅ Users Created');

        // ----------------- SERVICE CATEGORIES -----------------
        const categoriesData = [
            { name: 'Home Cleaning', slug: 'home-cleaning', description: 'Deep cleaning and dusting for homes.', icon: 'Home', defaultCommission: 10 },
            { name: 'AC Repair', slug: 'ac-repair', description: 'Air conditioner servicing and maintenance.', icon: 'Wind', defaultCommission: 12 },
            { name: 'Electrician', slug: 'electrician', description: 'Electrical repairs, wiring, and fixing.', icon: 'Zap', defaultCommission: 12 },
            { name: 'Plumber', slug: 'plumber', description: 'Plumbing services and pipe leak fixes.', icon: 'Wrench', defaultCommission: 10 },
            { name: 'Gardening', slug: 'gardening', description: 'Lawn care and plant upkeep.', icon: 'Flower', defaultCommission: 8 },
            { name: 'Senior Care', slug: 'senior-care', description: 'Attendant service for seniors.', icon: 'Heart', defaultCommission: 15 },
            { name: 'Driver Service', slug: 'driver-service', description: 'Reliable private driver services.', icon: 'Car', defaultCommission: 12 },
        ];

        const categories = {};
        for (const data of categoriesData) {
            const cat = await ServiceCategory.create({
                ...data,
                requiredDocuments: ['AADHAAR', 'PAN'],
            });
            categories[data.slug] = cat;
        }
        console.log('✅ Service Categories Created');

        // ----------------- WORKER PROFILES -----------------
        const profile1 = await WorkerProfile.create({
            userId: workerUser1._id,
            fullName: 'Rahul Sharma',
            phone: '9999999903',
            primaryServiceCategoryId: categories['home-cleaning']._id,
            serviceCategoryIds: [categories['home-cleaning']._id, categories['ac-repair']._id],
            skills: ['Cleaning', 'AC Repair'],
            languages: ['English', 'Hindi'],
            hourlyRate: 35000, // in paise = ₹350
            dailyRate: 250000,
            yearsOfExperience: 5,
            averageRating: 4.8,
            ratingCount: 15,
            verificationStatus: 'APPROVED',
            verificationBadge: true,
            isOnline: true,
            isPubliclyVisible: true,
        });

        const profile2 = await WorkerProfile.create({
            userId: workerUser2._id,
            fullName: 'Amit Kumar',
            phone: '9999999904',
            primaryServiceCategoryId: categories['electrician']._id,
            serviceCategoryIds: [categories['electrician']._id, categories['plumber']._id],
            skills: ['Electrician', 'Plumbing'],
            languages: ['Hindi'],
            hourlyRate: 30000, // ₹300
            dailyRate: 220000,
            yearsOfExperience: 3,
            averageRating: 4.5,
            ratingCount: 8,
            verificationStatus: 'APPROVED',
            verificationBadge: true,
            isOnline: true,
            isPubliclyVisible: true,
        });

        console.log('✅ Worker Profiles Created');

        // ----------------- BOOKINGS -----------------
        const now = new Date();
        
        // A) COMPLETED BOOKING
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
            baseAmount: 70000, // ₹700
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

        // B) CONFIRMED BOOKING
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

        // C) PENDING BOOKING
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

        // D) CANCELLED BOOKING
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

        // E) REFUND BOOKING
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

        console.log('✅ Bookings Created');

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
            amountPaise: 50000, // ₹500
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
            amountPaise: 80000, // ₹800
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
            amountPaise: 100000, // ₹1000
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
            amountPaise: 50000, // ₹500
            status: 'CAPTURED',
            captured: true,
            idempotencyKey: 'idem_pt_refund',
        });

        console.log('✅ Payments Created');

        // ----------------- WALLETS & TRANSACTIONS -----------------
        const walletCustomer1 = await WorkerWallet.create({
            workerId: customer1._id, // Representing customer wallet using same model for compatibility
            currency: 'INR',
            availableBalancePaise: 500000, // ₹5000
        });

        const walletWorker1 = await WorkerWallet.create({
            workerId: workerUser1._id,
            currency: 'INR',
            availableBalancePaise: 350000, // ₹3500
        });

        // Wallet Transactions
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

        console.log('✅ Wallets & Transactions Created');

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

        // Request 1: Pending
        await WorkerPayout.create({
            payoutNumber: 'PW-2001',
            workerId: workerUser1._id,
            payoutAccountId: payoutAccount1._id,
            amountPaise: 200000, // ₹2000
            status: 'PENDING',
            mode: 'IMPS',
            idempotencyKey: 'PW-2001-IDEM',
            requestFingerprint: 'req-fp-pw-2001',
            availableBalanceSnapshotPaise: 350000,
        });

        // Request 2: Approved
        await WorkerPayout.create({
            payoutNumber: 'PW-2002',
            workerId: workerUser2._id,
            payoutAccountId: payoutAccount2._id,
            amountPaise: 150000, // ₹1500
            status: 'APPROVED',
            mode: 'IMPS',
            idempotencyKey: 'PW-2002-IDEM',
            requestFingerprint: 'req-fp-pw-2002',
            availableBalanceSnapshotPaise: 200000,
        });

        // Request 3: Rejected
        await WorkerPayout.create({
            payoutNumber: 'PW-2003',
            workerId: workerUser1._id,
            payoutAccountId: payoutAccount1._id,
            amountPaise: 100000, // ₹1000
            status: 'REJECTED',
            mode: 'IMPS',
            idempotencyKey: 'PW-2003-IDEM',
            requestFingerprint: 'req-fp-pw-2003',
            availableBalanceSnapshotPaise: 150000,
        });

        console.log('✅ Withdrawal Requests Created');

        // ----------------- ADMIN PANEL DATA & VERIFICATIONS -----------------
        
        // Pending worker verification docs
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
            workerId_1_version_1: 'worker2-v1', // unique validation index helper
            version: 1,
        });

        // Approved worker verification docs
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

        // Rejected worker verification docs
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

        // Disputes
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

        // Refunds
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

        // Support tickets
        const supportTicket = await SupportTicket.create({
            ticketNumber: 'ST-5001',
            requesterId: customer1._id,
            requesterRole: 'CUSTOMER',
            category: 'PAYMENT',
            subjectSafe: 'Double debited during BK-1004 booking',
            descriptionSafe: 'The money was cut twice from my account for BK-1004.',
            priority: 'NORMAL',
            status: 'OPEN',
        });

        console.log('✅ Admin Panel Data Created');

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

        console.log('✅ Reviews Created');

        // ----------------- NOTIFICATIONS -----------------
        
        // Customer notifications
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

        // Worker notifications
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

        // Admin notifications
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

        console.log('✅ Notifications Created');

        console.log('\n=============================');
        console.log('SEED COMPLETED SUCCESSFULLY');
        console.log('=============================\n');

        const usersCount = await User.countDocuments();
        const bookingsCount = await Booking.countDocuments();
        const paymentsCount = await PaymentTransaction.countDocuments();
        const walletsCount = await WorkerWallet.countDocuments();
        const withdrawalsCount = await WorkerPayout.countDocuments();
        const notificationsCount = await Notification.countDocuments();

        console.log(`Users:\n${usersCount} created\n`);
        console.log(`Bookings:\n${bookingsCount} created\n`);
        console.log(`Payments:\n${paymentsCount} created\n`);
        console.log(`Wallets:\n${walletsCount} created\n`);
        console.log(`Withdrawals:\n${withdrawalsCount} created\n`);
        console.log(`Notifications:\ncreated (${notificationsCount})\n`);

        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

runSeed();
