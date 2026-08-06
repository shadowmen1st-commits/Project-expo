import WorkerPayoutAccount from '../models/WorkerPayoutAccount.js';
import WorkerPayout from '../models/WorkerPayout.js';
import PayoutAccountService from '../services/payments/PayoutAccountService.js';
import WithdrawalEligibilityService from '../services/payments/WithdrawalEligibilityService.js';
import PayoutReservationService from '../services/payments/PayoutReservationService.js';
import PayoutProcessingService from '../services/payments/PayoutProcessingService.js';
import PayoutStateService from '../services/payments/PayoutStateService.js';
import PayoutReconciliationService from '../services/payments/PayoutReconciliationService.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import WorkerProfile from '../models/WorkerProfile.js';

const toSafePayoutDto = (value) => {
    const payout = value?.toObject ? value.toObject() : value;
    if (!payout) return payout;
    const { ledgerReservationTransactionId, ledgerProcessedTransactionId, ledgerFailureReleaseTransactionId, ledgerReversalTransactionId, ledgerCancellationTransactionId, requestFingerprint, providerIdempotencyKey, metadata, ...safe } = payout;
    return safe;
};

export const createWorkerPayoutAccount = async (req, res, next) => {
    try {
        const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Your account must be APPROVED to register payout accounts.'
            });
        }
        const account = await PayoutAccountService.createAccount({ workerId: req.user.userId, ...req.body, requestMeta: { actorId: req.user.userId, requestId: req.requestId } });
        res.status(201).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const listWorkerPayoutAccounts = async (req, res, next) => {
    try {
        const accounts = await WorkerPayoutAccount.find({ workerId: req.user.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: await Promise.all(accounts.map((account) => PayoutAccountService.toSafeDto(account))) });
    } catch (error) { next(error); }
};

export const getWorkerPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findOne({ _id: req.params.id, workerId: req.user.userId });
        if (!account) return res.status(404).json({ success: false, message: 'Payout account not found.' });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const setDefaultWorkerPayoutAccount = async (req, res, next) => {
    try {
        await WorkerPayoutAccount.updateMany({ workerId: req.user.userId }, { isDefault: false });
        const account = await WorkerPayoutAccount.findOneAndUpdate({ _id: req.params.id, workerId: req.user.userId }, { isDefault: true }, { new: true });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const validateWorkerPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findOne({ _id: req.params.id, workerId: req.user.userId });
        if (!account) return res.status(404).json({ success: false, message: 'Payout account not found.' });
        account.verificationStatus = 'UNDER_REVIEW';
        account.validationStatus = 'PENDING';
        await account.save();
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const disableWorkerPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findOneAndUpdate({ _id: req.params.id, workerId: req.user.userId }, { status: 'DISABLED', disabledAt: new Date() }, { new: true });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const createWorkerPayout = async (req, res, next) => {
    try {
        const workerProfile = await WorkerProfile.findOne({ userId: req.user.userId });
        if (!workerProfile || workerProfile.verificationStatus !== 'APPROVED') {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Your account must be APPROVED to request withdrawals.'
            });
        }
        const { providerIdempotencyKey, providerPayoutId, status, ...body } = req.body;
        const payout = await PayoutReservationService.createWithdrawalRequest({ workerId: req.user.userId, ...body, idempotencyKey: req.headers['idempotency-key'], requestMeta: { actorId: req.user.userId, requestId: req.requestId } });
        res.status(201).json({ success: true, data: toSafePayoutDto(payout) });
    } catch (error) { next(error); }
};

export const listWorkerPayouts = async (req, res, next) => {
    try {
        const payouts = await WorkerPayout.find({ workerId: req.user.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: payouts.map(toSafePayoutDto) });
    } catch (error) { next(error); }
};

export const getWorkerPayout = async (req, res, next) => {
    try {
        const payout = await WorkerPayout.findOne({ _id: req.params.id, workerId: req.user.userId });
        if (!payout) return res.status(404).json({ success: false, message: 'Payout not found.' });
        res.status(200).json({ success: true, data: toSafePayoutDto(payout) });
    } catch (error) { next(error); }
};

export const listAdminPayoutAccounts = async (req, res, next) => {
    try {
        const accounts = await WorkerPayoutAccount.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: await Promise.all(accounts.map((account) => PayoutAccountService.toSafeDto(account))) });
    } catch (error) { next(error); }
};

export const getAdminPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findById(req.params.id);
        if (!account) return res.status(404).json({ success: false, message: 'Payout account not found.' });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const approveAdminPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findByIdAndUpdate(req.params.id, { verificationStatus: 'VERIFIED', validationStatus: 'VALID', verifiedAt: new Date() }, { new: true });
        await AuditLog.create({ actor: req.user.userId, action: 'PAYOUT_ACCOUNT_APPROVED', resourceType: 'WorkerPayoutAccount', resourceId: account._id.toString(), beforeSnapshot: {}, afterSnapshot: { verificationStatus: account.verificationStatus }, requestId: req.requestId });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const rejectAdminPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findByIdAndUpdate(req.params.id, { verificationStatus: 'REJECTED', rejectedAt: new Date(), rejectionReasonSafe: req.body.reason || 'Not approved' }, { new: true });
        await AuditLog.create({ actor: req.user.userId, action: 'PAYOUT_ACCOUNT_REJECTED', resourceType: 'WorkerPayoutAccount', resourceId: account._id.toString(), beforeSnapshot: {}, afterSnapshot: { verificationStatus: account.verificationStatus }, requestId: req.requestId });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const revalidateAdminPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findByIdAndUpdate(req.params.id, { verificationStatus: 'UNDER_REVIEW', validationStatus: 'PENDING' }, { new: true });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const blockAdminPayoutAccount = async (req, res, next) => {
    try {
        const account = await WorkerPayoutAccount.findByIdAndUpdate(req.params.id, { status: 'BLOCKED', verificationStatus: 'REJECTED' }, { new: true });
        res.status(200).json({ success: true, data: await PayoutAccountService.toSafeDto(account) });
    } catch (error) { next(error); }
};

export const listAdminPayouts = async (req, res, next) => {
    try {
        const payouts = await WorkerPayout.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: payouts.map(toSafePayoutDto) });
    } catch (error) { next(error); }
};

export const getAdminPayout = async (req, res, next) => {
    try {
        const payout = await WorkerPayout.findById(req.params.id);
        if (!payout) return res.status(404).json({ success: false, message: 'Payout not found.' });
        res.status(200).json({ success: true, data: toSafePayoutDto(payout) });
    } catch (error) { next(error); }
};

export const approveAdminPayout = async (req, res, next) => {
    try {
        const payout = await PayoutStateService.transition({ _id: req.params.id }, 'APPROVED', { actorId: req.user.userId, requestId: req.requestId });
        res.status(200).json({ success: true, data: payout.payout });
    } catch (error) { next(error); }
};

export const rejectAdminPayout = async (req, res, next) => {
    try {
        const payout = await PayoutStateService.transition({ _id: req.params.id }, 'REJECTED', { actorId: req.user.userId, requestId: req.requestId });
        res.status(200).json({ success: true, data: payout.payout });
    } catch (error) { next(error); }
};

export const processAdminPayout = async (req, res, next) => {
    try {
        const payout = await WorkerPayout.findById(req.params.id);
        const result = await PayoutProcessingService.processPayout(payout, { actorId: req.user.userId, requestId: req.requestId });
        res.status(200).json({ success: true, data: result.payout });
    } catch (error) { next(error); }
};

export const cancelAdminPayout = async (req, res, next) => {
    try {
        const payout = await PayoutStateService.transition({ _id: req.params.id }, 'CANCELLED', { actorId: req.user.userId, requestId: req.requestId });
        res.status(200).json({ success: true, data: payout.payout });
    } catch (error) { next(error); }
};

export const reconcileAdminPayout = async (req, res, next) => {
    try {
        const payout = await WorkerPayout.findById(req.params.id);
        const result = await PayoutReconciliationService.runReconciliation();
        res.status(200).json({ success: true, data: { payout, result } });
    } catch (error) { next(error); }
};

export const getAdminPayoutReconciliation = async (req, res, next) => { try { const result = await PayoutReconciliationService.runReconciliation(); res.status(200).json({ success: true, data: result }); } catch (error) { next(error); } };
export const runAdminPayoutReconciliation = async (req, res, next) => { try { const result = await PayoutReconciliationService.runReconciliation(); res.status(200).json({ success: true, data: result }); } catch (error) { next(error); } };
export const getAdminPayoutReconciliationIssues = async (req, res, next) => { try { const result = await PayoutReconciliationService.runReconciliation(); res.status(200).json({ success: true, data: result.issues }); } catch (error) { next(error); } };
export const repairAdminPayoutReconciliation = async (req, res, next) => { try { const result = await PayoutReconciliationService.runReconciliation(); res.status(200).json({ success: true, data: result }); } catch (error) { next(error); } };
