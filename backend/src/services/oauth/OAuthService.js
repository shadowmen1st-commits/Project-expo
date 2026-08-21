import OAuthAttempt from '../../models/OAuthAttempt.js';
import OAuthIdentity from '../../models/OAuthIdentity.js';
import User from '../../models/User.js';
import WorkerProfile from '../../models/WorkerProfile.js';
import AuditLog from '../../models/AuditLog.js';
import { generateSecureRandomString, hashValue } from './OAuthUtils.js';

class OAuthService {
    async createAttempt({ provider, mode, requestedRole, frontendRedirectPath, linkingUserId = null }) {
        const state = generateSecureRandomString(32);
        const nonce = generateSecureRandomString(32);

        // Optional PKCE (not heavily used by Apple form_post, but good for Google)
        const codeVerifier = generateSecureRandomString(32);

        const stateHash = hashValue(state);
        const nonceHash = hashValue(nonce);

        const attempt = await OAuthAttempt.create({
            provider,
            stateHash,
            nonceHash,
            mode,
            requestedRole,
            frontendRedirectPath,
            linkingUserId,
            status: 'CREATED',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        return {
            state,
            nonce,
            codeVerifier,
            attemptId: attempt._id
        };
    }

    async validateStateAndConsumeAttempt(state, provider) {
        const stateHash = hashValue(state);
        const attempt = await OAuthAttempt.findOne({ stateHash, provider, status: 'CREATED' });

        if (!attempt) {
            throw new Error('OAUTH_STATE_INVALID_OR_REPLAYED');
        }
        if (attempt.expiresAt < new Date()) {
            attempt.status = 'EXPIRED';
            await attempt.save();
            throw new Error('OAUTH_STATE_EXPIRED');
        }

        attempt.status = 'CALLBACK_RECEIVED';
        attempt.consumedAt = new Date();
        await attempt.save();

        return attempt;
    }

    async findOrLinkIdentity(providerName, providerIdentity, attempt, req) {
        // 1. Try to find existing linked identity
        let identity = await OAuthIdentity.findOne({ 
            provider: providerName, 
            providerSubject: providerIdentity.providerSubject 
        });

        if (attempt.mode === 'LINK_ACCOUNT') {
            if (identity && identity.userId.toString() !== attempt.linkingUserId.toString()) {
                throw new Error('OAUTH_IDENTITY_ALREADY_LINKED');
            }
            if (!identity) {
                identity = await OAuthIdentity.create({
                    userId: attempt.linkingUserId,
                    provider: providerName,
                    providerSubject: providerIdentity.providerSubject,
                    providerEmailNormalized: providerIdentity.email,
                    providerEmailVerified: providerIdentity.emailVerified,
                    providerEmailPrivateRelay: providerIdentity.privateRelay,
                    providerDisplayNameSafe: providerIdentity.name,
                    providerAvatarUrlSafe: providerIdentity.picture
                });
                
                await User.updateOne(
                    { _id: attempt.linkingUserId }, 
                    { $addToSet: { authenticationMethods: providerName } }
                );
                
                await AuditLog.create({
                    actor: attempt.linkingUserId,
                    action: 'OAUTH_ACCOUNT_LINKED',
                    resourceType: 'User',
                    resourceId: attempt.linkingUserId.toString(),
                    afterSnapshot: { provider: providerName },
                    ipAddress: req.ip,
                    requestId: req.requestId
                });
            }
            return { identity, user: await User.findById(attempt.linkingUserId) };
        }

        if (identity) {
            // Update fields that might have changed, e.g. lastLoginAt, but don't overwrite name if it's missing (Apple)
            if (providerIdentity.name) {
                identity.providerDisplayNameSafe = providerIdentity.name;
            }
            if (providerIdentity.email) {
                identity.providerEmailNormalized = providerIdentity.email;
            }
            identity.lastLoginAt = new Date();
            await identity.save();

            const user = await User.findById(identity.userId);
            return { identity, user };
        }

        // 2. Identity not found: auto-link to existing user with verified email or create new account
        if (providerIdentity.email && providerIdentity.emailVerified) {
            const existingUser = await User.findOne({ email: providerIdentity.email });
            if (existingUser) {
                identity = await OAuthIdentity.create({
                    userId: existingUser._id,
                    provider: providerName,
                    providerSubject: providerIdentity.providerSubject,
                    providerEmailNormalized: providerIdentity.email,
                    providerEmailVerified: providerIdentity.emailVerified,
                    providerEmailPrivateRelay: providerIdentity.privateRelay,
                    providerDisplayNameSafe: providerIdentity.name,
                    providerAvatarUrlSafe: providerIdentity.picture,
                    lastLoginAt: new Date()
                });
                await User.updateOne(
                    { _id: existingUser._id },
                    { $addToSet: { authenticationMethods: providerName } }
                );
                return { identity, user: existingUser };
            }
        }

        // If no user exists, create new account
        const role = attempt.requestedRole || 'CUSTOMER';
        const user = await User.create({
            name: providerIdentity.name || 'User',
            email: providerIdentity.email || `hidden-${providerIdentity.providerSubject}@example.com`,
            role: role,
            status: 'ACTIVE',
            emailVerified: providerIdentity.emailVerified,
            authenticationMethods: [providerName],
            primaryAuthenticationMethod: providerName
        });

        if (role === 'WORKER' || role === 'COMPANY') {
            await WorkerProfile.create({
                userId: user._id,
                verificationStatus: 'PENDING_APPROVAL',
                isPubliclyVisible: false,
                isOnline: false
            });
        }

        identity = await OAuthIdentity.create({
            userId: user._id,
            provider: providerName,
            providerSubject: providerIdentity.providerSubject,
            providerEmailNormalized: providerIdentity.email,
            providerEmailVerified: providerIdentity.emailVerified,
            providerEmailPrivateRelay: providerIdentity.privateRelay,
            providerDisplayNameSafe: providerIdentity.name,
            providerAvatarUrlSafe: providerIdentity.picture,
            lastLoginAt: new Date()
        });

        await AuditLog.create({
            actor: user._id,
            action: 'OAUTH_SIGNUP_COMPLETED',
            resourceType: 'User',
            resourceId: user._id.toString(),
            afterSnapshot: { provider: providerName, role },
            ipAddress: req.ip,
            requestId: req.requestId
        });

        return { identity, user };
    }
}

export const oauthService = new OAuthService();
export default oauthService;
