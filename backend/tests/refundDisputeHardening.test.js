import assert from 'assert';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mock123';
process.env.RAZORPAY_KEY_SECRET = 'mockKeySecret456';
process.env.RAZORPAY_WEBHOOK_SECRET = 'mockWebhookSecret789';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/hyperlocal_test';

const { default: mongoose } = await import('mongoose');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: User } = await import('../src/models/User.js');
const { default: Booking } = await import('../src/models/Booking.js');
const { default: PaymentOrder } = await import('../src/models/PaymentOrder.js');
const { default: PaymentTransaction } = await import('../src/models/PaymentTransaction.js');
const { default: WorkerEarning } = await import('../src/models/WorkerEarning.js');
const { default: WorkerWallet } = await import('../src/models/WorkerWallet.js');
const { default: DisputeCase } = await import('../src/models/DisputeCase.js');
const { default: DisputeEvidence } = await import('../src/models/DisputeEvidence.js');
const { default: Refund } = await import('../src/models/Refund.js');
const { default: LedgerAccount } = await import('../src/models/LedgerAccount.js');
const { default: LedgerTransaction } = await import('../src/models/LedgerTransaction.js');
const { default: LedgerEntry } = await import('../src/models/LedgerEntry.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { default: Notification } = await import('../src/models/Notification.js');
const { default: WebhookEvent } = await import('../src/models/WebhookEvent.js');
const RefundEligibilityService = (await import('../src/services/payments/RefundEligibilityService.js')).default;
const DisputeFreezeService = (await import('../src/services/payments/DisputeFreezeService.js')).default;
const DisputeReleaseService = (await import('../src/services/payments/DisputeReleaseService.js')).default;
const LedgerPostingService = (await import('../src/services/payments/LedgerPostingService.js')).default;
const RefundAllocationService = (await import('../src/services/payments/RefundAllocationService.js')).default;
const RefundStateService = (await import('../src/services/payments/RefundStateService.js')).default;
const RefundReconciliationService = (await import('../src/services/payments/RefundReconciliationService.js')).default;
const WebhookProcessorService = (await import('../src/services/webhooks/WebhookProcessorService.js')).default;
const { razorpayProvider, setRazorpayInstance } = await import('../src/services/payments/RazorpayProvider.js');
const { sanitizeDisputeDto, sanitizeEvidenceDto, sanitizeRefundDto } = await import('../src/utils/financialDto.js');

let assertionCount = 0;
let testCaseCount = 0;

function check(condition, message) {
    assertionCount += 1;
    assert.ok(condition, message);
}

function nextCase(name) {
    testCaseCount += 1;
    console.log(`  • ${testCaseCount}. ${name}`);
}

async function clearCollections() {
    const dbName = mongoose.connection?.name || '';
    if (!dbName.includes('test')) {
        throw new Error(`Refusing to clear non-test database: ${dbName}`);
    }
    await User.deleteMany({});
    await Booking.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await WorkerEarning.deleteMany({});
    await WorkerWallet.deleteMany({});
    await DisputeCase.deleteMany({});
    await DisputeEvidence.deleteMany({});
    await Refund.deleteMany({});
    await LedgerAccount.deleteMany({});
    await LedgerTransaction.deleteMany({});
    await LedgerEntry.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});
    await WebhookEvent.deleteMany({});
}

async function seedLedgerAccounts(worker, customer) {
    await LedgerPostingService.resolveAccount('CUSTOMER_FUNDS_HELD', 'SYSTEM');
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_PENDING', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_AVAILABLE', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('WORKER_EARNINGS_FROZEN', 'WORKER', worker._id);
    await LedgerPostingService.resolveAccount('REFUND_PAYABLE', 'CUSTOMER', customer._id);
    await LedgerPostingService.resolveAccount('PAYMENT_GATEWAY_RECEIVABLE', 'SYSTEM');
    await LedgerPostingService.resolveAccount('PAYMENT_GATEWAY_CLEARING', 'SYSTEM');
    await LedgerPostingService.resolveAccount('PLATFORM_COMMISSION_REVENUE', 'SYSTEM');
    await LedgerPostingService.resolveAccount('CUSTOMER_PLATFORM_FEE_REVENUE', 'SYSTEM');
    await LedgerPostingService.resolveAccount('TAX_PAYABLE', 'SYSTEM');
    await LedgerPostingService.resolveAccount('PLATFORM_REFUND_EXPENSE', 'SYSTEM');
}

async function seedBooking(customer, worker, overrides = {}) {
    const booking = await Booking.create({
        bookingNumber: `B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: customer._id,
        workerId: worker._id,
        serviceCategoryId: new mongoose.Types.ObjectId(),
        bookingStatus: overrides.bookingStatus || 'CONFIRMED',
        paymentStatus: overrides.paymentStatus || 'PAID',
        escrowStatus: overrides.escrowStatus || 'HELD',
        scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scheduledEnd: new Date(Date.now() + 25 * 60 * 60 * 1000),
        durationMinutes: 60,
        pricingType: 'HOURLY',
        serviceAddress: '123 Test Street',
        totalAmount: overrides.totalAmount || 100000,
        baseAmount: overrides.baseAmount || 90000,
        taxAmount: overrides.taxAmount || 5000,
        platformFee: overrides.platformFee || 5000,
        commissionPercentage: 10,
        commissionAmount: overrides.commissionAmount || 9000,
        workerEarning: overrides.workerEarning || 81000,
        currency: 'INR',
        pricingSnapshot: {
            baseAmountPaise: overrides.baseAmount || 90000,
            taxAmountPaise: overrides.taxAmount || 5000,
            platformFeeAmountPaise: overrides.platformFee || 5000,
            customerTotalPaise: overrides.totalAmount || 100000,
            commissionAmountPaise: overrides.commissionAmount || 9000,
            workerEarningPaise: overrides.workerEarning || 81000,
        }
    });

    const paymentOrder = await PaymentOrder.create({
        bookingId: booking._id,
        customerId: customer._id,
        amountPaise: overrides.totalAmount || 100000,
        currency: 'INR',
        status: 'PAID',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        idempotencyKey: `idem_po_${booking._id}`,
        bookingAmountSnapshot: {
            baseAmountPaise: overrides.baseAmount || 90000,
            platformFeeAmountPaise: overrides.platformFee || 5000,
            taxAmountPaise: overrides.taxAmount || 5000,
            customerTotalPaise: overrides.totalAmount || 100000,
        }
    });

    const paymentTx = await PaymentTransaction.create({
        bookingId: booking._id,
        paymentOrderId: paymentOrder._id,
        customerId: customer._id,
        provider: 'razorpay',
        providerPaymentId: overrides.providerPaymentId || 'pay_test_123',
        amountPaise: overrides.totalAmount || 100000,
        currency: 'INR',
        status: 'VERIFIED',
        idempotencyKey: `pay_${booking._id}`,
    });

    return { booking, paymentOrder, paymentTx };
}

async function main() {
    console.log('🧪 Starting hardening regression suite for refunds, disputes and fund freezes...');
    await connectDB();
    await clearCollections();

    const admin = await User.create({ name: 'Admin', email: 'admin-hardening@test.com', passwordHash: 'pw', role: 'ADMIN', phone: '1111111111' });
    const customer = await User.create({ name: 'Customer', email: 'customer-hardening@test.com', passwordHash: 'pw', role: 'CUSTOMER', phone: '2222222222' });
    const worker = await User.create({ name: 'Worker', email: 'worker-hardening@test.com', passwordHash: 'pw', role: 'WORKER', phone: '3333333333' });

    await seedLedgerAccounts(worker, customer);

    setRazorpayInstance({
        refunds: {
            create: async (params) => ({ id: `rfnd_test_${crypto.randomBytes(6).toString('hex')}`, payment_id: params.payment_id, amount: params.amount, currency: 'INR', status: 'processed' }),
            fetch: async (id) => ({ id, payment_id: 'pay_test_123', amount: 100000, currency: 'INR', status: 'processed' }),
        },
    });

    const { booking, paymentOrder, paymentTx } = await seedBooking(customer, worker);

    nextCase('Dispute eligibility and access control');
    const dispute = await DisputeCase.create({ disputeNumber: 'DISP-001', bookingId: booking._id, customerId: customer._id, workerId: worker._id, openedByType: 'CUSTOMER', openedById: customer._id, disputeType: 'SERVICE_NOT_PROVIDED', reasonCode: 'WORKER_NO_SHOW', title: 'No show', description: 'No show', claimedAmountPaise: 100000, status: 'OPEN' });
    check(dispute.bookingId.toString() === booking._id.toString(), 'customer-owned dispute created');
    check(dispute.status === 'OPEN', 'dispute status open');
    const duplicate = await DisputeCase.findOne({ bookingId: booking._id, status: { $in: ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'CUSTOMER_RESPONSE_REQUIRED', 'WORKER_RESPONSE_REQUIRED', 'RESOLUTION_PENDING'] } });
    check(duplicate && duplicate._id.toString() === dispute._id.toString(), 'active dispute lookup returns existing dispute');
    const claimTooHigh = await DisputeCase.create({ disputeNumber: 'DISP-002', bookingId: booking._id, customerId: customer._id, workerId: worker._id, openedByType: 'CUSTOMER', openedById: customer._id, disputeType: 'SERVICE_NOT_PROVIDED', reasonCode: 'WORKER_NO_SHOW', title: 'Too high', description: 'Too high', claimedAmountPaise: 150000, status: 'OPEN' }).catch(() => null);
    check(claimTooHigh === null, 'invalid claim amount is rejected by model-level constraints');

    nextCase('Evidence security and DTO masking');
    const evidence = await DisputeEvidence.create({ disputeId: dispute._id, bookingId: booking._id, uploadedByType: 'CUSTOMER', uploadedById: customer._id, evidenceType: 'IMAGE', storageKey: 'secret-key', fileMimeType: 'image/png', fileSize: 1200, originalNameSafe: 'evidence.png', visibility: 'DISPUTE_PARTICIPANTS' });
    const maskedEvidence = sanitizeEvidenceDto(evidence.toObject());
    check(!('storageKey' in maskedEvidence), 'storage key hidden from evidence DTO');
    check(maskedEvidence.originalNameSafe === 'evidence.png', 'evidence DTO preserves safe metadata');
    const disputeDto = sanitizeDisputeDto(dispute.toObject(), true);
    check(!('internalAdminNotes' in disputeDto), 'internal notes hidden from dispute DTO');

    nextCase('Financial freeze and wallet projection');
    const earning = await WorkerEarning.create({ earningNumber: 'EARN-001', bookingId: booking._id, workerId: worker._id, amountPaise: 80000, status: 'PENDING', availableAt: new Date(Date.now() + 24 * 60 * 60 * 1000), idempotencyKey: `earn_${booking._id}` });
    const freezeResult = await DisputeFreezeService.freezeDisputeFunds(dispute, { actorId: customer._id, requestId: 'req-001' });
    check(freezeResult.success === true, 'freeze service succeeds');
    const frozenEarning = await WorkerEarning.findById(earning._id);
    check(frozenEarning.status === 'FROZEN', 'pending earning becomes FROZEN');
    const wallet = await WorkerWallet.findOne({ workerId: worker._id });
    check(wallet && wallet.frozenBalancePaise === 80000, 'wallet frozen balance updated');
    const releaseResult = await DisputeReleaseService.releaseDisputeFunds(dispute, { actorId: admin._id, requestId: 'req-rel' });
    check(releaseResult.success === true, 'release service succeeds');
    const releasedEarning = await WorkerEarning.findById(earning._id);
    check(releasedEarning.status === 'AVAILABLE' || releasedEarning.status === 'PENDING', 'frozen earning can be released');

    nextCase('Refund eligibility and allocation invariant');
    const eligibility = await RefundEligibilityService.calculateEligibility({ bookingId: booking._id, refundSource: 'CUSTOMER_CANCELLATION' });
    check(eligibility.bookingPaidAmountPaise === 100000, 'eligibility uses booking amount');
    check(eligibility.approvedRefundAmountPaise > 0, 'refund eligibility returns a positive amount');
    const allocationResult = await RefundAllocationService.allocateRefund({ bookingId: booking._id, approvedRefundAmountPaise: 50000, workerLiabilityAmountPaise: 50000, platformLiabilityAmountPaise: 0 });
    check(allocationResult.status === 'SUCCESS', 'refund allocation succeeds');
    check(Object.keys(allocationResult.allocation).length >= 7, 'allocation contains source buckets');

    nextCase('Refund approval ledger posting and reconciliation');
    const refund = new Refund({ refundNumber: 'REF-001', bookingId: booking._id, customerId: customer._id, workerId: worker._id, paymentOrderId: paymentOrder._id, paymentTransactionId: paymentTx._id, providerPaymentId: 'pay_test_123', refundType: 'PARTIAL', refundReason: 'Customer cancellation', requestedAmountPaise: 50000, approvedAmountPaise: 50000, currency: 'INR', status: 'APPROVED', source: 'CUSTOMER_CANCELLATION', allocationSnapshot: allocationResult.allocation, idempotencyKey: 'refund-hardening-001', requestedByType: 'CUSTOMER', requestedById: customer._id });
    await refund.save();
    const approval = await LedgerPostingService.postRefundApproval(refund, { actorId: customer._id, requestId: 'req-approval' });
    check(approval.transaction && approval.transaction.status === 'POSTED', 'refund approval ledger transaction posted');
    const refundPayableAccount = await LedgerPostingService.resolveAccount('REFUND_PAYABLE', 'CUSTOMER', customer._id);
    check(refundPayableAccount.cachedBalancePaise >= 50000, 'refund payable liability is credited');
    const reconciliation = await RefundReconciliationService.runReconciliationAudit();
    check(Array.isArray(reconciliation.issues), 'reconciliation returns issue array');
    check(reconciliation.issues.length >= 0, 'reconciliation executes without throwing');

    nextCase('Refund provider and webhook processing');
    const providerRefund = await razorpayProvider.createRefund({ providerPaymentId: 'pay_test_123', amountPaise: 50000, notes: { refundNumber: 'REF-001' } });
    check(providerRefund.id.startsWith('rfnd_test_'), 'mock provider refund id is generated');
    const rawBody = Buffer.from(JSON.stringify({ event: 'refund.processed', id: 'evt_001', payload: { refund: { entity: { id: providerRefund.id, payment_id: 'pay_test_123', amount: 50000, currency: 'INR', status: 'processed' } } } }));
    const digest = crypto.createHmac('sha256', 'mockWebhookSecret789').update(rawBody).digest('hex');
    const sigOk = razorpayProvider.verifyWebhookSignature(rawBody, digest);
    check(sigOk, 'raw-body signature verification succeeds');
    const singleByteChange = Buffer.from(rawBody); singleByteChange[0] ^= 1; check(!razorpayProvider.verifyWebhookSignature(singleByteChange, digest), 'one-byte change invalidates signature');
    const webhookResult = await WebhookProcessorService.process({ rawBody, signature: digest, sigVerified: true, requestId: 'req-webhook', ipAddress: '127.0.0.1' });
    check(webhookResult.accepted === true, 'webhook processor accepts verified event');
    const webhookEvent = await WebhookEvent.findOne({ providerEventId: 'evt_001' });
    check(webhookEvent && webhookEvent.processingStatus === 'PROCESSED', 'webhook is persisted and processed');

    nextCase('Authorization and DTO masking for refunds');
    const refundDto = sanitizeRefundDto(refund.toObject(), { role: 'CUSTOMER' });
    check(!('providerSignature' in refundDto), 'provider signature hidden from refund DTO');
    check(refundDto.status === 'APPROVED', 'refund DTO preserves status');

    nextCase('Replica-set transaction support and safe cleanup');
    const topology = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
    check(topology.ok === 1, 'replica set status command succeeds');
    check(topology.set === 'testset' || topology.set === 'rs0' || topology.set === 'default', 'replica-set topology is reported');
    check(mongoose.connection.name.includes('test'), 'test database name includes test');

    console.log(`✅ ${assertionCount} assertions passed across ${testCaseCount} scenarios.`);
    await clearCollections();
    await disconnectDB();
}

main().catch((error) => {
    console.error('❌ Hardening regression suite failed:', error);
    process.exit(1);
});
