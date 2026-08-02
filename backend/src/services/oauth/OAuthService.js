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

        // 2. Identity not found, handle SIGNUP or LOGIN (which might fallback to signup or require link)
        if (attempt.mode === 'LOGIN') {
            // Is there a user with this email? If so, we DO NOT AUTO-LINK. We require explicit link.
            if (providerIdentity.email && providerIdentity.emailVerified) {
                const existingUser = await User.findOne({ email: providerIdentity.email });
                if (existingUser) {
                    throw new Error('OAUTH_ACCOUNT_LINK_REQUIRED');
                }
            }
            // Policy: We could reject LOGIN if unknown, but normally OAuth allows auto-signup if no conflict.
            // But wait, the prompt says "Unknown provider identity should not silently create a new account unless business policy explicitly allows it" and "Return a controlled account not found; use signup flow where required".
            // We will throw an error to redirect to signup.
            throw new Error('OAUTH_ACCOUNT_NOT_FOUND');
        }

        if (attempt.mode === 'SIGNUP') {
            if (['ADMIN', 'SUPER_ADMIN'].includes(attempt.requestedRole)) {
                throw new Error('OAUTH_INVALID_ROLE');
            }

            if (providerIdentity.email && providerIdentity.emailVerified) {
                const existingUser = await User.findOne({ email: providerIdentity.email });
                if (existingUser) {
                    throw new Error('OAUTH_ACCOUNT_LINK_REQUIRED');
                }
            }

            const role = attempt.requestedRole || 'CUSTOMER';
            const user = await User.create({
                name: providerIdentity.name || 'Unknown',
                email: providerIdentity.email || `hidden-${providerIdentity.providerSubject}@example.com`,
                role: role,
                status: 'ACTIVE',
                emailVerified: providerIdentity.emailVerified,
                authenticationMethods: [providerName],
                primaryAuthenticationMethod: providerName
            });

            if (role === 'WORKER') {
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

        throw new Error('OAUTH_INVALID_MODE');
    }
}

export const oauthService = new OAuthService();
export default oauthService;
