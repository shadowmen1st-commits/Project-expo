import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationReviewEvent from '../models/VerificationReviewEvent.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

export const getAdminWorkerVerifications = async (req, res, next) => {
    try {
        const { status, categoryId, page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // 1. Clean up any orphan submissions where workerId is missing or user does not exist
        const allSubmissions = await VerificationSubmission.find({}).select('_id workerId');
        for (const sub of allSubmissions) {
            if (!sub.workerId) {
                await VerificationSubmission.findByIdAndDelete(sub._id);
                continue;
            }
            const userExists = await User.exists({ _id: sub.workerId, role: 'WORKER' });
            if (!userExists) {
                await VerificationSubmission.findByIdAndDelete(sub._id);
            }
        }

        // 2. Synchronize all real WorkerProfiles into VerificationSubmissions
        const allProfiles = await WorkerProfile.find({}).populate('userId', 'name email phone status');
        for (const profile of allProfiles) {
            if (!profile.userId) continue;
            const workerId = profile.userId._id;

            // Map status
            const pStatus = profile.verificationStatus || 'PENDING_APPROVAL';
            let mappedStatus = 'PENDING_APPROVAL';
            if (['APPROVED', 'VERIFIED'].includes(pStatus)) {
                mappedStatus = 'APPROVED';
            } else if (['REJECTED'].includes(pStatus)) {
                mappedStatus = 'REJECTED';
            } else if (['CHANGES_REQUIRED', 'MORE_INFO_REQUIRED'].includes(pStatus)) {
                mappedStatus = 'CHANGES_REQUIRED';
            } else if (['SUSPENDED'].includes(pStatus)) {
                mappedStatus = 'SUSPENDED';
            } else {
                mappedStatus = 'PENDING_APPROVAL';
            }

            const docs = await VerificationDocument.find({ workerId, isCurrent: true });
            const docIds = docs.map(d => d._id);

            let sub = await VerificationSubmission.findOne({ workerId }).sort({ version: -1, createdAt: -1 });
            if (!sub) {
                sub = await VerificationSubmission.create({
                    workerId,
                    submissionNumber: 1,
                    version: 1,
                    profileSnapshot: {
                        fullName: profile.userId.name || profile.fullName || 'Worker Pro',
                        bio: profile.bio || 'Verified service professional',
                        hourlyRate: profile.hourlyRate || 250,
                        yearsOfExperience: profile.yearsOfExperience || 1,
                    },
                    serviceSnapshot: {
                        primaryServiceCategoryId: profile.primaryServiceCategoryId || null,
                        primaryCategoryName: profile.primaryCategoryName || 'General Services',
                        serviceCategories: profile.serviceCategories || []
                    },
                    documentIds: docIds,
                    declarationAccepted: true,
                    consentAccepted: true,
                    status: mappedStatus,
                    submittedAt: profile.submittedAt || profile.createdAt || new Date(),
                });
            } else {
                let shouldSave = false;
                if (sub.status !== mappedStatus) {
                    sub.status = mappedStatus;
                    shouldSave = true;
                }
                if (!sub.profileSnapshot?.fullName || sub.profileSnapshot.fullName === 'Worker Pro') {
                    sub.profileSnapshot = {
                        fullName: profile.userId.name || profile.fullName || 'Worker Pro',
                        bio: profile.bio || 'Verified service professional',
                        hourlyRate: profile.hourlyRate || 250,
                        yearsOfExperience: profile.yearsOfExperience || 1,
                    };
                    shouldSave = true;
                }
                if (!sub.serviceSnapshot || !sub.serviceSnapshot.primaryCategoryName) {
                    sub.serviceSnapshot = {
                        primaryServiceCategoryId: profile.primaryServiceCategoryId || null,
                        primaryCategoryName: profile.primaryCategoryName || 'General Services',
                        serviceCategories: profile.serviceCategories || []
                    };
                    shouldSave = true;
                }
                if (docIds.length > 0 && (!sub.documentIds || sub.documentIds.length === 0)) {
                    sub.documentIds = docIds;
                    shouldSave = true;
                }
                if (shouldSave) {
                    await sub.save();
                }
            }
        }

        // 3. Filter submissions based on requested status & category
        const filter = {};
        if (status) {
            if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
                filter.status = { $in: ['PENDING_APPROVAL', 'UNDER_REVIEW', 'PENDING', 'SUBMITTED'] };
            } else if (status === 'CHANGES_REQUIRED') {
                filter.status = { $in: ['CHANGES_REQUIRED', 'MORE_INFO_REQUIRED'] };
            } else {
                filter.status = status;
            }
        }

        if (categoryId) {
            const profiles = await WorkerProfile.find({ primaryServiceCategoryId: categoryId });
            const workerIds = profiles.map(p => p.userId);
            filter.workerId = { $in: workerIds };
        }

        const count = await VerificationSubmission.countDocuments(filter);
        const submissions = await VerificationSubmission.find(filter)
            .populate('workerId', 'name email phone status')
            .populate('documentIds')
            .sort({ submittedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            data: submissions,
            pagination: {
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / Number(limit))
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getAdminWorkerVerificationDetail = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const submission = await VerificationSubmission.findById(submissionId)
            .populate('workerId', 'name email phone status')
            .populate('documentIds');

        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }

        const events = await VerificationReviewEvent.find({ submissionId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                submission,
                historyTimeline: events
            }
        });
    } catch (error) {
        next(error);
    }
};

export const startReview = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const submission = await VerificationSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }

        submission.reviewStartedAt = new Date();
        submission.reviewedBy = req.user.userId;
        await submission.save();

        // Create review event log
        await new VerificationReviewEvent({
            workerId: submission.workerId,
            submissionId,
            action: 'START_REVIEW',
            previousStatus: submission.status,
            newStatus: submission.status,
            actorId: req.user.userId,
            actorRole: req.user.role,
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Review session started.', data: submission });
    } catch (error) {
        next(error);
    }
};

export const approveDocument = async (req, res, next) => {
    try {
        const { submissionId, documentId } = req.params;
        const doc = await VerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const previousStatus = doc.verificationStatus;
        doc.verificationStatus = 'APPROVED';
        doc.reviewedBy = req.user.userId;
        doc.reviewedAt = new Date();
        await doc.save();

        await new VerificationReviewEvent({
            workerId: doc.workerId,
            submissionId,
            documentId,
            action: 'APPROVE_DOCUMENT',
            previousStatus,
            newStatus: 'APPROVED',
            actorId: req.user.userId,
            actorRole: req.user.role,
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Document approved successfully.', data: doc });
    } catch (error) {
        next(error);
    }
};

export const requestDocumentChanges = async (req, res, next) => {
    try {
        const { submissionId, documentId } = req.params;
        const { reasonCode, comment } = req.body;

        if (!reasonCode) {
            return res.status(400).json({ success: false, message: 'Reason code is required.' });
        }

        const doc = await VerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const previousStatus = doc.verificationStatus;
        doc.verificationStatus = 'CHANGES_REQUIRED';
        doc.reviewReasonCode = reasonCode;
        doc.reviewComment = comment;
        doc.reviewedBy = req.user.userId;
        doc.reviewedAt = new Date();
        await doc.save();

        await new VerificationReviewEvent({
            workerId: doc.workerId,
            submissionId,
            documentId,
            action: 'REQUEST_DOCUMENT_CHANGES',
            previousStatus,
            newStatus: 'CHANGES_REQUIRED',
            reasonCode,
            safeComment: comment,
            actorId: req.user.userId,
            actorRole: req.user.role,
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Document changes requested.', data: doc });
    } catch (error) {
        next(error);
    }
};

export const rejectDocument = async (req, res, next) => {
    try {
        const { submissionId, documentId } = req.params;
        const { reasonCode, comment } = req.body;

        if (!reasonCode) {
            return res.status(400).json({ success: false, message: 'Reason code is required.' });
        }

        const doc = await VerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        const previousStatus = doc.verificationStatus;
        doc.verificationStatus = 'REJECTED';
        doc.reviewReasonCode = reasonCode;
        doc.reviewComment = comment;
        doc.reviewedBy = req.user.userId;
        doc.reviewedAt = new Date();
        await doc.save();

        await new VerificationReviewEvent({
            workerId: doc.workerId,
            submissionId,
            documentId,
            action: 'REJECT_DOCUMENT',
            previousStatus,
            newStatus: 'REJECTED',
            reasonCode,
            safeComment: comment,
            actorId: req.user.userId,
            actorRole: req.user.role,
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Document rejected.', data: doc });
    } catch (error) {
        next(error);
    }
};

export const requestChangesSubmission = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const { reasonCode, comment } = req.body;

        if (!reasonCode) {
            return res.status(400).json({ success: false, message: 'Reason code is mandatory.' });
        }

        const submission = await VerificationSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }

        const previousStatus = submission.status;
        submission.status = 'CHANGES_REQUIRED';
        submission.finalReasonCode = reasonCode;
        submission.finalComment = comment;
        submission.finalDecisionAt = new Date();
        submission.reviewedBy = req.user.userId;
        await submission.save();

        const profile = await WorkerProfile.findOne({ userId: submission.workerId });
        if (profile) {
            profile.verificationStatus = 'CHANGES_REQUIRED';
            profile.rejectionReason = comment;
            profile.isPubliclyVisible = false;
            await profile.save();
        }

        // Notify Worker
        await new Notification({
            recipientId: submission.workerId,
            title: 'Verification Status: Changes Required',
            message: `Admin requested changes to your documents: ${comment}`,
            type: 'WARNING'
        }).save();

        // Log audit
        await new AuditLog({
            actor: req.user.userId,
            action: 'ADMIN_WORKER_VERIFY_CHANGES_REQUIRED',
            resourceType: 'WorkerProfile',
            resourceId: profile?._id.toString() || '',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Verification status set to CHANGES_REQUIRED.', data: submission });
    } catch (error) {
        next(error);
    }
};

export const approveSubmission = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const submission = await VerificationSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }

        const profile = await WorkerProfile.findOne({ userId: submission.workerId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Worker profile not found.' });
        }

        // Auto-approve active verification documents if any
        await VerificationDocument.updateMany(
            { workerId: submission.workerId, isCurrent: true },
            { verificationStatus: 'APPROVED', reviewedBy: req.user.userId, reviewedAt: new Date() }
        );

        submission.status = 'APPROVED';
        submission.finalDecisionAt = new Date();
        submission.reviewedBy = req.user.userId;
        await submission.save();

        profile.verificationStatus = 'APPROVED';
        profile.verificationBadge = true;
        profile.isPubliclyVisible = true;
        profile.approvedAt = new Date();
        profile.approvedBy = req.user.userId;
        await profile.save();

        await User.findByIdAndUpdate(submission.workerId, { status: 'ACTIVE' });

        // Worker Notification
        await new Notification({
            recipientId: submission.workerId,
            title: 'Verification Approved 🎉',
            message: 'Your profile has been fully verified and is now live.',
            type: 'SUCCESS'
        }).save();

        // Log audit
        await new AuditLog({
            actor: req.user.userId,
            action: 'ADMIN_WORKER_VERIFY_APPROVED',
            resourceType: 'WorkerProfile',
            resourceId: profile._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Worker profile fully approved.', data: submission });
    } catch (error) {
        next(error);
    }
};

export const rejectSubmission = async (req, res, next) => {
    try {
        const { submissionId } = req.params;
        const { reasonCode, comment } = req.body;

        if (!reasonCode) {
            return res.status(400).json({ success: false, message: 'Reason code is mandatory.' });
        }

        const submission = await VerificationSubmission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found.' });
        }

        const profile = await WorkerProfile.findOne({ userId: submission.workerId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Worker profile not found.' });
        }

        submission.status = 'REJECTED';
        submission.finalReasonCode = reasonCode;
        submission.finalComment = comment;
        submission.finalDecisionAt = new Date();
        submission.reviewedBy = req.user.userId;
        await submission.save();

        profile.verificationStatus = 'REJECTED';
        profile.verificationBadge = false;
        profile.isPubliclyVisible = false;
        profile.rejectionReason = comment;
        profile.rejectedAt = new Date();
        await profile.save();

        // Worker Notification
        await new Notification({
            recipientId: submission.workerId,
            title: 'Verification Status: REJECTED',
            message: `Your verification submission was rejected: ${comment}`,
            type: 'WARNING'
        }).save();

        // Log audit
        await new AuditLog({
            actor: req.user.userId,
            action: 'ADMIN_WORKER_VERIFY_REJECTED',
            resourceType: 'WorkerProfile',
            resourceId: profile._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Worker profile verification rejected.', data: submission });
    } catch (error) {
        next(error);
    }
};

export const suspendWorker = async (req, res, next) => {
    try {
        const { workerId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Suspension reason is mandatory.' });
        }

        const profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Worker profile not found.' });
        }

        profile.verificationStatus = 'SUSPENDED';
        profile.isPubliclyVisible = false;
        profile.suspensionReason = reason;
        profile.suspendedAt = new Date();
        await profile.save();

        // Worker Notification
        await new Notification({
            recipientId: workerId,
            title: 'Account Suspended',
            message: `Your provider account has been suspended: ${reason}. Contact support.`,
            type: 'WARNING'
        }).save();

        // Log audit
        await new AuditLog({
            actor: req.user.userId,
            action: 'ADMIN_WORKER_SUSPEND',
            resourceType: 'WorkerProfile',
            resourceId: profile._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Worker profile suspended.', data: profile });
    } catch (error) {
        next(error);
    }
};

export const restoreWorker = async (req, res, next) => {
    try {
        const { workerId } = req.params;
        const profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Worker profile not found.' });
        }

        profile.verificationStatus = 'APPROVED';
        profile.isPubliclyVisible = true;
        profile.suspensionReason = undefined;
        await profile.save();

        // Worker Notification
        await new Notification({
            recipientId: workerId,
            title: 'Account Restored',
            message: 'Your provider account has been restored to active status.',
            type: 'SUCCESS'
        }).save();

        // Log audit
        await new AuditLog({
            actor: req.user.userId,
            action: 'ADMIN_WORKER_RESTORE',
            resourceType: 'WorkerProfile',
            resourceId: profile._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Worker profile restored successfully.', data: profile });
    } catch (error) {
        next(error);
    }
};
