import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer, MongoMemoryReplSet } from 'mongodb-memory-server';

let memory;
let topology;
let originalEnv;

function configureTestEnvironment() {
    originalEnv = originalEnv || { ...process.env };
    Object.assign(process.env, {
        NODE_ENV: 'test', PAYMENT_PROVIDER: 'mock', PAYMENT_PROVIDER_MODE: 'mock',
        PAYOUT_PROVIDER: 'mock', PAYOUT_PROVIDER_MODE: 'mock',
        RAZORPAY_KEY_ID: 'rzp_test_fixture', RAZORPAY_KEY_SECRET: 'fixture-secret',
        RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook-secret',
        PAYOUT_DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
        PAYOUT_DATA_ENCRYPTION_KEY_VERSION: 'test-v1', JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret', CUSTOMER_APP_URL: 'http://test.local',
        WEB_ADMIN_URL: 'http://admin.test.local', CORS_ALLOWED_ORIGINS: 'http://test.local,http://admin.test.local',
    });
}

async function start(kind) {
    if (mongoose.connection.readyState !== 0 || memory) throw new Error('Test environment is already running.');
    configureTestEnvironment();
    const dbName = `hyperlocal_test_${crypto.randomBytes(6).toString('hex')}`;
    if (kind === 'replicaSet') memory = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    else memory = await MongoMemoryServer.create();
    topology = kind;
    const uri = memory.getUri(dbName);
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName });
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    assertSafeDatabase();
    if (kind === 'replicaSet') await verifyTransactionSupport();
    console.log(`TEST_DATABASE=${dbName} TEST_TOPOLOGY=${kind}`);
    return { uri, dbName, topology: kind };
}

export const startStandaloneTestEnvironment = () => start('standalone');
export const startReplicaSetTestEnvironment = () => start('replicaSet');

export function assertSafeDatabase() {
    if (process.env.NODE_ENV !== 'test') throw new Error('Refusing test cleanup outside NODE_ENV=test.');
    const name = mongoose.connection.name || '';
    if (!name.toLowerCase().includes('test')) throw new Error(`Refusing cleanup for unsafe database name: ${name}`);
    return true;
}

export async function resetDatabase() { assertSafeDatabase(); await mongoose.connection.dropDatabase(); }

export async function verifyTransactionSupport() {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => { await mongoose.connection.db.collection('transaction_probes').insertOne({ ok: true }, { session }); throw new Error('TEST_ABORT'); }); }
    catch (error) { if (error.message !== 'TEST_ABORT') throw error; }
    finally { await session.endSession(); }
    if (await mongoose.connection.db.collection('transaction_probes').countDocuments()) throw new Error('Transaction abort verification failed.');
    return true;
}

export async function createTestApp() { const { createApp } = await import('../../src/app.js'); await Promise.all(Object.values(mongoose.models).map(model => model.init())); return createApp(); }

export async function stopTestEnvironment() {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (memory) await memory.stop();
    memory = undefined; topology = undefined;
}

export function activeTopology() { return topology; }
