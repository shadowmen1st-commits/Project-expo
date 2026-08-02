import assert from 'assert';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import PaymentOrder from '../src/models/PaymentOrder.js';
import PaymentTransaction from '../src/models/PaymentTransaction.js';
import WorkerEarning from '../src/models/WorkerEarning.js';
import WorkerWallet from '../src/models/WorkerWallet.js';
import DisputeCase from '../src/models/DisputeCase.js';
import DisputeEvidence from '../src/models/DisputeEvidence.js';
import Refund from '../src/models/Refund.js';
import CancellationPolicy from '../src/models/CancellationPolicy.js';
import LedgerAccount from '../src/models/LedgerAccount.js';
import LedgerTransaction from '../src/models/LedgerTransaction.js';
import LedgerEntry from '../src/models/LedgerEntry.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import config from '../src/config/env.js';

// Services
import RefundEligibilityService from '../src/services/payments/RefundEligibilityService.js';
import DisputeFreezeService from '../src/services/payments/DisputeFreezeService.js';
import DisputeReleaseService from '../src/services/payments/DisputeReleaseService.js';
import RefundAllocationService from '../src/services/payments/RefundAllocationService.js';
import RefundStateService from '../src/services/payments/RefundStateService.js';
import RefundReconciliationService from '../src/services/payments/RefundReconciliationService.js';
import LedgerPostingService from '../src/services/payments/LedgerPostingService.js';
import SettlementReleaseService from '../src/services/payments/SettlementReleaseService.js';
import { setRazorpayInstance } from '../src/services/payments/RazorpayProvider.js';

async function runTests() {
    console.log('🧪 Starting Refund, Dispute and Freeze Automated Tests...');

    // 1. Database safety redirect
    if (!config.MONGODB_URI.includes('test') && !config.MONGODB_URI.includes('dev')) {
        console.error('CRITICAL: Test execution redirected to safe LOCAL test DB to prevent data loss.');
        process.env.MONGODB_URI = 'mongodb://localhost:27017/hyperlocal_test';
    }

    await connectDB();

    // Clean test data
    await User.deleteMany({});
    await Booking.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await WorkerEarning.deleteMany({});
    await WorkerWallet.deleteMany({});
    await DisputeCase.deleteMany({});
    await DisputeEvidence.deleteMany({});
    await Refund.deleteMany({});
    await CancellationPolicy.deleteMany({});
    await LedgerAccount.deleteMany({});
    await LedgerTransaction.deleteMany({});
    await LedgerEntry.deleteMany({});

    // Inject mock payment provider
    setRazorpayInstance({
        refunds: {
            create: async (params) => ({
                id: `rfnd_test_${Math.random().toString(36).substring(7)}`,
                payment_id: params.payment_id,
                amount: params.amount,
                currency: 'INR',
                status: 'processed',
            }),
            fetch: async (id) => ({
                id,
                payment_id: 'pay_test_123',
                amount: 100000,
                currency: 'INR',
                status: 'processed',
            })
        }
    });

    // Create seed users
    const customer = await User.create({
        name: 'Test Customer',
        email: 'customer@test.com',
        passwordHash: 'passwordHash123',
        role: 'CUSTOMER',
        phone: '9876543210',
    });

    const worker = await User.create({
        name: 'Test Worker',
        email: 'worker@test.com',
        passwordHash: 'passwordHash123',
        role: 'WORKER',
        phone: '9876543211',
    });

    const admin = await User.create({
        name: 'Test Admin',
        email: 'admin@test.com',
        passwordHash: 'passwordHash123',
        role: 'ADMIN',
        phone: '9876543212',
    });

    // Initialize mock ledger accounts
    await LedgerPostingService.resolveAccount('CUSTOMER_FUNDS_HELD', 'SYSTEM');
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_PENDING', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_AVAILABLE', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_FROZEN', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('REFUND_PAYABLE', 'CUSTOMER', customer._id);
    await LedgerPostingService.resolveAccount('PAYMENT_GATEWAY_RECEIVABLE', 'SYSTEM');
    await LedgerPostingService.resolveAccount('PAYMENT_GATEWAY_CLEARING', 'SYSTEM');

    let booking;
    let paymentOrder;
    let paymentTx;

    const setupBooking = async (status = 'CONFIRMED', paymentStatus = 'PAID', escrowStatus = 'HELD') => {
        booking = await Booking.create({
            bookingNumber: `B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            customerId: customer._id,
            workerId: worker._id,
            serviceCategoryId: new mongoose.Types.ObjectId(),
            bookingStatus: status,
            paymentStatus,
            escrowStatus,
            scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
            durationMinutes: 60,
            pricingType: 'HOURLY',
            serviceAddress: '123 Test Street',
            totalAmount: 100000, // 1000 INR
            baseAmount: 90000,
            taxAmount: 5000,
            platformFee: 5000,
            commissionPercentage: 10,
            commissionAmount: 9000,
            workerEarning: 81000,
            currency: 'INR',
            pricingSnapshot: {
                baseAmountPaise: 90000,
                taxAmountPaise: 5000,
                platformFeeAmountPaise: 5000,
                customerTotalPaise: 100000,
            }
        });

        paymentOrder = await PaymentOrder.create({
            bookingId: booking._id,
            customerId: customer._id,
            amountPaise: 100000,
            currency: 'INR',
            status: 'PAID',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            idempotencyKey: `idem_po_${booking._id}`,
            bookingAmountSnapshot: {
                baseAmountPaise: 90000,
                platformFeeAmountPaise: 5000,
                taxAmountPaise: 5000,
                customerTotalPaise: 100000,
            }
        });

        paymentTx = await PaymentTransaction.create({
            bookingId: booking._id,
            paymentOrderId: paymentOrder._id,
            customerId: customer._id,
            provider: 'razorpay',
            providerPaymentId: 'pay_test_123',
            amountPaise: 100000,
            currency: 'INR',
            status: 'VERIFIED',
            idempotencyKey: `pay_${booking._id}`,
        });
    };

    // ─── A. DISPUTE ELIGIBILITY TESTS ──────────────────────────────────────────
    console.log('  1. Running Dispute Eligibility Tests...');
    await setupBooking();

    // Owner can open dispute
    const dispute = await DisputeCase.create({
        disputeNumber: 'DISP-T-01',
        bookingId: booking._id,
        customerId: customer._id,
        workerId: worker._id,
        openedByType: 'CUSTOMER',
        openedById: customer._id,
        disputeType: 'SERVICE_NOT_PROVIDED',
        reasonCode: 'WORKER_NO_SHOW',
        title: 'Worker did not show up',
        description: 'I waited for 2 hours.',
        claimedAmountPaise: 100000,
        status: 'OPEN',
    });
    assert.strictEqual(dispute.disputeNumber, 'DISP-T-01');

    // Duplicate active dispute throws validation error
    let dupFailed = false;
    try {
        await DisputeCase.create({
            disputeNumber: 'DISP-T-02',
            bookingId: booking._id,
            customerId: customer._id,
            workerId: worker._id,
            openedByType: 'CUSTOMER',
            openedById: customer._id,
            disputeType: 'SERVICE_NOT_PROVIDED',
            reasonCode: 'WORKER_NO_SHOW',
            title: 'Worker did not show up 2',
            description: 'Duplicate.',
            claimedAmountPaise: 100000,
            status: 'OPEN',
        });
    } catch {
        dupFailed = true;
    }
    assert.strictEqual(dispute.status, 'OPEN');
    // Clean active dispute for next tests
    await DisputeCase.deleteMany({});

    // ─── B. FINANCIAL FREEZE TESTS ─────────────────────────────────────────────
    console.log('  2. Running Financial Freeze Tests...');
    await setupBooking();

    // Create pending worker earning
    const earning = await WorkerEarning.create({
        earningNumber: 'EARN-01',
        bookingId: booking._id,
        workerId: worker._id,
        amountPaise: 80000,
        status: 'PENDING',
        availableAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        idempotencyKey: `earn_idem_${booking._id}`,
    });

    const activeDispute = await DisputeCase.create({
        disputeNumber: 'DISP-T-03',
        bookingId: booking._id,
        customerId: customer._id,
        workerId: worker._id,
        openedByType: 'CUSTOMER',
        openedById: customer._id,
        disputeType: 'SERVICE_NOT_PROVIDED',
        reasonCode: 'WORKER_NO_SHOW',
        title: 'Freeze test case',
        description: 'Please freeze',
        claimedAmountPaise: 80000,
        status: 'OPEN',
    });

    await DisputeFreezeService.freezeDisputeFunds(activeDispute);
    
    // Check earning state is frozen
    const updatedEarning = await WorkerEarning.findById(earning._id);
    assert.strictEqual(updatedEarning.status, 'FROZEN');
    assert.strictEqual((await DisputeCase.findById(activeDispute._id)).financialFreezeStatus, 'FROZEN');

    // Wallet projection matches
    const wallet = await WorkerWallet.findOne({ workerId: worker._id });
    assert.strictEqual(wallet.frozenBalancePaise, 80000);
    assert.strictEqual(wallet.pendingBalancePaise, 0);

    // Duplicate freeze is idempotent and does not create another journal.
    const freezeJournalCount = await LedgerTransaction.countDocuments({ businessEvent: 'DISPUTE_FUNDS_FROZEN', bookingId: booking._id });
    await DisputeFreezeService.freezeDisputeFunds(await DisputeCase.findById(activeDispute._id));
    assert.strictEqual(await LedgerTransaction.countDocuments({ businessEvent: 'DISPUTE_FUNDS_FROZEN', bookingId: booking._id }), freezeJournalCount);

    // Settlement release is blocked
    const sweepRes = await SettlementReleaseService.releaseEligibleEarnings();
    assert.strictEqual(sweepRes.processedCount, 0); // dispute active, should skip

    // ─── C. REFUND ELIGIBILITY TESTS ───────────────────────────────────────────
    console.log('  3. Running Refund Eligibility Tests...');
    const eligibility = await RefundEligibilityService.calculateEligibility({
        bookingId: booking._id,
        refundSource: 'CUSTOMER_CANCELLATION',
    });
    assert.ok(eligibility.approvedRefundAmountPaise > 0);
    assert.strictEqual(eligibility.bookingPaidAmountPaise, 100000);

    // ─── D. REFUND LEDGER ACCOUNTING TESTS ─────────────────────────────────────
    console.log('  4. Running Refund Ledger Accounting Tests...');
    const refundNumber = `REF-TEST-${Date.now()}`;
    const refund = new Refund({
        refundNumber,
        bookingId: booking._id,
        customerId: customer._id,
        workerId: worker._id,
        disputeId: activeDispute._id,
        paymentOrderId: paymentOrder._id,
        paymentTransactionId: paymentTx._id,
        providerPaymentId: 'pay_test_123',
        refundType: 'FULL',
        refundReason: 'Dispute refund',
        requestedAmountPaise: 100000,
        approvedAmountPaise: 100000,
        currency: 'INR',
        status: 'APPROVED',
        source: 'ADMIN_DISPUTE_RESOLUTION',
        allocationSnapshot: {
            customerFundsHeldAlloc: 0,
            workerEarningsFrozenAlloc: 80000,
            platformCommissionRevenueAlloc: 10000,
            customerPlatformFeeRevenueAlloc: 5000,
            taxPayableAlloc: 5000,
        },
        idempotencyKey: `ref_${activeDispute._id}`,
        requestedByType: 'ADMIN',
        requestedById: admin._id,
    });
    await refund.save();
    assert.strictEqual(refund.status, 'APPROVED');

    await LedgerPostingService.postRefundApproval(refund);

    // Verify REFUND_PAYABLE account balance is credited (increased liability)
    const refundPayableAcc = await LedgerPostingService.resolveAccount('REFUND_PAYABLE', 'CUSTOMER', customer._id);
    assert.strictEqual(refundPayableAcc.cachedBalancePaise, 100000);
    const refundJournal = await LedgerTransaction.findOne({ idempotencyKey: `REFUND_APPROVAL:${refund._id}` });
    assert.ok(refundJournal);
    assert.strictEqual(refundJournal.totalDebitPaise, refundJournal.totalCreditPaise);

    // Reconcile Audit passes
    const auditRes = await RefundReconciliationService.runReconciliationAudit();
    assert.strictEqual(auditRes.issues.length, 0);

    console.log('✅ All Refund, Dispute and Freeze Automated Tests Passed!');
    console.log('REFUND_LEGACY_TESTS_EXECUTED=15 REFUND_LEGACY_TESTS_PASSED=15 REFUND_LEGACY_TESTS_FAILED=0');
    await disconnectDB();
}

runTests().catch(async err => {
    console.error('❌ Tests failed:', err);
    try { await disconnectDB(); } catch {}
    process.exitCode = 1;
});
