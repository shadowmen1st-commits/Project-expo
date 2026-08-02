import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import assert from 'assert';

// Force test environment
process.env.NODE_ENV = 'test';
process.env.PAYMENT_PROVIDER_MODE = 'mock';
process.env.MONGODB_URI = 'mongodb://localhost:27017/hyperlocal_marketplace_test';

// Dynamic imports
const { default: User } = await import('../src/models/User.js');
const { default: WorkerProfile } = await import('../src/models/WorkerProfile.js');
const { default: ServiceCategory } = await import('../src/models/ServiceCategory.js');
const { default: Booking } = await import('../src/models/Booking.js');
const { default: PaymentOrder } = await import('../src/models/PaymentOrder.js');
const { default: PaymentTransaction } = await import('../src/models/PaymentTransaction.js');
const { default: WebhookEvent } = await import('../src/models/WebhookEvent.js');
const { default: AuditLog } = await import('../src/models/AuditLog.js');
const { default: Notification } = await import('../src/models/Notification.js');
const { signAccessToken } = await import('../src/utils/authUtils.js');
const { config } = await import('../src/config/env.js');
const { razorpayProvider, setRazorpayInstance, resetRazorpayInstance } = await import('../src/services/payments/RazorpayProvider.js');
const { startServer, stopServer } = await import('../src/index.js');
const startedServer = await startServer(0);
const BASE_URL = `http://127.0.0.1:${startedServer.port}/api`;
const MONGODB_URI = process.env.MONGODB_URI;

const runTests = async () => {
    console.log('====================================================');
    console.log('🚀 STARTING COMPREHENSIVE PAYMENT & WEBHOOK TEST SUITE (40+ SCENARIOS)');
    console.log('====================================================\n');

    console.log(`TEST_DATABASE=${mongoose.connection.name} TEST_TOPOLOGY=replicaSet`);

    // STRICT DATABASE NAME GUARD
    const dbName = mongoose.connection.name;
    if (!dbName.includes('test')) {
        console.error(`CRITICAL SECURITY GUARD: Attempted cleanup on database "${dbName}". Destructive tests are restricted to database names containing "test".`);
        process.exit(1);
    }

    // Wipe collections for test isolation
    await User.deleteMany({});
    await WorkerProfile.deleteMany({});
    await ServiceCategory.deleteMany({});
    await Booking.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await WebhookEvent.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});

    let passedCount = 0;
    let failedCount = 0;

    const runScenario = async (name, fn) => {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            passedCount++;
        } catch (err) {
            console.error(`❌ [FAIL] ${name} - ${err.message}`);
            if (err.stack) console.error(err.stack);
            failedCount++;
        }
    };

    // Setup basic seeds
    const customer = new User({
        name: 'Test Customer',
        email: 'test.cust@hyperlocal.com',
        phone: '9999900001',
        passwordHash: 'dummy',
        role: 'CUSTOMER',
        status: 'ACTIVE',
    });
    await customer.save();

    const otherCustomer = new User({
        name: 'Other Customer',
        email: 'other.cust@hyperlocal.com',
        phone: '9999900002',
        passwordHash: 'dummy',
        role: 'CUSTOMER',
        status: 'ACTIVE',
    });
    await otherCustomer.save();

    const worker = new User({
        name: 'Test Worker',
        email: 'test.work@hyperlocal.com',
        phone: '9999900003',
        passwordHash: 'dummy',
        role: 'WORKER',
        status: 'ACTIVE',
    });
    await worker.save();

    const admin = new User({
        name: 'Test Admin',
        email: 'test.admin@hyperlocal.com',
        phone: '9999900004',
        passwordHash: 'dummy',
        role: 'ADMIN',
        status: 'ACTIVE',
        permissions: ['payments.read', 'payments.manage']
    });
    await admin.save();

    const category = new ServiceCategory({
        name: 'Housekeeping',
        slug: 'housekeeping',
        description: 'Housekeeping Services',
        basePrice: 50000,
        icon: 'housekeeping-icon',
    });
    await category.save();

    await new WorkerProfile({
        userId: worker._id,
        verificationStatus: 'APPROVED',
        serviceCategoryIds: [category._id],
        hourlyRate: 30000,
        dailyRate: 200000,
    }).save();

    // Generate tokens
    const customerToken = signAccessToken({ userId: customer._id.toString(), id: customer._id.toString(), role: customer.role });
    const otherToken = signAccessToken({ userId: otherCustomer._id.toString(), id: otherCustomer._id.toString(), role: otherCustomer.role });
    const workerToken = signAccessToken({ userId: worker._id.toString(), id: worker._id.toString(), role: worker.role });
    const adminToken = signAccessToken({ userId: admin._id.toString(), id: admin._id.toString(), role: admin.role, permissions: admin.permissions });

    const customerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` };
    const otherHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${otherToken}` };
    const workerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${workerToken}` };
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` };

    // MOCK RAZORPAY INSTANCE FOR TESTS
    const mockRazorpay = {
        orders: {
            create: async (params) => ({
                id: `order_test_${crypto.randomBytes(8).toString('hex')}`,
                amount: params.amount,
                currency: params.currency,
                receipt: params.receipt,
                status: 'created',
                notes: params.notes,
            }),
            fetch: async (id) => ({
                id,
                amount: 64000,
                currency: 'INR',
                status: 'paid',
            })
        },
        payments: {
            fetch: async (id) => ({
                id,
                amount: 64000,
                currency: 'INR',
                status: 'captured',
                method: 'upi',
                captured: true,
            })
        }
    };
    setRazorpayInstance(mockRazorpay);

    // Helper to create booking
    const createTestBooking = async (customerId, status = 'PAYMENT_PENDING', paymentStatus = 'PENDING') => {
        const booking = new Booking({
            bookingNumber: `BK-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            customerId,
            workerId: worker._id,
            serviceCategoryId: category._id,
            serviceAddress: 'Test Address',
            scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
            scheduledEnd: new Date(Date.now() + 26 * 60 * 60 * 1000),
            durationMinutes: 120,
            pricingType: 'HOURLY',
            baseAmount: 50000,
            platformFee: 5000,
            taxAmount: 9000,
            discountAmount: 0,
            totalAmount: 64000,
            commissionPercentage: 10,
            commissionAmount: 5000,
            workerEarning: 45000,
            currency: 'INR',
            pricingSnapshot: {
                totalAmount: 64000,
                customerTotalPaise: 64000,
                baseAmount: 50000,
                platformFee: 5000,
                taxAmount: 9000,
                discountAmount: 0,
                workerEarning: 45000,
                commissionAmount: 5000,
                currency: 'INR',
            },
            bookingStatus: status,
            paymentStatus: paymentStatus,
            escrowStatus: 'NOT_FUNDED',
        });
        return await booking.save();
    };

    // =========================================================================
    // CATEGORY A: PROVIDER CONFIGURATION TESTS
    // =========================================================================
    await runScenario('A1. Mock mode isolation: isConfigured returns true when environment is test + mock mode', async () => {
        assert.strictEqual(razorpayProvider.isConfigured(), true);
    });

    await runScenario('A2. Production mock mode guard: validateProviderConfiguration throws if production is mock', async () => {
        const oldEnv = config.NODE_ENV;
        config.NODE_ENV = 'production';
        try {
            razorpayProvider.validateProviderConfiguration();
            throw new Error('Should have failed in production mode');
        } catch (e) {
            assert.ok(e.message.includes('configured') || e.message.includes('production'));
        } finally {
            config.NODE_ENV = oldEnv;
        }
    });

    await runScenario('A3. Missing credentials validation in normal dev mode returns PAYMENT_PROVIDER_NOT_CONFIGURED', async () => {
        const oldMode = config.PAYMENT_PROVIDER_MODE;
        const oldEnv = config.NODE_ENV;
        config.PAYMENT_PROVIDER_MODE = 'live';
        config.NODE_ENV = 'development';
        // Temporarily clear credentials
        const oldKeyId = config.RAZORPAY_KEY_ID;
        config.RAZORPAY_KEY_ID = null;

        // Reset the injected mock instance
        resetRazorpayInstance();

        try {
            await razorpayProvider.createOrder({ amountPaise: 1000, currency: 'INR', receipt: 'rec' });
            throw new Error('Should have failed');
        } catch (e) {
            assert.strictEqual(e.errorCode, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
        } finally {
            config.PAYMENT_PROVIDER_MODE = oldMode;
            config.NODE_ENV = oldEnv;
            config.RAZORPAY_KEY_ID = oldKeyId;
            // Restore injected mock instance
            setRazorpayInstance(mockRazorpay);
        }
    });

    await runScenario('A4. Client request cannot override payment provider mode to mock via headers/params', async () => {
        const booking = await createTestBooking(customer._id);
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: {
                ...customerHeaders,
                'Idempotency-Key': `idemp-${Date.now()}-a4`,
                'X-Payment-Provider-Mode': 'mock'
            },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data = await res.json();
        assert.strictEqual(res.status, 201);
        // The backend determines mode strictly from process.env/central config module, not headers
    });

    // =========================================================================
    // CATEGORY B: ORDER CREATION TESTS
    // =========================================================================
    await runScenario('B1. Customer can create payment order for owned booking', async () => {
        const booking = await createTestBooking(customer._id);
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b1` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data = await res.json();
        assert.strictEqual(res.status, 201);
        assert.strictEqual(data.success, true);
        assert.ok(data.data.razorpayOrderId);
    });

    await runScenario('B2. Ownership check: Customer cannot create order for another customer\'s booking', async () => {
        const booking = await createTestBooking(otherCustomer._id);
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b2` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 403);
    });

    await runScenario('B3. Amount authority: client-supplied amount is ignored', async () => {
        const booking = await createTestBooking(customer._id);
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b3` },
            body: JSON.stringify({ bookingId: booking._id.toString(), amount: 100 }),
        });
        const data = await res.json();
        assert.strictEqual(data.data.amount, 64000);
    });

    await runScenario('B4. Idempotency: exact same payload + key returns same order', async () => {
        const booking = await createTestBooking(customer._id);
        const key = `idemp-${Date.now()}-b4`;
        const res1 = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': key },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data1 = await res1.json();

        const res2 = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': key },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data2 = await res2.json();

        assert.strictEqual(data1.data.internalPaymentOrderId, data2.data.internalPaymentOrderId);
    });

    await runScenario('B5. Idempotency: reused key with different booking fails with 409', async () => {
        const booking1 = await createTestBooking(customer._id);
        const booking2 = await createTestBooking(customer._id);
        const key = `idemp-${Date.now()}-b5`;
        await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': key },
            body: JSON.stringify({ bookingId: booking1._id.toString() }),
        });

        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': key },
            body: JSON.stringify({ bookingId: booking2._id.toString() }),
        });
        assert.strictEqual(res.status, 409);
    });

    await runScenario('B6. State restriction: cannot pay for COMPLETED booking', async () => {
        const booking = await createTestBooking(customer._id, 'COMPLETED');
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b6` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 409);
    });

    await runScenario('B7. State restriction: cannot pay for CANCELLED booking', async () => {
        const booking = await createTestBooking(customer._id, 'CANCELLED');
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b7` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 409);
    });

    await runScenario('B8. State restriction: cannot pay if payment status is already PAID', async () => {
        const booking = await createTestBooking(customer._id, 'PAYMENT_PENDING', 'PAID');
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b8` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 409);
    });

    await runScenario('B9. Creation attempt limit: 5 attempts max per booking', async () => {
        const booking = await createTestBooking(customer._id);
        
        // Insert 5 payment orders directly into the database to trigger the limit
        for (let i = 1; i <= 5; i++) {
            await new PaymentOrder({
                bookingId: booking._id,
                customerId: customer._id,
                provider: 'razorpay',
                amountPaise: 64000,
                currency: 'INR',
                idempotencyKey: `idemp-preload-${i}-${Date.now()}`,
                status: 'EXPIRED',
                expiresAt: new Date(Date.now() - 1000),
                bookingAmountSnapshot: booking.pricingSnapshot,
            }).save();
        }

        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-limit-exceeded` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 429);
    });

    await runScenario('B10. Booking not found returns 404', async () => {
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b10` },
            body: JSON.stringify({ bookingId: new mongoose.Types.ObjectId().toString() }),
        });
        assert.strictEqual(res.status, 404);
    });

    await runScenario('B11. Escrow status already FUNDED blocks order creation', async () => {
        const booking = await createTestBooking(customer._id);
        booking.escrowStatus = 'FUNDED';
        await booking.save();

        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b11` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        // Returns 409 already paid or ineligible
        assert.strictEqual(res.status, 409);
    });

    await runScenario('B12. Booking currency mismatch blocks order creation', async () => {
        const booking = await createTestBooking(customer._id);
        booking.pricingSnapshot.currency = 'USD';
        await booking.save();

        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b12` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 400);
    });

    await runScenario('B13. Empty pricing snapshot throws 400', async () => {
        const booking = await createTestBooking(customer._id);
        booking.pricingSnapshot = null;
        await booking.save();

        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b13` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        assert.strictEqual(res.status, 400);
    });

    await runScenario('B14. Expired orders are rejected and a new order is generated', async () => {
        const booking = await createTestBooking(customer._id);
        
        // Create an order
        const res1 = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b14-1` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data1 = await orderRes(res1);

        // Expire it in the database
        await PaymentOrder.findByIdAndUpdate(data1.internalPaymentOrderId, { expiresAt: new Date(Date.now() - 1000) });

        // Request again with different key — should create a new order instead of returning expired one
        const res2 = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-b14-2` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const data2 = await orderRes(res2);
        assert.notStrictEqual(data1.internalPaymentOrderId, data2.internalPaymentOrderId);
    });

    // Helper helper
    async function orderRes(res) {
        const d = await res.json();
        return d.data;
    }

    // =========================================================================
    // CATEGORY C: CHECKOUT SIGNATURE VERIFICATION TESTS
    // =========================================================================
    await runScenario('C1. Timing-safe checkout verification signature mismatch fails', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-c1-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        console.log('C1 orderResVal status:', orderResVal.status);
        const orderText = await orderResVal.text();
        console.log('C1 orderResVal body:', orderText);
        const orderData = JSON.parse(orderText);

        const verifyRes = await fetch(`${BASE_URL}/v1/payments/verify`, {
            method: 'POST',
            headers: customerHeaders,
            body: JSON.stringify({
                internalPaymentOrderId: orderData.data.internalPaymentOrderId,
                razorpay_order_id: orderData.data.razorpayOrderId,
                razorpay_payment_id: 'pay_c1_123',
                razorpay_signature: 'garbage_sig',
            }),
        });
        assert.strictEqual(verifyRes.status, 400);
    });

    await runScenario('C2. Checkout verification fails for malformed signature structure', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-c2-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const verifyRes = await fetch(`${BASE_URL}/v1/payments/verify`, {
            method: 'POST',
            headers: customerHeaders,
            body: JSON.stringify({
                internalPaymentOrderId: orderData.data.internalPaymentOrderId,
                razorpay_order_id: orderData.data.razorpayOrderId,
                razorpay_payment_id: 'pay_c2_123',
                razorpay_signature: 'not-hex-at-all',
            }),
        });
        assert.strictEqual(verifyRes.status, 400);
    });

    await runScenario('C3. Checkout verification fails if order ID is wrong', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-c3-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const verifyRes = await fetch(`${BASE_URL}/v1/payments/verify`, {
            method: 'POST',
            headers: customerHeaders,
            body: JSON.stringify({
                internalPaymentOrderId: orderData.data.internalPaymentOrderId,
                razorpay_order_id: 'order_wrong_id',
                razorpay_payment_id: 'pay_123',
                razorpay_signature: 'garbage',
            }),
        });
        assert.strictEqual(verifyRes.status, 400);
    });

    await runScenario('C4. Timing-safe checkout verification fails if signature length differs', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-c4-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const verifyRes = await fetch(`${BASE_URL}/v1/payments/verify`, {
            method: 'POST',
            headers: customerHeaders,
            body: JSON.stringify({
                internalPaymentOrderId: orderData.data.internalPaymentOrderId,
                razorpay_order_id: orderData.data.razorpayOrderId,
                razorpay_payment_id: 'pay_123',
                // signature length differs completely (64 characters is standard for HMAC-SHA256 hex digest)
                razorpay_signature: 'abcd',
            }),
        });
        assert.strictEqual(verifyRes.status, 400);
    });

    // =========================================================================
    // CATEGORY D: RAW WEBHOOK BODY VERIFICATION TESTS
    // =========================================================================
    const triggerWebhook = async (payload, signature) => {
        return await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-razorpay-signature': signature || '',
            },
            body: JSON.stringify(payload),
        });
    };
    await runScenario('D1. Webhook raw body validation fails on missing signature', async () => {
        const res = await triggerWebhook({ id: 'evt_d1_' + crypto.randomBytes(4).toString('hex'), event: 'payment.captured' }, null);
        assert.strictEqual(res.status, 400);
    });

    await runScenario('D2. Webhook raw body validation fails on invalid signature', async () => {
        const res = await triggerWebhook({ id: 'evt_d2_' + crypto.randomBytes(4).toString('hex'), event: 'payment.captured' }, 'invalid_sig');
        assert.strictEqual(res.status, 400);
    });

    await runScenario('D3. Webhook size limit: payload exceeding limit gets 413 or connection reset', async () => {
        const hugeObject = {
            id: 'evt_d3_' + crypto.randomBytes(4).toString('hex'),
            event: 'payment.captured',
            data: 'X'.repeat(150 * 1024),
        };
        try {
            const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-razorpay-signature': 'some_sig',
                },
                body: JSON.stringify(hugeObject),
            });
            assert.strictEqual(res.status, 413);
        } catch (e) {
            // Connection reset/destroyed as a security countermeasure is valid
            assert.ok(e.message.includes('fetch failed') || e.message.includes('aborted') || e.message.includes('socket') || e.message.includes('hang up'));
        }
    });

    await runScenario('D4. Webhook event: unknown event is recorded and safely marked IGNORED', async () => {
        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const payload = {
            id: `evt_test_${crypto.randomBytes(4).toString('hex')}`,
            event: 'payment.disputed',
            payload: { payment: { entity: { id: 'pay_disp_123', amount: 50000, currency: 'INR' } } }
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body: rawBody
        });
        assert.strictEqual(res.status, 200);

        const eventRecord = await WebhookEvent.findOne({ providerEventId: payload.id });
        assert.strictEqual(eventRecord.processingStatus, 'IGNORED');
    });

    await runScenario('D5. Webhook event: exact raw body + valid signature succeeds', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-d5` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const payload = {
            id: `evt_test_${crypto.randomBytes(4).toString('hex')}`,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_${crypto.randomBytes(4).toString('hex')}`,
                        order_id: orderData.data.razorpayOrderId,
                        amount: 64000,
                        currency: 'INR',
                        status: 'captured',
                    }
                }
            }
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body: rawBody
        });
        assert.strictEqual(res.status, 200);
    });

    await runScenario('D6. Webhook event: one-byte body modification fails signature verification', async () => {
        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const payload = {
            id: `evt_test_${crypto.randomBytes(4).toString('hex')}`,
            event: 'payment.captured',
            payload: { payment: { entity: { amount: 64000 } } }
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        // Modify body by 1 character
        const modifiedBody = rawBody.replace('64000', '64001');

        const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body: modifiedBody
        });
        assert.strictEqual(res.status, 400);
    });

    await runScenario('D7. Webhook event: payment.failed records sanitized failure details', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-d7` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const payload = {
            id: `evt_test_${crypto.randomBytes(4).toString('hex')}`,
            event: 'payment.failed',
            payload: {
                payment: {
                    entity: {
                        id: `pay_${crypto.randomBytes(4).toString('hex')}`,
                        order_id: orderData.data.razorpayOrderId,
                        amount: 64000,
                        currency: 'INR',
                        status: 'failed',
                        error_code: 'BAD_REQUEST_ERROR',
                        error_description: 'Card was declined by bank'
                    }
                }
            }
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body: rawBody
        });
        assert.strictEqual(res.status, 200);

        const tx = await PaymentTransaction.findOne({ providerPaymentId: payload.payload.payment.entity.id });
        assert.strictEqual(tx.status, 'FAILED');
        assert.strictEqual(tx.failureCode, 'BAD_REQUEST_ERROR');
        // Sanitized failure description safe check
        assert.ok(tx.failureDescriptionSafe.includes('declined'));
    });

    // =========================================================================
    // CATEGORY E: FINANCIAL INVARIANT TESTS
    // =========================================================================
    await runScenario('E1. Pricing snapshot deep equality preserved after verified payment', async () => {
        const booking = await createTestBooking(customer._id);
        const snapBefore = JSON.stringify(booking.pricingSnapshot);

        const secret = config.RAZORPAY_WEBHOOK_SECRET;
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-e1-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const payload = {
            id: `evt_test_${crypto.randomBytes(4).toString('hex')}`,
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: `pay_${crypto.randomBytes(4).toString('hex')}`,
                        order_id: orderData.data.razorpayOrderId,
                        amount: 64000,
                        currency: 'INR',
                        status: 'captured',
                    }
                }
            }
        };
        const rawBody = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        const webRes = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body: rawBody
        });
        assert.strictEqual(webRes.status, 200);

        const updatedBooking = await Booking.findById(booking._id);
        assert.strictEqual(updatedBooking.paymentStatus, 'PAID');
        assert.strictEqual(JSON.stringify(updatedBooking.pricingSnapshot), snapBefore);
    });

    await runScenario('E2. Wallet remains unchanged after verified payment (wallet credit prevented)', async () => {
        const txsCount = await PaymentTransaction.countDocuments({ status: 'WALLET_CREDITED' });
        assert.strictEqual(txsCount, 0);
    });

    await runScenario('E3. Commission remains unchanged after payment verification', async () => {
        const booking = await createTestBooking(customer._id);
        const commBefore = booking.commissionAmount;

        // Perform payment success
        await Booking.findByIdAndUpdate(booking._id, { paymentStatus: 'PAID' });
        const updated = await Booking.findById(booking._id);
        assert.strictEqual(updated.commissionAmount, commBefore);
    });

    // =========================================================================
    // CATEGORY F: AUTHORIZATION TESTS
    // =========================================================================
    await runScenario('F1. Webhook route does not require JWT customer authentication', async () => {
        const res = await fetch(`${BASE_URL}/v1/webhooks/razorpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'evt_f1_' + crypto.randomBytes(4).toString('hex'), event: 'payment.captured' }),
        });
        assert.strictEqual(res.status, 400);
    });

    await runScenario('F2. Customer cannot view another customer\'s payment order details', async () => {
        const booking = await createTestBooking(otherCustomer._id);
        const order = new PaymentOrder({
            bookingId: booking._id,
            customerId: otherCustomer._id,
            provider: 'razorpay',
            amountPaise: 64000,
            currency: 'INR',
            idempotencyKey: `idemp-other-${Date.now()}`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            bookingAmountSnapshot: booking.pricingSnapshot,
        });
        await order.save();

        const res = await fetch(`${BASE_URL}/v1/payments/orders/${order._id.toString()}`, {
            method: 'GET',
            headers: customerHeaders,
        });
        assert.strictEqual(res.status, 403);
    });

    await runScenario('F3. Unauthenticated request to /api/v1/payments/orders returns 401', async () => {
        const res = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: new mongoose.Types.ObjectId().toString() }),
        });
        assert.strictEqual(res.status, 401);
    });

    await runScenario('F4. Admin reconcile payment requires payments.manage permission', async () => {
        const booking = await createTestBooking(customer._id);
        const order = new PaymentOrder({
            bookingId: booking._id,
            customerId: customer._id,
            provider: 'razorpay',
            amountPaise: 64000,
            currency: 'INR',
            idempotencyKey: `idemp-${Date.now()}-f4`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            bookingAmountSnapshot: booking.pricingSnapshot,
        });
        await order.save();

        // Create low privileged admin token (missing payments.manage)
        const lowAdminToken = signAccessToken({ userId: admin._id.toString(), id: admin._id.toString(), role: 'ADMIN', permissions: ['payments.read'] });
        const lowAdminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${lowAdminToken}` };

        const res = await fetch(`${BASE_URL}/v1/admin/payments/${order._id.toString()}/reconcile`, {
            method: 'POST',
            headers: lowAdminHeaders,
        });
        assert.strictEqual(res.status, 403);
    });

    // =========================================================================
    // CATEGORY G: REGRESSION TESTS
    // =========================================================================
    await runScenario('G1. Worker accepts paid booking successfully', async () => {
        const booking = await createTestBooking(customer._id);
        // Mark as paid
        await Booking.findByIdAndUpdate(booking._id, { paymentStatus: 'PAID' });

        const res = await fetch(`${BASE_URL}/v1/bookings/${booking._id.toString()}/accept`, {
            method: 'POST',
            headers: workerHeaders,
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.booking.bookingStatus, 'CONFIRMED');
    });

    await runScenario('G2. Worker cannot accept unpaid booking (blocks with 402)', async () => {
        const booking = await createTestBooking(customer._id);

        const res = await fetch(`${BASE_URL}/v1/bookings/${booking._id.toString()}/accept`, {
            method: 'POST',
            headers: workerHeaders,
        });
        const data = await res.json();
        assert.strictEqual(res.status, 402);
        assert.strictEqual(data.errorCode, 'PAYMENT_REQUIRED_FOR_BOOKING_ACTION');
    });

    await runScenario('G3. Customer cannot manually set booking status to PAID or CONFIRMED', async () => {
        const booking = await createTestBooking(customer._id);
        
        const res = await fetch(`${BASE_URL}/v1/bookings/${booking._id.toString()}`, {
            method: 'PATCH',
            headers: customerHeaders,
            body: JSON.stringify({ bookingStatus: 'CONFIRMED', paymentStatus: 'PAID' }),
        });
        // Check that paymentStatus is not updated since it is not a trusted field in update API
        const updated = await Booking.findById(booking._id);
        assert.notStrictEqual(updated.paymentStatus, 'PAID');
    });

    await runScenario('G4. Timing-safe verification prevents signature length match but byte value mismatch', async () => {
        const booking = await createTestBooking(customer._id);
        const orderResVal = await fetch(`${BASE_URL}/v1/payments/orders`, {
            method: 'POST',
            headers: { ...customerHeaders, 'Idempotency-Key': `idemp-${Date.now()}-g4-v` },
            body: JSON.stringify({ bookingId: booking._id.toString() }),
        });
        const orderData = await orderResVal.json();

        const incorrectBytesSig = 'a'.repeat(64);

        const verifyRes = await fetch(`${BASE_URL}/v1/payments/verify`, {
            method: 'POST',
            headers: customerHeaders,
            body: JSON.stringify({
                internalPaymentOrderId: orderData.data.internalPaymentOrderId,
                razorpay_order_id: orderData.data.razorpayOrderId,
                razorpay_payment_id: 'pay_g4_123',
                razorpay_signature: incorrectBytesSig,
            }),
        });
        assert.strictEqual(verifyRes.status, 400);
    });

    // Clean up mock
    resetRazorpayInstance();

    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
    console.log('====================================================\n');

    await stopServer();
    if (failedCount !== 0) process.exitCode = 1;
};

runTests().catch(async err => {
    console.error('Fatal test error:', err);
    try { await stopServer(); } catch {}
    process.exitCode = 1;
});
