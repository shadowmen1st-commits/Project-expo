import config from '../../config/env.js';
import { verifyJwtWithJwks } from './OAuthUtils.js';
import appleClientSecretService from './AppleClientSecretService.js';
import crypto from 'crypto';

class AppleOAuthProvider {
    get isEnabled() {
        return process.env.APPLE_OAUTH_ENABLED === 'true';
    }

    validateConfiguration() {
        if (!this.isEnabled) return false;
        const required = ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY', 'APPLE_REDIRECT_URI'];
        for (const key of required) {
            if (!process.env[key]) {
                return false;
            }
        }
        return true;
    }

    buildAuthorizationUrl(state, nonce) {
        if (!this.validateConfiguration()) throw new Error('OAUTH_PROVIDER_NOT_CONFIGURED');
        
        const params = new URLSearchParams({
            client_id: process.env.APPLE_CLIENT_ID,
            redirect_uri: process.env.APPLE_REDIRECT_URI,
            response_type: 'code',
            scope: 'name email',
            response_mode: 'form_post',
            state: state,
            nonce: nonce, // Apple expects this to be plaintext nonce (or hash of nonce), but we will pass the plaintext and apple hashes it? No, Apple passes it as is.
        });

        return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    }

    async exchangeAuthorizationCode(code) {
        const clientSecret = appleClientSecretService.getClientSecret();
        
        const response = await fetch('https://appleid.apple.com/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.APPLE_CLIENT_ID,
                client_secret: clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.APPLE_REDIRECT_URI
            })
        });

        if (!response.ok) {
            throw new Error('OAUTH_CODE_EXCHANGE_FAILED');
        }

        return response.json();
    }

    async verifyIdToken(idToken, nonceHash = null) {
        try {
            const payload = await verifyJwtWithJwks(idToken, 'https://appleid.apple.com/auth/keys', {
                audience: process.env.APPLE_CLIENT_ID,
                issuer: 'https://appleid.apple.com'
            });

            if (nonceHash && payload.nonce) {
                const hashedPayloadNonce = crypto.createHash('sha256').update(payload.nonce).digest('hex');
                if (hashedPayloadNonce !== nonceHash) {
                    throw new Error('OAUTH_NONCE_INVALID');
                }
            }

            return this.normalizeIdentity(payload);
        } catch (error) {
            throw new Error(error.message.includes('NONCE') ? 'OAUTH_NONCE_INVALID' : 'OAUTH_TOKEN_INVALID');
        }
    }

    normalizeIdentity(payload, userObjectStr = null) {
        if (!payload.sub) throw new Error('OAUTH_TOKEN_INVALID');
        
        let name = null;
        if (userObjectStr) {
            try {
                const userObj = JSON.parse(userObjectStr);
                if (userObj.name) {
                    name = [userObj.name.firstName, userObj.name.lastName].filter(Boolean).join(' ') || null;
                }
            } catch (e) {
                // ignore invalid user string
            }
        }

        const email = payload.email?.toLowerCase().trim() || null;
        const isPrivateRelay = payload.is_private_email === 'true' || payload.is_private_email === true;

        return {
            provider: 'APPLE',
            providerSubject: payload.sub,
            email: email,
            emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
            name: name,
            picture: null,
            privateRelay: isPrivateRelay,
        };
    }
}

export const appleOAuthProvider = new AppleOAuthProvider();
export default appleOAuthProvider;
