import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'dispute_evidence');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate random secure filename
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `ev_${uniqueSuffix}${ext}`);
    }
});

// File filter check for extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4'];
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error('Rejected: File type extension not allowed.'), false);
    }
    cb(null, true);
};

export const uploadEvidenceMiddleware = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Validate actual file signature (magic numbers) of the uploaded file on disk.
 */
export function verifyFileSignature(filePath) {
    if (!fs.existsSync(filePath)) return false;

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex').toUpperCase();

    // Check standard magic numbers
    // PNG
    if (hex.startsWith('89504E470D0A1A0A')) return 'image/png';
    // JPEG
    if (hex.startsWith('FFD8FF')) return 'image/jpeg';
    // PDF
    if (hex.startsWith('25504446')) return 'application/pdf';
    // GIF
    if (hex.startsWith('47494638')) return 'image/gif';
    // MP4
    if (hex.slice(8, 24) === '6674797069736F6D' || hex.slice(8, 24) === '667479706D703432') return 'video/mp4';

    // Fallback if it is a simple text file/statement
    return null;
}
