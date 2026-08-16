import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import ServiceCategory from '../models/ServiceCategory.js';
import CommissionRule from '../models/CommissionRule.js';
import Booking from '../models/Booking.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import WalletLedger from '../models/WalletLedger.js';
import { adminVerifyWorkerSchema, categoryCreateSchema, categoryUpdateSchema, commissionRuleCreateSchema } from '../utils/validation.js';
import { decryptText } from '../utils/crypto.js';
import { recordTransaction } from '../services/ledger.js';
import CompanyProfile from '../models/CompanyProfile.js';
import Job from '../models/Job.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import CompanyPayment from '../models/CompanyPayment.js';
import CompanyVerificationDocument from '../models/CompanyVerificationDocument.js';
import RefreshToken from '../models/RefreshToken.js';

// ── Admin User Management ─────────────────────────────────────────────────────

export const listUsers = async (req, res, next) => {
    try {
        const { role, status, search, page = 1, limit = 50 } = req.query;
        const query = {};
        if (role && ['CUSTOMER', 'WORKER', 'ADMIN', 'SUPER_ADMIN', 'COMPANY'].includes(role)) {
            query.role = role;
        }
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [users, total] = await Promise.all([
            User.find(query)
                .select('name email phone role status emailVerified phoneVerified profileImage createdAt lastLoginAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(query),
        ]);

        res.status(200).json({ success: true, users, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        next(error);
    }
};

export const disableUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.userId;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }

        // Prevent self-disable
        if (id === actorId) {
            return res.status(400).json({ success: false, message: 'You cannot disable your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        if (['SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Super administrator accounts cannot be disabled.' });
        }

        const before = user.status;
        user.status = 'INACTIVE';
        await user.save();

        // Revoke all active sessions
        await RefreshToken.updateMany({ userId: id, isRevoked: false }, { isRevoked: true });

        // Audit
        await new AuditLog({
            actor: actorId,
            action: 'ADMIN_USER_DISABLED',
            resourceType: 'User',
            resourceId: id,
            beforeSnapshot: { status: before },
            afterSnapshot: { status: 'INACTIVE' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();

        res.status(200).json({ success: true, message: 'User account disabled successfully.' });
    } catch (error) {
        next(error);
    }
};

export const enableUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.userId;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const before = user.status;
        user.status = 'ACTIVE';
        await user.save();

        await new AuditLog({
            actor: actorId,
            action: 'ADMIN_USER_ENABLED',
            resourceType: 'User',
            resourceId: id,
            beforeSnapshot: { status: before },
            afterSnapshot: { status: 'ACTIVE' },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();

        res.status(200).json({ success: true, message: 'User account enabled successfully.' });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.userId;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        }

        // Prevent self-deletion
        if (id === actorId) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        if (['SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ success: false, message: 'Super administrator accounts cannot be deleted.' });
        }

        // Check for active bookings
        const activeBooking = await Booking.findOne({
            $or: [{ customerId: id }, { workerId: id }],
            bookingStatus: { $in: ['PENDING', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED'] }
        });
        if (activeBooking) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete user with active bookings. Resolve existing bookings first.'
            });
        }

        // Soft-delete
        const beforeSnapshot = { status: user.status, email: user.email };
        user.status = 'DELETED';
        user.deletedAt = new Date();
        user.email = `deleted_${Date.now()}_${user.email}`; // prevent email conflict on re-registration
        await user.save();

        // Revoke all sessions
        await RefreshToken.updateMany({ userId: id }, { isRevoked: true });

        await new AuditLog({
            actor: actorId,
            action: 'ADMIN_USER_DELETED',
            resourceType: 'User',
            resourceId: id,
            beforeSnapshot,
            afterSnapshot: { status: 'DELETED', deletedAt: user.deletedAt },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId,
        }).save();

        res.status(200).json({ success: true, message: 'User account deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

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
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid worker ID.' });
        }

        const validatedData = adminVerifyWorkerSchema.parse(req.body);
        const { action, reason } = validatedData;
        let profile = await WorkerProfile.findOne({ userId: id });
        if (!profile) {
            // Auto-create WorkerProfile if user exists and is worker
            const workerUser = await User.findById(id);
            if (workerUser && workerUser.role === 'WORKER') {
                profile = await WorkerProfile.create({
                    userId: id,
                    verificationStatus: 'PENDING'
                });
            } else {
                return res.status(404).json({ success: false, message: 'Worker profile not found.' });
            }
        }
        const beforeSnapshot = JSON.parse(JSON.stringify(profile));

        // Update profile verification status
        profile.verificationStatus = action;
        if (action === 'APPROVED') {
            profile.verificationBadge = true;
            profile.isPubliclyVisible = true;
            profile.approvedAt = new Date();
            profile.approvedBy = req.user?.userId;
            await User.findByIdAndUpdate(id, { status: 'ACTIVE' });
        } else if (action === 'REJECTED') {
            profile.verificationBadge = false;
            profile.isPubliclyVisible = false;
            profile.rejectionReason = reason;
            profile.rejectedAt = new Date();
            profile.rejectedBy = req.user?.userId;
            await User.findByIdAndUpdate(id, { status: 'REJECTED' });
        } else if (action === 'SUSPENDED') {
            profile.verificationBadge = false;
            profile.isPubliclyVisible = false;
            profile.rejectionReason = reason;
            await User.findByIdAndUpdate(id, { status: 'SUSPENDED' });
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
            message: `Your worker profile status was updated to ${action.toLowerCase()}.${reason ? ' Reason: ' + reason : ''}`,
            type: action === 'APPROVED' ? 'SUCCESS' : 'WARNING',
        }).save();

        return res.status(200).json({ success: true, message: `Worker status updated to ${action}.` });
    } catch (error) {
        next(error);
    }
};

export const approveWorkerAdmin = async (req, res, next) => {
    req.body = { action: 'APPROVED', reason: req.body?.reason || 'Verified by admin', ...req.body };
    return verifyWorker(req, res, next);
};

export const rejectWorkerAdmin = async (req, res, next) => {
    req.body = { action: 'REJECTED', reason: req.body?.reason || 'Failed background verification requirements.', ...req.body };
    return verifyWorker(req, res, next);
};

export const suspendWorkerAdmin = async (req, res, next) => {
    req.body = { action: 'SUSPENDED', reason: req.body?.reason || 'Suspended by admin', ...req.body };
    return verifyWorker(req, res, next);
};

export const reactivateWorkerAdmin = async (req, res, next) => {
    req.body = { action: 'APPROVED', reason: req.body?.reason || 'Reactivated by admin', ...req.body };
    return verifyWorker(req, res, next);
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
        const status = validatedData.status || 'ACTIVE';
        const category = new ServiceCategory({
            ...validatedData,
            slug,
            status,
            isActive: status === 'ACTIVE',
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
        // Customer / Public service listing returns ONLY ACTIVE services
        let categories = await ServiceCategory.find({
            isActive: { $ne: false },
            status: { $nin: ['DRAFT', 'INACTIVE', 'ARCHIVED'] },
            deletedAt: null
        }).sort({ sortOrder: 1, name: 1 });

        // Auto-seed default categories if database has 0 categories
        if (categories.length === 0) {
            const defaultCats = [
                { name: 'Home Cleaning', slug: 'home-cleaning', description: 'Professional home cleaning services', icon: 'sparkles', price: 499, status: 'ACTIVE', isActive: true },
                { name: 'Plumbing', slug: 'plumbing', description: 'Expert plumbing repairs and installation', icon: 'wrench', price: 599, status: 'ACTIVE', isActive: true },
                { name: 'Electrical', slug: 'electrical', description: 'Certified electrician services', icon: 'zap', price: 699, status: 'ACTIVE', isActive: true },
                { name: 'Senior Care', slug: 'senior-care', description: 'Compassionate elderly care services', icon: 'heart', price: 799, status: 'ACTIVE', isActive: true },
                { name: 'Housekeeping', slug: 'housekeeping', description: 'Daily house keeping and chores', icon: 'home', price: 499, status: 'ACTIVE', isActive: true }
            ];
            for (const catData of defaultCats) {
                await ServiceCategory.findOneAndUpdate(
                    { slug: catData.slug },
                    { $setOnInsert: catData },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }
            categories = await ServiceCategory.find({
                isActive: { $ne: false },
                status: { $nin: ['DRAFT', 'INACTIVE', 'ARCHIVED'] },
                deletedAt: null
            }).sort({ sortOrder: 1, name: 1 });
        }

        res.status(200).json({ success: true, categories });
    }
    catch (error) {
        next(error);
    }
};

export const getAdminCategories = async (req, res, next) => {
    try {
        // Admin gets all categories (DRAFT, ACTIVE, INACTIVE, ARCHIVED)
        const categories = await ServiceCategory.find({}).sort({ sortOrder: 1, name: 1 });
        res.status(200).json({ success: true, categories });
    }
    catch (error) {
        next(error);
    }
};

export const getCategoryById = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId || req.params.id;
        if (!categoryId || !categoryId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                errorCode: 'INVALID_CATEGORY_ID',
                message: 'Invalid category ID format.'
            });
        }
        const category = await ServiceCategory.findById(categoryId);
        const isAdmin = req.user && ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

        if (!category || (!isAdmin && (category.status !== 'ACTIVE' || category.isActive === false))) {
            return res.status(404).json({
                success: false,
                statusCode: 404,
                errorCode: 'SERVICE_NOT_AVAILABLE',
                message: 'This service is currently unavailable.'
            });
        }

        res.status(200).json({ success: true, category });
    } catch (error) {
        next(error);
    }
};

export const updateCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId || req.params.id;
        if (!categoryId || !categoryId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID format.' });
        }
        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Service category not found.' });
        }

        const validatedData = categoryUpdateSchema.parse(req.body);
        Object.assign(category, validatedData);
        if (validatedData.status) {
            category.isActive = validatedData.status === 'ACTIVE';
        }
        await category.save();

        res.status(200).json({
            success: true,
            message: 'Service category updated successfully.',
            category,
        });
    } catch (error) {
        next(error);
    }
};

export const setCategoryStatus = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId || req.params.id;
        const { status } = req.body;
        if (!['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid category status.' });
        }

        const category = await ServiceCategory.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Service category not found.' });
        }

        category.status = status;
        category.isActive = status === 'ACTIVE';
        await category.save();

        res.status(200).json({
            success: true,
            message: `Service category status changed to ${status}.`,
            category,
        });
    } catch (error) {
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
        if (category.status === 'ARCHIVED' || category.isActive === false) {
            return res.status(409).json({ success: false, message: 'This category has already been archived or removed.' });
        }
        // Check for references: active bookings
        const bookingRef = await Booking.findOne({ serviceCategoryId: categoryId, bookingStatus: { $in: ['PENDING', 'PAYMENT_PENDING', 'PAID', 'ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED'] } });
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
        // Soft delete / archive
        category.status = 'ARCHIVED';
        category.isActive = false;
        category.deletedAt = new Date();
        category.deletedBy = req.user?.userId || req.user?.id;
        await category.save();
        res.status(200).json({
            success: true,
            message: 'Service category archived successfully',
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

export const viewCompanyVerificationDocument = async (req, res, next) => {
    try {
        const { documentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'INVALID_DOCUMENT_ID',
                message: 'Invalid document ID format.'
            });
        }

        const doc = await CompanyVerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({
                statusCode: 404,
                errorCode: 'DOCUMENT_NOT_FOUND',
                message: 'Company verification document not found.'
            });
        }

        // Authorization checks
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role);
        const isOwner = req.user?.role === 'COMPANY' && doc.companyId.toString() === req.user.userId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'FORBIDDEN',
                message: 'Access denied. You do not have permission to view this document.'
            });
        }

        const storageKey = doc.storageKey || (doc.documentUrl ? path.basename(doc.documentUrl) : null);
        if (!storageKey || path.basename(storageKey) !== storageKey) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'INVALID_STORAGE_KEY',
                message: 'Document file reference is invalid.'
            });
        }

        const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
        const STORAGE_DIR = path.join(uploadRoot, 'verification');
        const filePath = path.join(STORAGE_DIR, storageKey);

        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.size > 0) {
                if (isAdmin) {
                    await new AuditLog({
                        actor: req.user.userId,
                        action: 'ADMIN_COMPANY_DOCUMENT_VIEW',
                        resourceType: 'CompanyVerificationDocument',
                        resourceId: documentId,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        requestId: req.requestId
                    }).save();
                }

                const mimeType = doc.mimeType || (filePath.endsWith('.pdf') ? 'application/pdf' : 'image/png');
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'private, no-store, max-age=0');
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Content-Disposition', `inline; filename="${doc.fileName || 'document'}"`);
                return fs.createReadStream(filePath).pipe(res);
            }
        }

        if (doc.documentUrl && /^https?:\/\//i.test(doc.documentUrl)) {
            return res.redirect(doc.documentUrl);
        }

        return res.status(404).json({
            statusCode: 404,
            errorCode: 'FILE_MISSING',
            message: 'Document file is unavailable. Please request re-upload.'
        });
    } catch (error) {
        next(error);
    }
};


