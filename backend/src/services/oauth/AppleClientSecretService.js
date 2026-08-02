import jwt from 'jsonwebtoken';
import config from '../../config/env.js'; // Ensure env has these
import crypto from 'crypto';

class AppleClientSecretService {
    constructor() {
        this.clientSecret = null;
        this.secretExpiresAt = 0;
    }

    getApplePrivateKey() {
        // Handle escaped newlines properly
        if (!process.env.APPLE_PRIVATE_KEY) return null;
        return process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    }

    generateSecret() {
        const teamId = process.env.APPLE_TEAM_ID;
        const keyId = process.env.APPLE_KEY_ID;
        const clientId = process.env.APPLE_CLIENT_ID;
        const privateKey = this.getApplePrivateKey();

        if (!teamId || !keyId || !clientId || !privateKey) {
            throw new Error('Missing Apple OAuth configuration.');
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + 86400 * 157; // ~157 days (max 157 days allowed by Apple, commonly 6 months)

        const payload = {
            iss: teamId,
            iat: now,
            exp: expiresAt,
            aud: 'https://appleid.apple.com',
            sub: clientId,
        };

        const token = jwt.sign(payload, privateKey, {
            algorithm: 'ES256',
            keyid: keyId,
        });

        this.clientSecret = token;
        this.secretExpiresAt = expiresAt;

        return token;
    }

    getClientSecret() {
        const now = Math.floor(Date.now() / 1000);
        // Regenerate if it expires in less than 1 day
        if (!this.clientSecret || this.secretExpiresAt - now < 86400) {
            this.generateSecret();
        }
        return this.clientSecret;
    }
}

export const appleClientSecretService = new AppleClientSecretService();
export default appleClientSecretService;
