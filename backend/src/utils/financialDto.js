function maskSensitiveFields(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = Array.isArray(obj) ? obj.map(maskSensitiveFields) : { ...obj };
    if (copy && typeof copy === 'object') {
        delete copy.internalAdminNotes;
        delete copy.providerSignature;
        delete copy.providerRawPayload;
        delete copy.storageKey;
        delete copy.passwordHash;
        delete copy.password;
        delete copy.kycData;
        delete copy.bankAccount;
        delete copy.bankDetails;
        delete copy.rawSignature;
        delete copy.signature;
    }
    return copy;
}

export function sanitizeDisputeDto(dispute, isAdmin = false) {
    const copy = maskSensitiveFields(dispute);
    if (!isAdmin) {
        delete copy.internalAdminNotes;
    }
    return copy;
}

export function sanitizeEvidenceDto(evidence, isAdmin = false) {
    const copy = maskSensitiveFields(evidence);
    if (!isAdmin) {
        delete copy.storageKey;
    }
    return copy;
}

export function sanitizeRefundDto(refund, ctx = {}) {
    const copy = maskSensitiveFields(refund);
    const role = (ctx.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        delete copy.providerSignature;
        delete copy.providerRawPayload;
        delete copy.internalNotes;
    }
    return copy;
}

export default {
    sanitizeDisputeDto,
    sanitizeEvidenceDto,
    sanitizeRefundDto,
};
