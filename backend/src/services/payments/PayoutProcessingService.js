import crypto from 'crypto';
import WorkerPayout from '../../models/WorkerPayout.js';
import WorkerPayoutAccount from '../../models/WorkerPayoutAccount.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';
import config from '../../config/env.js';
import EncryptionService from './EncryptionService.js';

export class PayoutProcessingService {
    static async processPayout(payout, requestMeta = {}) {
        const current = await WorkerPayout.findById(payout._id);
        if (!current) {
            return { success: false, reason: 'NOT_FOUND', payout: current };
        }
        if (current.status === 'PROVIDER_SUBMITTED' && current.providerPayoutId) {
            return { success: true, reason: 'ALREADY_SUBMITTED', payout: current };
        }
        if (current.status !== 'RESERVED') {
            return { success: false, reason: 'INVALID_STATUS', payout: current };
        }

        const account = await WorkerPayoutAccount.findById(current.payoutAccountId);
        if (!account || account.verificationStatus !== 'VERIFIED' || account.status !== 'ACTIVE') {
            return { success: false, reason: 'ACCOUNT_NOT_ELIGIBLE', payout: current };
        }

        // Sensitive destination values are decrypted only here, immediately before an authorised provider call.
        const destination = account.accountType === 'BANK_ACCOUNT'
            ? EncryptionService.decryptValue(account.encryptedAccountNumber, account.encryptionKeyVersion)
            : EncryptionService.decryptValue(account.encryptedVpa, account.encryptionKeyVersion);
        if (!destination) return { success: false, reason: 'DESTINATION_UNAVAILABLE', payout: current };
        if (process.env.NODE_ENV === 'test' && config.PAYOUT_PROVIDER_MODE === 'mock' && config.PAYOUT_PROVIDER === 'mock') {
            const providerPayoutId = `mock-payout-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
            const providerIdempotencyKey = current.providerIdempotencyKey || `PAYOUT_PROVIDER:${current._id}`;
            const updated = await WorkerPayout.findOneAndUpdate({ _id: current._id, status: 'RESERVED' }, {
                providerPayoutId,
                providerIdempotencyKey,
                status: 'PROVIDER_SUBMITTED',
                providerSubmittedAt: new Date(),
                statusDetailsSafe: 'Provider submission accepted in mock mode',
            }, { new: true });
            if (!updated) return { success: true, reason: 'ALREADY_SUBMITTED', payout: await WorkerPayout.findById(current._id) };
            await AuditLog.create({ actor: requestMeta.actorId || current.workerId, action: 'PAYOUT_PROVIDER_SUBMITTED', resourceType: 'WorkerPayout', resourceId: updated._id.toString(), beforeSnapshot: { status: current.status }, afterSnapshot: { status: updated.status, providerPayoutId }, requestId: requestMeta.requestId });
            await Notification.create({ recipientId: current.workerId, title: 'Payout Processing', message: 'Your payout is being processed.', type: 'INFO', idempotencyKey: `payout-processing-${updated._id}` });
            return { success: true, payout: updated };
        }

        return { success: false, reason: 'PROVIDER_UNAVAILABLE', payout: current };
    }
}

export default PayoutProcessingService;
