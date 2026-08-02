import mongoose from 'mongoose';
import DisputeCase from '../models/DisputeCase.js';
import { connectDB } from '../config/db.js';

async function runSweep() {
    await connectDB();
    const now = new Date();

    console.log(`[DISPUTE SWEEP] Starting scan at ${now.toISOString()}`);

    // Find disputes where response deadline has passed and status is still OPEN or EVIDENCE_REQUIRED
    const disputes = await DisputeCase.find({
        status: { $in: ['OPEN', 'EVIDENCE_REQUIRED'] },
        workerResponseDueAt: { $lte: now },
    });

    console.log(`[DISPUTE SWEEP] Found ${disputes.length} disputes with expired deadlines.`);

    let updatedCount = 0;
    for (const dispute of disputes) {
        dispute.status = 'RESOLUTION_PENDING';
        dispute.internalAdminNotes = `${dispute.internalAdminNotes || ''}\n[SWEEP] Automatically marked RESOLUTION_PENDING due to missed deadline.`;
        await dispute.save();
        updatedCount++;
    }

    console.log(`[DISPUTE SWEEP] Completed sweep. Updated ${updatedCount} cases.`);
    await mongoose.connection.close();
}

runSweep().catch(err => {
    console.error(err);
    process.exit(1);
});
