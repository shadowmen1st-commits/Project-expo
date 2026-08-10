import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import ServiceCategory from '../models/ServiceCategory.js';
import CommissionRule from '../models/CommissionRule.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import WalletLedger from '../models/WalletLedger.js';
import { adminVerifyWorkerSchema, categoryCreateSchema, commissionRuleCreateSchema } from '../utils/validation.js';
import { decryptText } from '../utils/crypto.js';
import { recordTransaction } from '../services/ledger.js';
import CompanyProfile from '../models/CompanyProfile.js';
import Job from '../models/Job.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import CompanyPayment from '../models/CompanyPayment.js';
import CompanyVerificationDocument from '../models/CompanyVerificationDocument.js';
export const getPendingWorkers = async (req, res, next) => {
    try {
        const pending = await WorkerProfile.find({
            verificationStatus: { $in: ['PENDING_APPROVAL', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'] },
        }).populate('userId', 'name email phone profileImage status');
        const dtos = [];
        for (const p of pending) {
            // Historical/incomplete profiles can outlive a deleted user. They are
            // not actionable verification requests and must not become blank UI rows.
            if (!p.userId) continue;
            const docs = await VerificationDocument.find({ workerId: p.userId?._id });
            dtos.push({
                profile: p,
                documents: docs,
            });
        }
        res.status(200).json({ success: true, data: dtos });
    }
    catch (error) {
        next(error);
    }
};
export const verifyWorker = async (req, res, next) => {
    const { id } = req.params; // worker userId
    try {
        const validatedData = adminVerifyWorkerSchema.parse(req.body);
        const { action, reason } = validatedData;
        const profile = await WorkerProfile.findOne({ userId: id });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Worker profile not found.' });
            return;
        }
        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        // Update profile verification status
        profile.verificationStatus = action;
        if (action === 'APPROVED') {
            profile.verificationBadge = true;
            profile.isPubliclyVisible = true;
            profile.approvedAt = new Date();
            profile.approvedBy = req.user?.userId;
        }
        else {
            profile.verificationBadge = false;
            profile.isPubliclyVisible = false;
            profile.rejectionReason = reason;
        }
        await profile.save();
        // Update document statuses as well
        const docStatus = action === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        await VerificationDocument.updateMany({ workerId: id }, {
            verificationStatus: docStatus,
            reviewedBy: req.user?.userId,
            reviewedAt: new Date(),
            rejectionReason: reason,
        });
        // Save Audit Log
        await new AuditLog({
            actor: req.user?.userId,
            action: `ADMIN_WORKER_VERIFY_${action}`,
            resourceType: 'WorkerProfile',
            resourceId: profile._id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();
        // Notify Worker
        await new Notification({
            recipientId: id,
            title: `Account Verification: ${action}`,
            message: `Your worker profile status was updated to ${action.toLowerCase()}. Reason: ${reason}`,
            type: action === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        }).save();
        res.status(200).json({ success: true, message: `Worker status updated to ${action}.` });
    }
    catch (error) {
        next(error);
    }
};
export const viewDocumentDetails = async (req, res, next) => {
    const { docId } = req.params;
    try {
        const document = await VerificationDocument.findById(docId);
        if (!document) {
            res.status(404).json({ success: false, message: 'Document not found.' });
            return;
        }
        // Decrypt the number
        const decryptedNumber = decryptText(document.documentNumberEncrypted);
        // Create Audit Log of document access
        await new AuditLog({
            actor: req.user?.userId,
            action: 'ADMIN_DOCUMENT_VIEW_DECRYPTED',
            resourceType: 'VerificationDocument',
            resourceId: docId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();
        res.status(200).json({
            success: true,
            documentType: document.documentType,
            documentNumber: decryptedNumber,
        });
    }
    catch (error) {
        next(error);
    }
};
export const createCategory = async (req, res, next) => {
    try {
        const validatedData = categoryCreateSchema.parse(req.body);
        const slug = validatedData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const category = new ServiceCategory({
            ...validatedData,
            slug,
        });
        await category.save();
        res.status(201).json({ success: true, category });
    }
    catch (error) {
        next(error);
    }
};
export const getCategories = async (req, res, next) => {
    try {
        const categories = await ServiceCategory.find({ isActive: { $ne: false } }).sort({ sortOrder: 1 });
        res.status(200).json({ success: true, categories });
    }
    catch (error) {
        next(error);
    }
};
export const deleteCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId || req.params.id;

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        // Validate ObjectId format
        if (!categoryId || !categoryId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID format.' });
        }
        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Service category not found' });
        }
        if (category.isActive === false) {
            return res.status(409).json({ success: false, message: 'This category has already been removed.' });
        }
        // Check for references: active bookings
        const bookingRef = await Booking.findOne({ serviceCategoryId: categoryId, status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] } });
        if (bookingRef) {
            return res.status(409).json({
                success: false,
                message: `Cannot remove "${category.name}" — it has active bookings. Resolve existing bookings first.`
            });
        }
        // Check for references: active workers assigned to this category
        const workerRef = await WorkerProfile.findOne({
            $or: [
                { primaryServiceCategoryId: categoryId },
                { serviceCategoryIds: categoryId },
            ],
            verificationStatus: 'APPROVED',
        });
        if (workerRef) {
            return res.status(409).json({
                success: false,
                message: `Cannot remove "${category.name}" — it has approved workers assigned. Reassign workers first.`
            });
        }
        // Soft delete
        category.isActive = false;
        category.deletedAt = new Date();
        category.deletedBy = req.user?.userId || req.user?.id;
        await category.save();
        res.status(200).json({
            success: true,
            message: 'Service category removed successfully',
            category,
        });
    } catch (error) {
        next(error);
    }
};
export const createCommissionRule = async (req, res, next) => {
    try {
        const validatedData = commissionRuleCreateSchema.parse(req.body);
        const rule = new CommissionRule({
            ...validatedData,
            createdBy: req.user?.userId,
        });
        await rule.save();
        res.status(201).json({ success: true, rule });
    }
    catch (error) {
        next(error);
    }
};
export const getCommissionRules = async (req, res, next) => {
    try {
        const rules = await CommissionRule.find()
            .populate('serviceCategoryId', 'name')
            .populate('workerId', 'name email')
            .sort({ priority: 1, createdAt: -1 });
        res.status(200).json({ success: true, rules });
    }
    catch (error) {
        next(error);
    }
};
export const getAnalytics = async (req, res, next) => {
    try {
        const totalCustomers = await User.countDocuments({ role: 'CUSTOMER' });
        const totalWorkers = await User.countDocuments({ role: 'WORKER' });
        const pendingApprovals = await WorkerProfile.countDocuments({
            verificationStatus: 'PENDING_APPROVAL',
        });
        // Revenue calculations (all completed bookings commission)
        const bookings = await Booking.find();
        let grossBookingValue = 0;
        let platformCommission = 0;
        let completedBookings = 0;
        let cancelledBookings = 0;
        let activeBookings = 0;
        for (const b of bookings) {
            grossBookingValue += b.totalAmount;
            if (b.bookingStatus === 'COMPLETED') {
                platformCommission += b.commissionAmount;
                completedBookings++;
            }
            else if (b.bookingStatus === 'CANCELLED') {
                cancelledBookings++;
            }
            else if (['PAID', 'ACCEPTED', 'CONFIRMED', 'STARTED', 'COMPLETION_REQUESTED'].includes(b.bookingStatus)) {
                activeBookings++;
            }
        }
        // Withdrawal details
        const withdrawals = await WalletLedger.find({ transactionType: 'WITHDRAWAL' });
        let completedPayouts = 0;
        let pendingPayouts = 0;
        for (const w of withdrawals) {
            if (w.status === 'COMPLETED') {
                completedPayouts += w.amount;
            }
            else if (w.status === 'PENDING') {
                pendingPayouts += w.amount;
            }
        }
        res.status(200).json({
            success: true,
            metrics: {
                totalCustomers,
                totalWorkers,
                pendingApprovals,
                activeBookings,
                completedBookings,
                cancelledBookings,
                grossBookingValue, // in paise
                platformCommission, // in paise
                completedPayouts, // in paise
                pendingPayouts, // in paise
            },
        });
    }
    catch (error) {
        next(error);
    }
};
export const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find()
            .populate('actor', 'name email role')
            .sort({ createdAt: -1 })
            .limit(100);
        res.status(200).json({ success: true, logs });
    }
    catch (error) {
        next(error);
    }
};
export const getPayoutRequests = async (req, res, next) => {
    try {
        const requests = await WalletLedger.find({
            transactionType: 'WITHDRAWAL',
            status: 'PENDING',
        }).populate('userId', 'name email phone');
        res.status(200).json({ success: true, requests });
    }
    catch (error) {
        next(error);
    }
};
export const processPayout = async (req, res, next) => {
    const { transactionId, status } = req.body; // status can be 'COMPLETED' or 'FAILED'
    if (!transactionId || !['COMPLETED', 'FAILED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Invalid payout processing details.' });
        return;
    }
    try {
        const entry = await WalletLedger.findById(transactionId);
        if (!entry || entry.transactionType !== 'WITHDRAWAL' || entry.status !== 'PENDING') {
            res.status(404).json({ success: false, message: 'Payout transaction request not found.' });
            return;
        }
        const beforeSnapshot = JSON.parse(JSON.stringify(entry));
        entry.status = status;
        await entry.save();
        // If FAILED, we should reverse the held withdrawal by creating a compensating transaction
        if (status === 'FAILED') {
            await recordTransaction({
                userId: entry.userId.toString(),
                debitAccount: 'USER_BANK_PENDING',
                creditAccount: 'USER_WALLET',
                amount: entry.amount,
                transactionType: 'REFUND',
                idempotencyKey: `WITHDRAW-FAIL-REV-${entry._id}`,
                status: 'COMPLETED',
            });
        }
        // Save Audit log
        await new AuditLog({
            actor: req.user?.userId,
            action: `ADMIN_PAYOUT_${status}`,
            resourceType: 'WalletLedger',
            resourceId: entry._id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(entry)),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();
        // Notify Worker
        await new Notification({
            recipientId: entry.userId,
            title: `Withdrawal Request ${status}`,
            message: `Your withdrawal of ${(entry.amount / 100).toFixed(2)} INR was ${status.toLowerCase()}.`,
            type: status === 'COMPLETED' ? 'SUCCESS' : 'DANGER',
        }).save();
        res.status(200).json({ success: true, message: `Payout request processed: ${status}.` });
    }
    catch (error) {
        next(error);
    }
};

export const getCompanies = async (req, res, next) => {
    try {
        const users = await User.find({ role: 'COMPANY' }).lean();
        const data = [];
        for (const u of users) {
            const profile = await CompanyProfile.findOne({ userId: u._id }).lean();
            const activeJobs = await Job.countDocuments({ companyId: u._id, status: 'ACTIVE' });
            const jobs = await Job.find({ companyId: u._id }).select('_id');
            const jobIds = jobs.map(j => j._id);
            const workersHired = await WorkerAssignment.countDocuments({ jobId: { $in: jobIds }, status: 'COMPLETED' });

            const payments = await CompanyPayment.aggregate([
                { $match: { companyId: u._id, status: 'RELEASED' } },
                { $group: { _id: null, totalSpent: { $sum: '$amountPaise' } } }
            ]);
            const totalSpending = payments[0]?.totalSpent || 0;

            data.push({
                user: u,
                profile,
                activeJobs,
                workersHired,
                totalSpending
            });
        }
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

export const getCompanyVerificationsList = async (req, res, next) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status) {
            query.verificationStatus = status;
        }
        const profiles = await CompanyProfile.find(query).lean();
        const results = [];
        for (const profile of profiles) {
            const user = await User.findById(profile.userId).select('name email phone status role').lean();
            const docs = await CompanyVerificationDocument.find({ companyId: profile.userId }).lean();
            results.push({
                ...profile,
                user,
                documents: docs,
                submittedAt: profile.submittedAt || profile.updatedAt
            });
        }
        res.status(200).json({ success: true, verifications: results, data: results });
    } catch (error) {
        next(error);
    }
};

export const getCompanyVerificationAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }
        const documents = await CompanyVerificationDocument.find({ companyId: id });
        res.status(200).json({ success: true, profile, documents });
    } catch (error) {
        next(error);
    }
};

export const verifyCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'VERIFIED';
        profile.rejectionReason = null;
        profile.needsInfoReason = null;
        profile.suspensionReason = null;
        await profile.save();

        // Approve all documents
        await CompanyVerificationDocument.updateMany(
            { companyId: id },
            { status: 'APPROVED', reviewedBy: req.user.userId, reviewedAt: new Date() }
        );

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_VERIFICATION_APPROVED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        // Notify
        await new Notification({
            recipientId: id,
            title: 'Company KYC Approved',
            message: 'Your company verification is approved. You can now post jobs.',
            type: 'SUCCESS'
        }).save();

        res.status(200).json({ success: true, message: 'Company profile verified successfully.', profile });
    } catch (error) {
        next(error);
    }
};

export const requestInfoCompanyVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason, rejectedDocuments } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Reason is required to request more information.' });
        }

        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'NEEDS_INFORMATION';
        profile.needsInfoReason = reason;
        await profile.save();

        // Mark rejected documents
        if (Array.isArray(rejectedDocuments) && rejectedDocuments.length > 0) {
            for (const docId of rejectedDocuments) {
                const doc = await CompanyVerificationDocument.findById(docId);
                if (doc && doc.companyId.toString() === id) {
                    doc.status = 'REJECTED';
                    doc.rejectionReason = reason;
                    doc.reviewedBy = req.user.userId;
                    doc.reviewedAt = new Date();
                    await doc.save();

                    // Audit log for document rejection
                    await new AuditLog({
                        actor: req.user.userId,
                        action: 'COMPANY_DOCUMENT_REJECTED',
                        resourceType: 'COMPANY_VERIFICATION_DOCUMENT',
                        resourceId: doc._id.toString(),
                        requestId: req.requestId
                    }).save();
                }
            }
        }

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_VERIFICATION_INFO_REQUESTED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        // Notify
        await new Notification({
            recipientId: id,
            title: 'Information Required for KYC',
            message: `Admin requested additional details: ${reason}`,
            type: 'WARNING'
        }).save();

        res.status(200).json({ success: true, message: 'Information request sent successfully.', profile });
    } catch (error) {
        next(error);
    }
};

export const rejectCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'REJECTED';
        profile.rejectionReason = reason;
        await profile.save();

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_VERIFICATION_REJECTED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        // Notify
        await new Notification({
            recipientId: id,
            title: 'Company KYC Rejected',
            message: `Verification was rejected: ${reason}`,
            type: 'DANGER'
        }).save();

        res.status(200).json({ success: true, message: 'Company profile verification rejected.', profile });
    } catch (error) {
        next(error);
    }
};

export const suspendCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: 'Suspension reason is required.' });
        }

        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'SUSPENDED';
        profile.suspensionReason = reason;
        await profile.save();

        await User.findByIdAndUpdate(id, { status: 'SUSPENDED' });

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_SUSPENDED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        // Notify
        await new Notification({
            recipientId: id,
            title: 'Company Account Suspended',
            message: `Your company operations have been suspended: ${reason}`,
            type: 'DANGER'
        }).save();

        res.status(200).json({ success: true, message: 'Company account suspended.' });
    } catch (error) {
        next(error);
    }
};

export const activateCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const profile = await CompanyProfile.findOne({ userId: id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'VERIFIED';
        profile.suspensionReason = null;
        await profile.save();

        await User.findByIdAndUpdate(id, { status: 'ACTIVE' });

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_VERIFICATION_APPROVED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: id.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Company account activated successfully.' });
    } catch (error) {
        next(error);
    }
};

export const getCompanyJobsAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const jobs = await Job.find({ companyId: id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, jobs });
    } catch (error) {
        next(error);
    }
};

export const getCompanyWorkersAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const jobs = await Job.find({ companyId: id }).select('_id');
        const jobIds = jobs.map(j => j._id);
        const workers = await WorkerAssignment.find({ jobId: { $in: jobIds } })
            .populate('workerId', 'name email phone')
            .populate('jobId', 'title');
        res.status(200).json({ success: true, data: workers });
    } catch (error) {
        next(error);
    }
};

export const getCompanyPaymentsAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payments = await CompanyPayment.find({ companyId: id })
            .populate('workerId', 'name email')
            .populate('jobId', 'title');
        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        next(error);
    }
};

