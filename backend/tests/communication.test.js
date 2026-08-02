process.env.NODE_ENV='test';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/utils/authUtils.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import ConversationParticipantState from '../src/models/ConversationParticipantState.js';
import NotificationOutbox from '../src/models/NotificationOutbox.js';
import SupportTicket from '../src/models/SupportTicket.js';
import SupportTicketMessage from '../src/models/SupportTicketMessage.js';

let replSet;
let app;
let customerCookie;
let workerCookie;
let adminCookie;
let customerId;
let workerId;
let adminId;
let testBookingId;

before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    // Create collections manually to avoid WriteConflict in transactions
    await User.createCollection();
    await Booking.createCollection();
    await Conversation.createCollection();
    await Message.createCollection();
    await NotificationOutbox.createCollection();
    await ConversationParticipantState.createCollection();
    await SupportTicket.createCollection();
    await SupportTicketMessage.createCollection();

    app = createApp();

    const pwd = await hashPassword('Test@123');

    const customer = await User.create({
        name: 'Chat Customer',
        email: 'chatcust@test.com',
        passwordHash: pwd,
        role: 'CUSTOMER',
        phone: '+12345678901'
    });
    customerId = customer._id;

    const worker = await User.create({
        name: 'Chat Worker',
        email: 'chatwork@test.com',
        passwordHash: pwd,
        role: 'WORKER',
        phone: '+12345678902',
        workerStatus: 'VERIFIED'
    });
    workerId = worker._id;

    const admin = await User.create({
        name: 'Chat Admin',
        email: 'chatadmin@test.com',
        passwordHash: pwd,
        role: 'ADMIN',
        phone: '+12345678903'
    });
    adminId = admin._id;

    const booking = await Booking.create({
        bookingNumber: 'BKG-TEST-001',
        customerId,
        workerId,
        serviceCategoryId: new mongoose.Types.ObjectId(),
        serviceAddress: '123 Test St',
        scheduledStart: new Date(Date.now() + 86400000),
        scheduledEnd: new Date(Date.now() + 86400000 + 3600000),
        durationMinutes: 60,
        pricingType: 'HOURLY',
        baseAmount: 5000,
        platformFee: 500,
        taxAmount: 0,
        totalAmount: 5500,
        commissionPercentage: 10,
        commissionAmount: 500,
        workerEarning: 4500,
        bookingStatus: 'ACCEPTED',
        paymentStatus: 'PAID',
        escrowStatus: 'FUNDED'
    });
    testBookingId = booking._id;

    const loginC = await request(app).post('/api/auth/login').send({ email: 'chatcust@test.com', password: 'Test@123' });
    customerCookie = loginC.headers['set-cookie'];

    const loginW = await request(app).post('/api/auth/login').send({ email: 'chatwork@test.com', password: 'Test@123' });
    workerCookie = loginW.headers['set-cookie'];

    const loginA = await request(app).post('/api/auth/login').send({ email: 'chatadmin@test.com', password: 'Test@123' });
    adminCookie = loginA.headers['set-cookie'];
});

after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
});

describe('Chat, Notifications, & Support (Communication Phase)', () => {
    describe('1. Booking-Scoped Chat', () => {
        let conversationId;

        it('Should allow customer to send a message on an ACCEPTED booking', async () => {
            const res = await request(app)
                .post(`/api/v1/chat/bookings/${testBookingId}/messages`)
                .set('Cookie', customerCookie)
                .send({
                    text: 'Hello, are you on your way?',
                    clientMessageId: 'temp-1'
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.bodySafe, 'Hello, are you on your way?');
            assert.strictEqual(res.body.sequenceNumber, 1);
            conversationId = res.body.conversationId;

            const outbox = await NotificationOutbox.findOne({ eventType: 'NEW_CHAT_MESSAGE' });
            assert.ok(outbox);
            assert.strictEqual(outbox.recipientIds[0].toString(), workerId.toString());
        });

        it('Should reject identical clientMessageId (idempotency check)', async () => {
            const res = await request(app)
                .post(`/api/v1/chat/bookings/${testBookingId}/messages`)
                .set('Cookie', customerCookie)
                .send({
                    text: 'Hello, are you on your way?',
                    clientMessageId: 'temp-1'
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.sequenceNumber, 1);
        });

        it('Should reject unauthorized user sending to the booking', async () => {
            const unrelated = await User.create({
                name: 'Unrelated User',
                email: 'unrelated@test.com',
                passwordHash: await hashPassword('Test@123'),
                role: 'CUSTOMER',
                phone: '+12345678904'
            });
            const login = await request(app).post('/api/auth/login').send({ email: 'unrelated@test.com', password: 'Test@123' });
            const uCookie = login.headers['set-cookie'];

            const res = await request(app)
                .post(`/api/v1/chat/bookings/${testBookingId}/messages`)
                .set('Cookie', uCookie)
                .send({ text: 'Spying message' });

            assert.strictEqual(res.status, 403);
            assert.ok(res.body.message.includes('Chat not permitted'));
        });

        it('Should retrieve conversation history for worker', async () => {
            const res = await request(app)
                .get(`/api/v1/chat/bookings/${testBookingId}/messages`)
                .set('Cookie', workerCookie);

            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body.messages));
            assert.strictEqual(res.body.messages.length, 1);
            assert.strictEqual(res.body.messages[0].bodySafe, 'Hello, are you on your way?');
        });
    });

    describe('2. Support Ticketing & SLA', () => {
        let ticketId;

        it('Should allow customer to create a support ticket', async () => {
            const res = await request(app)
                .post('/api/v1/support')
                .set('Cookie', customerCookie)
                .send({
                    category: 'PAYMENT',
                    subject: 'Double charged',
                    description: 'I was charged twice for this booking.'
                });

            assert.strictEqual(res.status, 201);
            assert.match(res.body.ticketNumber, /^TKT-/);
            assert.strictEqual(res.body.status, 'OPEN');
            ticketId = res.body._id;
        });

        it('Should list tickets for the customer', async () => {
            const res = await request(app)
                .get('/api/v1/support')
                .set('Cookie', customerCookie);

            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body));
            assert.strictEqual(res.body.length, 1);
        });

        it('Should allow admin to add an internal note', async () => {
            const res = await request(app)
                .post(`/api/v1/support/${ticketId}/messages`)
                .set('Cookie', adminCookie)
                .send({
                    body: 'Looking into Stripe logs.',
                    visibility: 'INTERNAL_ONLY'
                });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.body.visibility, 'INTERNAL_ONLY');
        });

        it('Should not show internal notes to customer', async () => {
            const res = await request(app)
                .get(`/api/v1/support/${ticketId}`)
                .set('Cookie', customerCookie);

            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.messages.length, 1);
            assert.strictEqual(res.body.messages[0].visibility, 'REQUESTER_VISIBLE');
        });
    });

    describe('3. Notifications & Dispatching', () => {
        it('Should fetch notifications for the user', async () => {
            await request(app)
                .get('/api/v1/notifications')
                .set('Cookie', workerCookie)
                .expect(200);
        });

        it('Should get and update notification preferences', async () => {
            const getRes = await request(app)
                .get('/api/v1/notifications/preferences')
                .set('Cookie', customerCookie);

            assert.strictEqual(getRes.status, 200);
            assert.strictEqual(getRes.body.channelPreferences.EMAIL, true);

            const putRes = await request(app)
                .put('/api/v1/notifications/preferences')
                .set('Cookie', customerCookie)
                .send({
                    channelPreferences: { EMAIL: false }
                });

            assert.strictEqual(putRes.status, 200);
            assert.strictEqual(putRes.body.channelPreferences.EMAIL, false);
        });
    });
});
