import crypto from 'crypto';
import { verifyAccessToken } from '../utils/authUtils.js';
import User from '../models/User.js';
const cookieValue = (req, name) => Object.fromEntries(String(req.headers.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2))[name];
export const authMiddleware = async (req, res, next) => {
    // 1. Request ID binding
    const requestId = req.headers['x-request-id'] || `REQ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    // 2. Extract authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieValue(req, 'access_token');
    if (!token) {
        res.status(401).json({
            statusCode: 401,
            errorCode: 'UNAUTHENTICATED',
            message: 'Authorization token is missing or malformed.',
            timestamp: new Date().toISOString(),
            requestId,
        });
        return;
    }
    try {
        const payload = verifyAccessToken(token);
        const user = await User.findById(payload.userId);
        if (!user || user.status !== 'ACTIVE') throw new Error('Account unavailable');
        req.user = { userId: user._id.toString(), id: user._id.toString(), role: user.role, email: user.email };
        next();
    }
    catch (error) {
        res.status(401).json({
            statusCode: 401,
            errorCode: 'TOKEN_INVALID_OR_EXPIRED',
            message: 'Your login session has expired. Please log in again.',
            timestamp: new Date().toISOString(),
            requestId,
        });
    }
};
