import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanFailedPaymentOrders() {
    console.log('=== CLEANING UP STALE FAILED PAYMENT ORDERS ===');
    const uri = process.env.MONGODB_URI;

    for (const dbName of ['test', 'hyperlocal']) {
        console.log(`Connecting to ${dbName}...`);
        const conn = await mongoose.createConnection(uri, { dbName }).asPromise();
        const PaymentOrder = conn.model('PaymentOrder', new mongoose.Schema({}, { strict: false }));
        
        const result = await PaymentOrder.deleteMany({
            status: { $in: ['FAILED', 'EXPIRED', 'CREATED'] }
        });
        
        console.log(`  ✅ Deleted ${result.deletedCount} stale payment orders in ${dbName}`);
        await conn.close();
    }
    console.log('CLEANUP COMPLETE!');
}

cleanFailedPaymentOrders().catch(console.error);
