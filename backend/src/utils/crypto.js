import crypto from 'crypto';
import config from '../config/env.js';
// Ensure key is parsed as 32-byte buffer from hex
const ENCRYPTION_KEY_HEX = config.ENCRYPTION_KEY;
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
const ALGORITHM = 'aes-256-gcm';
export const encryptText = (text) => {
    if (!text)
        return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format: iv:encrypted:authTag
    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};
export const decryptText = (encryptedData) => {
    if (!encryptedData)
        return '';
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText).toString('utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
export const maskDocumentNumber = (docType, docNumber) => {
    if (!docNumber)
        return '';
    const clean = docNumber.replace(/\s+/g, '');
    if (docType === 'AADHAAR' && clean.length >= 12) {
        return `XXXX-XXXX-${clean.slice(-4)}`;
    }
    if (docType === 'PAN' && clean.length >= 10) {
        return `XXXXXX${clean.slice(-4)}`;
    }
    if (clean.length > 4) {
        return `${'X'.repeat(clean.length - 4)}${clean.slice(-4)}`;
    }
    return docNumber;
};
