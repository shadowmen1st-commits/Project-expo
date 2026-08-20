import mongoose from 'mongoose';
import config from '../config/env.js';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationDocument from '../models/VerificationDocument.js';

async function migrateWorkerKYC() {
    console.log('=== STARTING WORKER KYC STATE AUDIT & MIGRATION ===');
    await mongoose.connect(config.MONGODB_URI);

    try {
        const workers = await User.find({ role: 'WORKER' });
        console.log(`Found ${workers.length} worker user accounts.`);

        let totalInspected = 0;
        let preservedApproved = 0;
        let setUnderReview = 0;
        let setRejected = 0;
        let setNotSubmitted = 0;

        for (const worker of workers) {
            totalInspected++;
            let profile = await WorkerProfile.findOne({ userId: worker._id });

            if (!profile) {
                profile = await WorkerProfile.create({
                    userId: worker._id,
                    fullName: worker.name,
                    phone: worker.phone,
                    verificationStatus: 'NOT_SUBMITTED',
                    isPubliclyVisible: false,
                    verificationBadge: false,
                });
                setNotSubmitted++;
                console.log(`[KYC MIGRATION] Worker ${worker.email} (${worker._id}) profile created -> NOT_SUBMITTED`);
                continue;
            }

            // Check for legitimate submissions & documents
            const [approvedSubmission, latestSubmission, activeDocs, approvedDocs] = await Promise.all([
                VerificationSubmission.findOne({ workerId: worker._id, status: 'APPROVED' }),
                VerificationSubmission.findOne({ workerId: worker._id }).sort({ submittedAt: -1, createdAt: -1 }),
                VerificationDocument.find({ workerId: worker._id, isCurrent: true }),
                VerificationDocument.find({ workerId: worker._id, isCurrent: true, verificationStatus: 'APPROVED' }),
            ]);

            // Legitimate Admin Approved Worker check:
            // 1. Has an approved submission or approved documents AND approvedAt / approvedBy
            // 2. OR is a pre-seeded system worker with verificationBadge explicitly set and approvedAt populated
            const hasLegitimateApproval = (approvedSubmission != null) ||
                (approvedDocs.length > 0 && profile.approvedAt != null) ||
                (profile.verificationStatus === 'APPROVED' && profile.approvedAt != null && profile.verificationBadge === true && activeDocs.length > 0);

            if (hasLegitimateApproval) {
                // Ensure profile fields are properly aligned
                profile.verificationStatus = 'APPROVED';
                profile.verificationBadge = true;
                profile.isPubliclyVisible = true;
                if (!profile.approvedAt) profile.approvedAt = new Date();
                await profile.save();
                preservedApproved++;
                console.log(`[KYC MIGRATION] Preserved APPROVED for verified worker: ${worker.email} (${worker._id})`);
            } else if (latestSubmission && ['PENDING_APPROVAL', 'UNDER_REVIEW', 'SUBMITTED'].includes(latestSubmission.status)) {
                profile.verificationStatus = 'PENDING_APPROVAL';
                profile.verificationBadge = false;
                profile.isPubliclyVisible = false;
                await profile.save();
                setUnderReview++;
                console.log(`[KYC MIGRATION] Set PENDING_APPROVAL for pending submission: ${worker.email} (${worker._id})`);
            } else if (latestSubmission && latestSubmission.status === 'REJECTED') {
                profile.verificationStatus = 'REJECTED';
                profile.verificationBadge = false;
                profile.isPubliclyVisible = false;
                await profile.save();
                setRejected++;
                console.log(`[KYC MIGRATION] Set REJECTED for rejected submission: ${worker.email} (${worker._id})`);
            } else {
                // No valid submission or approval documents exist
                profile.verificationStatus = 'NOT_SUBMITTED';
                profile.verificationBadge = false;
                profile.isPubliclyVisible = false;
                profile.approvedAt = undefined;
                profile.approvedBy = undefined;
                await profile.save();
                setNotSubmitted++;
                console.log(`[KYC MIGRATION] Reset to NOT_SUBMITTED (unverified): ${worker.email} (${worker._id})`);
            }
        }

        console.log('=== WORKER KYC MIGRATION SUMMARY ===');
        console.log(`Total Inspected:     ${totalInspected}`);
        console.log(`Preserved APPROVED:  ${preservedApproved}`);
        console.log(`Set UNDER_REVIEW:    ${setUnderReview}`);
        console.log(`Set REJECTED:        ${setRejected}`);
        console.log(`Set NOT_SUBMITTED:   ${setNotSubmitted}`);
        console.log('====================================');
    } finally {
        await mongoose.disconnect();
    }
}

migrateWorkerKYC().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
