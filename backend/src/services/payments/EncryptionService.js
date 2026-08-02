import crypto from 'crypto';
import config from '../../config/env.js';

const keyValue = () => process.env.PAYOUT_DATA_ENCRYPTION_KEY || config.PAYOUT_DATA_ENCRYPTION_KEY || (process.env.NODE_ENV === 'production' ? '' : config.ENCRYPTION_KEY) || '';
const keyVersion = () => process.env.PAYOUT_DATA_ENCRYPTION_KEY_VERSION || config.PAYOUT_DATA_ENCRYPTION_KEY_VERSION || 'v1';

function getKeyBuffer() {
    const key = keyValue();
    if (!key) {
        throw new Error('PAYOUT_DATA_ENCRYPTION_KEY must be configured.');
    }
    const normalized = key.replace(/[^a-zA-Z0-9]/g, '');
    if (normalized.length >= 32) {
        return crypto.createHash('sha256').update(normalized).digest();
    }
    return crypto.createHash('sha256').update(key).digest();
}

export const EncryptionService = {
    getKeyVersion() {
        return keyVersion();
    },
    assertConfigured() {
        getKeyBuffer();
        return true;
    },
    encryptValue(value) {
        const key = getKeyBuffer();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const plaintext = Buffer.from(String(value), 'utf8');
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            value: `${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}:${keyVersion()}`,
            keyVersion: keyVersion(),
        };
    },
    decryptValue(value, requestedKeyVersion = keyVersion()) {
        if (!value || typeof value !== 'string') {
            throw new Error('Encrypted value is missing.');
        }
        const parts = value.split(':');
        if (parts.length !== 4) {
            throw new Error('Encrypted value format is invalid.');
        }
        const [ivHex, cipherHex, tagHex, storedKeyVersion] = parts;
        if (!ivHex || !cipherHex || !tagHex) {
            throw new Error('Encrypted value format is invalid.');
        }
        if (storedKeyVersion !== requestedKeyVersion) throw new Error('Encryption key version is unavailable.');
        const key = getKeyBuffer();
        const iv = Buffer.from(ivHex, 'hex');
        const ciphertext = Buffer.from(cipherHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        try {
            decipher.setAuthTag(tag);
            const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return plaintext.toString('utf8');
        } catch (error) {
            throw error;
        }
    },
};

export default EncryptionService;
