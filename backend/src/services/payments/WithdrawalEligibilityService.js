import WorkerProfile from '../../models/WorkerProfile.js';
import WorkerWallet from '../../models/WorkerWallet.js';
import WorkerPayoutAccount from '../../models/WorkerPayoutAccount.js';
import WorkerPayout from '../../models/WorkerPayout.js';
import PayoutPolicy from '../../models/PayoutPolicy.js';
import DisputeCase from '../../models/DisputeCase.js';

const ACTIVE_PAYOUTS = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'RESERVING', 'RESERVED', 'PROVIDER_SUBMITTED', 'QUEUED', 'PENDING', 'PROCESSING'];

export class WithdrawalEligibilityService {
    static async evaluate({ workerId, amountPaise, payoutAccountId, currency = 'INR', session = null }) {
        const opts = session ? { session } : {};
        const [profile, wallet, payoutAccount, policy] = await Promise.all([
            WorkerProfile.findOne({ userId: workerId }, null, opts),
            WorkerWallet.findOne({ workerId }, null, opts),
            WorkerPayoutAccount.findById(payoutAccountId, null, opts),
            PayoutPolicy.findOne({ isActive: true }, null, opts).sort({ effectiveFrom: -1 }),
        ]);
        const now = new Date();
        const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const counted = [...ACTIVE_PAYOUTS, 'PROCESSED'];
        const [daily, monthly, lastPayout, activeDispute] = await Promise.all([
            WorkerPayout.aggregate([{ $match: { workerId: profile?.userId, requestedAt: { $gte: startDay }, status: { $in: counted } } }, { $group: { _id: null, amount: { $sum: '$amountPaise' }, count: { $sum: 1 } } }]).session(session),
            WorkerPayout.aggregate([{ $match: { workerId: profile?.userId, requestedAt: { $gte: startMonth }, status: { $in: counted } } }, { $group: { _id: null, amount: { $sum: '$amountPaise' } } }]).session(session),
            WorkerPayout.findOne({ workerId, status: { $in: counted } }, null, opts).sort({ requestedAt: -1 }),
            DisputeCase.findOne({ workerId, status: { $in: ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'CUSTOMER_RESPONSE_REQUIRED', 'WORKER_RESPONSE_REQUIRED', 'RESOLUTION_PENDING'] } }, null, opts),
        ]);
        const dailyUsed = daily[0]?.amount || 0;
        const monthlyUsed = monthly[0]?.amount || 0;
        const reasons = [];
        if (!profile || profile.verificationStatus !== 'APPROVED') reasons.push('KYC_REQUIRED');
        if (!payoutAccount || payoutAccount.workerId.toString() !== workerId.toString()) reasons.push('PAYOUT_ACCOUNT_NOT_OWNED');
        if (payoutAccount && payoutAccount.status !== 'ACTIVE') reasons.push('PAYOUT_ACCOUNT_DISABLED');
        if (payoutAccount && (payoutAccount.verificationStatus !== 'VERIFIED' || payoutAccount.validationStatus !== 'VALID')) reasons.push('PAYOUT_ACCOUNT_UNVERIFIED');
        if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) reasons.push('INVALID_AMOUNT');
        if (currency !== 'INR' || wallet?.currency && wallet.currency !== currency) reasons.push('INVALID_CURRENCY');
        if (!policy) reasons.push('PAYOUT_POLICY_UNAVAILABLE');
        if (policy && amountPaise < policy.minimumPayoutPaise) reasons.push('BELOW_MINIMUM');
        if (policy && amountPaise > policy.maximumPayoutPaise) reasons.push('ABOVE_MAXIMUM');
        if ((wallet?.availableBalancePaise || 0) < amountPaise) reasons.push('INSUFFICIENT_AVAILABLE_BALANCE');
        if (activeDispute) reasons.push('ACTIVE_DISPUTE');
        if (policy && dailyUsed + amountPaise > policy.dailyPayoutLimitPaise) reasons.push('DAILY_LIMIT_EXCEEDED');
        if (policy && monthlyUsed + amountPaise > policy.monthlyPayoutLimitPaise) reasons.push('MONTHLY_LIMIT_EXCEEDED');
        if (policy && daily[0]?.count >= policy.maximumDailyRequests) reasons.push('DAILY_REQUEST_LIMIT_EXCEEDED');
        if (policy?.coolDownMinutes > 0 && lastPayout && now - lastPayout.requestedAt < policy.coolDownMinutes * 60000) reasons.push('COOLDOWN_ACTIVE');
        return { allowed: reasons.length === 0, reasons, snapshot: { availableBalancePaise: wallet?.availableBalancePaise || 0, pendingBalancePaise: wallet?.pendingBalancePaise || 0, frozenBalancePaise: wallet?.frozenBalancePaise || 0, reservedBalancePaise: wallet?.reservedBalancePaise || 0, requestedAmountPaise: amountPaise, minimumPayoutPaise: policy?.minimumPayoutPaise || 0, maximumPayoutPaise: policy?.maximumPayoutPaise || 0, dailyUsedPaise: dailyUsed, monthlyUsedPaise: monthlyUsed, accountVerificationStatus: payoutAccount?.verificationStatus || 'NOT_STARTED', kycStatus: profile?.verificationStatus || 'DRAFT', policyId: policy?._id || null, calculatedAt: now } };
    }
}

export default WithdrawalEligibilityService;
