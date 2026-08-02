import mongoose from 'mongoose';
import RefundReconciliationService from '../services/payments/RefundReconciliationService.js';
import { connectDB } from '../config/db.js';

async function runReconciliation() {
    await connectDB();
    console.log(`[REFUND RECONCILE] Starting audit sweep...`);

    const result = await RefundReconciliationService.runReconciliationAudit();
    console.log(`[REFUND RECONCILE] Audited ${result.totalAudited} refund records.`);
    if (result.issues.length === 0) {
        console.log(`[REFUND RECONCILE] SUCCESS: Zero discrepancies found!`);
    } else {
        console.warn(`[REFUND RECONCILE] WARNING: Found ${result.issues.length} issues:`);
        for (const issue of result.issues) {
            console.warn(`  - [${issue.type}] Refund ID: ${issue.refundId} - ${issue.description}`);
        }
    }

    await mongoose.connection.close();
}

runReconciliation().catch(err => {
    console.error(err);
    process.exit(1);
});
