import fs from 'fs';
import path from 'path';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const validateFileBuffer = (buffer, filename, mimetype) => {
    // 1. Check null byte
    if (filename.includes('\0')) {
        throw new Error('FILE_INVALID_NAME');
    }

    // 2. Path traversal check
    const decodedFilename = decodeURIComponent(filename);
    if (decodedFilename.includes('..') || decodedFilename.includes('/') || decodedFilename.includes('\\')) {
        throw new Error('FILE_PATH_TRAVERSAL_DETECTED');
    }

    // 3. Size check
    if (!buffer || buffer.length > MAX_FILE_SIZE) {
        throw new Error('FILE_TOO_LARGE');
    }

    // 4. Double extension bypass check
    const parts = filename.split('.');
    if (parts.length > 2) {
        // e.g. malicious.js.png
        const riskyExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.svg', '.sh', '.bat', '.exe', '.zip', '.tar', '.gz'];
        const innerExtensions = parts.slice(1, -1).map(ext => `.${ext.toLowerCase()}`);
        const foundRisky = innerExtensions.some(ext => riskyExtensions.includes(ext));
        if (foundRisky) {
            throw new Error('FILE_RISKY_DOUBLE_EXTENSION');
        }
    }

    // 5. Allowed extension check
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error('FILE_EXTENSION_NOT_ALLOWED');
    }

    // 6. MIME check
    if (!ALLOWED_MIMES.includes(mimetype.toLowerCase())) {
        throw new Error('FILE_MIME_NOT_ALLOWED');
    }

    // 7. Magic bytes/file signature verification
    const hex = buffer.slice(0, 8).toString('hex').toUpperCase();

    // PNG: 89504E470D0A1A0A
    if (ext === '.png') {
        if (!hex.startsWith('89504E47')) {
            throw new Error('FILE_SIGNATURE_MISMATCH');
        }
    }
    // JPEG: FFD8FF
    else if (ext === '.jpg' || ext === '.jpeg') {
        if (!hex.startsWith('FFD8FF')) {
            throw new Error('FILE_SIGNATURE_MISMATCH');
        }
    }
    // PDF: 25504446 (%PDF)
    else if (ext === '.pdf') {
        if (!hex.startsWith('25504446')) {
            throw new Error('FILE_SIGNATURE_MISMATCH');
        }
    } else {
        throw new Error('FILE_SIGNATURE_UNSUPPORTED');
    }

    return true;
};
