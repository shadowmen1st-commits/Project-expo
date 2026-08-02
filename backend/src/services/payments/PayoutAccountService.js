import crypto from 'crypto';
import WorkerPayoutAccount from '../../models/WorkerPayoutAccount.js';
import WorkerProfile from '../../models/WorkerProfile.js';
import AuditLog from '../../models/AuditLog.js';
import Notification from '../../models/Notification.js';
import EncryptionService from './EncryptionService.js';

export class PayoutAccountService {
    static async createAccount({ workerId, accountType, displayName, beneficiaryName, accountNumber, ifsc, vpa, bankName, branchName, provider, requestMeta = {} }) {
        const profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile || profile.verificationStatus !== 'APPROVED') {
            const err = new Error('Worker KYC is not approved for payout account onboarding.');
            err.statusCode = 403;
            err.errorCode = 'WORKER_KYC_REQUIRED';
            throw err;
        }

        const fingerprintSource = `${workerId.toString()}:${accountType}:${beneficiaryName}:${accountNumber || vpa || ''}:${ifsc || ''}:${vpa || ''}`.toLowerCase();
        const fingerprint = crypto.createHash('sha256').update(fingerprintSource).digest('hex');
        const existing = await WorkerPayoutAccount.findOne({ fingerprint });
        if (existing) {
            const err = new Error('A duplicate payout account fingerprint was detected.');
            err.statusCode = 409;
            err.errorCode = 'DUPLICATE_FINGERPRINT';
            throw err;
        }

        let encryptedAccountNumber = null;
        let accountNumberLast4 = null;
        let encryptedIfsc = null;
        let ifscMasked = null;
        let encryptedVpa = null;
        let vpaMasked = null;

        if (accountType === 'BANK_ACCOUNT' && accountNumber) {
            const encrypted = EncryptionService.encryptValue(accountNumber);
            encryptedAccountNumber = encrypted.value;
            accountNumberLast4 = accountNumber.slice(-4);
            const ifscEncrypted = EncryptionService.encryptValue(ifsc);
            encryptedIfsc = ifscEncrypted.value;
            ifscMasked = ifsc ? `${ifsc.slice(0, 4)}XXXX${ifsc.slice(-2)}` : null;
        } else if (accountType === 'VPA' && vpa) {
            const encrypted = EncryptionService.encryptValue(vpa);
            encryptedVpa = encrypted.value;
            vpaMasked = vpa.replace(/(.{2})(.*)(@.*)/, '$1***$3');
        }

        const account = await WorkerPayoutAccount.create({
            workerId,
            accountType,
            displayName,
            beneficiaryName,
            encryptedAccountNumber,
            accountNumberLast4,
            encryptedIfsc,
            ifscMasked,
            encryptedVpa,
            vpaMasked,
            bankName,
            branchName,
            provider: provider || 'razorpayx',
            verificationStatus: 'UNDER_REVIEW',
            validationStatus: 'PENDING',
            status: 'ACTIVE',
            isDefault: false,
            workerConsentAt: new Date(),
            fingerprint,
            encryptionKeyVersion: EncryptionService.getKeyVersion(),
        });

        await AuditLog.create({
            actor: requestMeta.actorId || workerId,
            action: 'PAYOUT_ACCOUNT_SUBMITTED',
            resourceType: 'WorkerPayoutAccount',
            resourceId: account._id.toString(),
            beforeSnapshot: {},
            afterSnapshot: { verificationStatus: account.verificationStatus, accountType },
            requestId: requestMeta.requestId,
        });
        await Notification.create({
            recipientId: workerId,
            title: 'Payout Account Submitted',
            message: 'Your payout account has been submitted for verification.',
            type: 'INFO',
            idempotencyKey: `payout-account-${account._id}`,
        });
        return account;
    }

    static async toSafeDto(account) {
        return {
            id: account._id,
            workerId: account.workerId,
            accountType: account.accountType,
            displayName: account.displayName,
            beneficiaryName: account.beneficiaryName,
            accountNumberLast4: account.accountNumberLast4,
            ifscMasked: account.ifscMasked,
            vpaMasked: account.vpaMasked,
            bankName: account.bankName,
            branchName: account.branchName,
            verificationStatus: account.verificationStatus,
            validationStatus: account.validationStatus,
            status: account.status,
            isDefault: account.isDefault,
            provider: account.provider,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
        };
    }
}

export default PayoutAccountService;
