import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationReviewEvent from '../models/VerificationReviewEvent.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';

export const getAdminWorkerVerifications = async (req, res, next) => {
    try {
        const { status, categoryId, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const filter = {};
        if (status) filter.status = status;

        if (categoryId) {
            // Find worker profiles matching category first
            const profiles = await WorkerProfile.find({ primaryServiceCategoryId: categoryId });
            const workerIds = profiles.map(p => p.userId);
            filter.workerId = { $in: workerIds };
        }

        const count = await VerificationSubmission.countDocuments(filter);
        const submissions = await VerificationSubmission.find(filter)
            .populate('workerId', 'name email status')
            .populate('documentIds')
            .sort({ submittedAt: -1 })
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

        // Validate final approval requirements: All active docs must be APPROVED
        const docs = await VerificationDocument.find({ workerId: submission.workerId, isCurrent: true });
        const unapprovedDoc = docs.find(d => d.verificationStatus !== 'APPROVED');
        if (unapprovedDoc) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_REQUIRED',
                message: `Document type '${unapprovedDoc.documentType}' is not approved.`
            });
        }

        // Date check: None should be expired
        const expiredDoc = docs.find(d => d.expiryDate && new Date(d.expiryDate) < new Date());
        if (expiredDoc) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_EXPIRED',
                message: `A required document '${expiredDoc.documentType}' has expired.`
            });
        }

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
