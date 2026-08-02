import DisputeCase from '../models/DisputeCase.js';
import DisputeEvidence from '../models/DisputeEvidence.js';
import Booking from '../models/Booking.js';
import WorkerEarning from '../models/WorkerEarning.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import DisputeFreezeService from '../services/payments/DisputeFreezeService.js';
import DisputeReleaseService from '../services/payments/DisputeReleaseService.js';
import RefundEligibilityService from '../services/payments/RefundEligibilityService.js';
import RefundAllocationService from '../services/payments/RefundAllocationService.js';
import RefundStateService from '../services/payments/RefundStateService.js';
import Refund from '../models/Refund.js';
import LedgerPostingService from '../services/payments/LedgerPostingService.js';
import razorpayProvider from '../services/payments/RazorpayProvider.js';
import { verifyFileSignature } from '../middleware/evidenceUpload.js';
import crypto from 'crypto';
import { sanitizeDisputeDto, sanitizeEvidenceDto } from '../utils/financialDto.js';

export const raiseDispute = async (req, res) => {
    try {
        const { bookingId, disputeType, reasonCode, title, description, claimedAmountPaise } = req.body;
        const customerId = req.user.userId;

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

        if (booking.customerId.toString() !== customerId) {
            return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this booking.' });
        }

        if (booking.paymentStatus !== 'PAID') {
            return res.status(400).json({ success: false, message: 'Booking must be PAID to open a dispute.' });
        }

        const existingDispute = await DisputeCase.findOne({
            bookingId,
            status: { $in: ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'CUSTOMER_RESPONSE_REQUIRED', 'WORKER_RESPONSE_REQUIRED', 'RESOLUTION_PENDING'] },
        });
        if (existingDispute) {
            return res.status(400).json({ success: false, message: 'An active dispute already exists for this booking.' });
        }

        const snap = booking.pricingSnapshot || {};
        const maxClaim = snap.customerTotalPaise || booking.totalAmount;
        if (!Number.isInteger(claimedAmountPaise) || claimedAmountPaise < 1) {
            return res.status(400).json({ success: false, message: 'Claimed amount must be a positive integer paise.' });
        }
        if (claimedAmountPaise > maxClaim) {
            return res.status(400).json({ success: false, message: `Claimed amount cannot exceed paid amount of ₹${(maxClaim / 100).toFixed(2)}.` });
        }

        const disputeNumber = `DISP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        const dispute = new DisputeCase({
            disputeNumber,
            bookingId,
            customerId,
            workerId: booking.workerId,
            openedByType: 'CUSTOMER',
            openedById: customerId,
            disputeType,
            reasonCode,
            title,
            description,
            claimedAmountPaise,
            currency: booking.currency || 'INR',
            status: 'OPEN',
            priority: 'MEDIUM',
            financialFreezeStatus: 'PENDING',
            workerResponseDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        });

        await dispute.save();

        // Update booking state
        booking.bookingStatus = 'DISPUTED';
        booking.escrowStatus = 'FROZEN';
        await booking.save();

        // Trigger fund freeze
        await DisputeFreezeService.freezeDisputeFunds(dispute, {
            actorId: req.user.userId,
            requestId: req.headers['x-request-id'] || '',
        });

        // Audit Log
        await new AuditLog({
            actor: req.user.userId,
            action: 'DISPUTE_OPENED',
            resourceType: 'DisputeCase',
            resourceId: dispute._id.toString(),
            afterSnapshot: dispute.toObject(),
        }).save();

        return res.status(201).json({ success: true, dispute });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getCustomerDisputes = async (req, res) => {
    try {
        const disputes = await DisputeCase.find({ customerId: req.user.userId });
        return res.json({ success: true, disputes });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getWorkerDisputes = async (req, res) => {
    try {
        const disputes = await DisputeCase.find({ workerId: req.user.userId });
        return res.json({ success: true, disputes });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const getDisputeDetails = async (req, res) => {
    try {
        const dispute = await DisputeCase.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

        const isCustomer = dispute.customerId.toString() === req.user.userId;
        const isWorker = dispute.workerId.toString() === req.user.userId;
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

        if (!isCustomer && !isWorker && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden access to this dispute case.' });
        }

        const evidence = await DisputeEvidence.find({ disputeId: dispute._id });
        const filteredEvidence = evidence.filter(e => {
            if (isAdmin) return true;
            if (e.visibility === 'DISPUTE_PARTICIPANTS') return true;
            if (isCustomer && e.visibility === 'CUSTOMER_AND_ADMIN') return true;
            if (isWorker && e.visibility === 'WORKER_AND_ADMIN') return true;
            return false;
        });

        const dtoListObj = sanitizeDisputeDto(dispute.toObject(), isAdmin);
        const safeEvidence = filteredEvidence.map(item => sanitizeEvidenceDto(item, isAdmin));

        return res.json({ success: true, dispute: dtoListObj, evidence: safeEvidence });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const uploadEvidence = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const dispute = await DisputeCase.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

        const isCustomer = dispute.customerId.toString() === req.user.userId;
        const isWorker = dispute.workerId.toString() === req.user.userId;
        const isAdmin = req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN';

        if (!isCustomer && !isWorker && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }

        const filePath = req.file.path;
        const mimeType = verifyFileSignature(filePath);
        if (!mimeType) {
            return res.status(400).json({ success: false, message: 'Invalid or spoofed file signature.' });
        }

        const evidence = new DisputeEvidence({
            disputeId: dispute._id,
            bookingId: dispute.bookingId,
            uploadedByType: isAdmin ? 'ADMIN' : isCustomer ? 'CUSTOMER' : 'WORKER',
            uploadedById: req.user.userId,
            evidenceType: mimeType.startsWith('image/') ? 'IMAGE' : mimeType === 'application/pdf' ? 'PDF' : 'VIDEO',
            storageKey: req.file.filename,
            fileMimeType: mimeType,
            fileSize: req.file.size,
            originalNameSafe: req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'),
            visibility: req.body.visibility || 'DISPUTE_PARTICIPANTS',
        });

        await evidence.save();

        await new AuditLog({
            actor: req.user.userId,
            action: 'EVIDENCE_UPLOADED',
            resourceType: 'DisputeEvidence',
            resourceId: evidence._id.toString(),
            afterSnapshot: evidence.toObject(),
        }).save();

        return res.status(201).json({ success: true, evidence: sanitizeEvidenceDto(evidence.toObject(), isAdmin) });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const respondToDispute = async (req, res) => {
    try {
        const dispute = await DisputeCase.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

        const isWorker = dispute.workerId.toString() === req.user.userId;
        if (!isWorker) return res.status(403).json({ success: false, message: 'Forbidden. Only assigned worker can respond.' });

        dispute.status = 'UNDER_REVIEW';
        await dispute.save();

        await new AuditLog({
            actor: req.user.userId,
            action: 'WORKER_RESPONDED_DISPUTE',
            resourceType: 'DisputeCase',
            resourceId: dispute._id.toString(),
            afterSnapshot: { status: 'UNDER_REVIEW' },
        }).save();

        return res.json({ success: true, dispute });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

export const cancelDispute = async (req, res) => {
    try {
        const dispute = await DisputeCase.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

        if (dispute.customerId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }

        dispute.status = 'CANCELLED';
        dispute.cancelledAt = new Date();
        await dispute.save();

        // Release funds back
        await DisputeReleaseService.releaseDisputeFunds(dispute, {
            actorId: req.user.userId,
            requestId: req.headers['x-request-id'] || '',
        });

        return res.json({ success: true, dispute });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
