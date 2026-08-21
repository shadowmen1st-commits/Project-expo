import config from '../../config/env.js';
import { verifyJwtWithJwks } from './OAuthUtils.js';
import crypto from 'crypto';

class GoogleOAuthProvider {
    get clientId() {
        return (process.env.GOOGLE_CLIENT_ID || '').trim();
    }

    get clientSecret() {
        return (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    }

    get redirectUri() {
        return (process.env.GOOGLE_REDIRECT_URI || 'https://project-expo-md7o.onrender.com/api/auth/oauth/google/callback').trim();
    }

    get isEnabled() {
        return process.env.GOOGLE_OAUTH_ENABLED === 'true';
    }

    validateConfiguration() {
        if (!this.isEnabled) return false;
        return Boolean(this.clientId && this.clientSecret && this.redirectUri);
    }

    buildAuthorizationUrl(state, nonce) {
        if (!this.validateConfiguration()) throw new Error('OAUTH_PROVIDER_NOT_CONFIGURED');

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state: state,
            nonce: nonce,
            access_type: 'online'
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeAuthorizationCode(code) {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Google OAuth code exchange error:', response.status, errText);
            throw new Error('OAUTH_CODE_EXCHANGE_FAILED');
        }

        return response.json();
    }

    async verifyIdToken(idToken, nonceHash = null) {
        try {
            const payload = await verifyJwtWithJwks(idToken, 'https://www.googleapis.com/oauth2/v3/certs', {
                audience: this.clientId,
                issuer: ['https://accounts.google.com', 'accounts.google.com']
            });

            // If we stored the nonce securely, we should verify it
            // Google ID token payload.nonce is plaintext, so we must hash it to compare with our db
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

    normalizeIdentity(payload) {
        if (!payload.sub) throw new Error('OAUTH_TOKEN_INVALID');
        
        return {
            provider: 'GOOGLE',
            providerSubject: payload.sub,
            email: payload.email?.toLowerCase().trim() || null,
            emailVerified: payload.email_verified === true,
            name: payload.name,
            picture: payload.picture,
            privateRelay: false, // Google doesn't do private relay
        };
    }
}

export const googleOAuthProvider = new GoogleOAuthProvider();
export default googleOAuthProvider;
