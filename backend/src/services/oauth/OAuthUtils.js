import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const jwksCache = new Map();

/**
 * Fetch JWKS from a given URL and cache it based on the URL.
 */
export const fetchJwks = async (jwksUrl) => {
    const cached = jwksCache.get(jwksUrl);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.keys;
    }
    const response = await fetch(jwksUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS from ${jwksUrl}`);
    }
    const data = await response.json();
    // Cache for 1 hour
    jwksCache.set(jwksUrl, { keys: data.keys, expiresAt: Date.now() + 3600 * 1000 });
    return data.keys;
};

/**
 * Verify a JWT using JWKS keys
 */
export const verifyJwtWithJwks = async (token, jwksUrl, options = {}) => {
    // Decode header without verifying to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('Invalid token or missing kid in header');
    }

    const keys = await fetchJwks(jwksUrl);
    const key = keys.find(k => k.kid === decoded.header.kid);
    if (!key) {
        throw new Error('Matching key not found in JWKS');
    }

    // Convert JWK to PEM using Node's crypto module
    const publicKey = crypto.createPublicKey({ format: 'jwk', key }).export({ format: 'pem', type: 'spki' });

    // Verify token
    return jwt.verify(token, publicKey, {
        algorithms: [decoded.header.alg],
        ...options
    });
};

export const generateSecureRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

export const hashValue = (val) => {
    return crypto.createHash('sha256').update(val).digest('hex');
};

// PKCE Challenge generation
export const generatePkceChallenge = (verifier) => {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
};
