import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { register, login, refresh, logout, me, updateProfile, changePassword, uploadProfileImage, deleteProfileImage } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import oauthRoutes from './oauthRoutes.js';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();
const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 10000 : max, standardHeaders: true, legacyHeaders: false, message: { statusCode: 429, errorCode: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Please retry later.' } });
router.post('/register', limiter(20), register);
router.post('/login', limiter(10), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.put('/profile', authMiddleware, updateProfile);
router.put('/change-password', authMiddleware, changePassword);
router.post('/profile-image', authMiddleware, upload.single('file'), uploadProfileImage);
router.delete('/profile-image', authMiddleware, deleteProfileImage);
router.use('/oauth', oauthRoutes);
export default router;
