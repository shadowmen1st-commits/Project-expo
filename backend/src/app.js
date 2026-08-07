import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './utils/logger.js';
import config from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import refundRoutes from './routes/refundRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import workerReviewRoutes from './routes/workerReviewRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import { getCategories } from './controllers/adminController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rawBodyMiddleware } from './middleware/rawBody.js';
import browserOriginGuard from './middleware/browserOriginGuard.js';
import mongoose from 'mongoose';
import NotificationOutbox from './models/NotificationOutbox.js';
import verificationRoutes from './routes/verificationRoutes.js';
import devRoutes from './routes/devRoutes.js';

export const createApp = () => {
    const app = express();
    if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
    
    // Structured JSON Logging
    app.use(pinoHttp({ logger }));
    
    app.use(helmet());
    const isOriginAllowed = (origin) => {
        if (!origin) return true;
        if (config.CORS_ALLOWED_ORIGINS.includes(origin)) return true;
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true;
        return false;
    };

    app.use(cors({
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                const error = new Error('Origin is not allowed.');
                error.statusCode = 403;
                error.errorCode = 'CORS_ORIGIN_REJECTED';
                callback(error);
            }
        },
        credentials: true,
        methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
        allowedHeaders: ['Content-Type','Authorization','Idempotency-Key','X-Request-Id']
    }));
    app.use('/api/v1/webhooks', rawBodyMiddleware, webhookRoutes);
    app.use(browserOriginGuard(config.CORS_ALLOWED_ORIGINS));
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: false, limit: '2mb' }));
    app.use('/api/', rateLimit({ windowMs: 60000, max: process.env.NODE_ENV === 'test' ? 100000 : 10000, standardHeaders: true, legacyHeaders: false, message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } }));
    app.use('/api/auth', authRoutes);
    app.use('/api/v1/dev', devRoutes);
    app.use('/api/workers', workerRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/v1/bookings', bookingRoutes);
    app.use('/api/pricing', pricingRoutes);
    app.use('/api/v1/pricing', pricingRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/v1/payments', paymentRoutes);
    app.use('/api/wallet', walletRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/v1/admin', adminRoutes);
    app.use('/api/v1/disputes', disputeRoutes);
    app.use('/api/v1/refunds', refundRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/v1/reviews', reviewRoutes);
    app.use('/api/worker/reviews', workerReviewRoutes);
    app.use('/api/v1/chat', chatRoutes);
    app.use('/api/v1/notifications', notificationRoutes);
    app.use('/api/v1/support', supportRoutes);
    app.use('/api/v1', verificationRoutes);
    app.get('/api/categories', getCategories);
    const healthLimiter = rateLimit({
        windowMs: 60000,
        max: process.env.NODE_ENV === 'test' ? 100000 : 50000,
        standardHeaders: true,
        legacyHeaders: false,
        message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many health check requests.' }
    });

    app.get('/health', healthLimiter, (_req, res) => res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() }));
    app.get('/ready', healthLimiter, async (_req,res) => { try { if(mongoose.connection.readyState!==1)return res.status(503).json({status:'NOT_READY',database:'DOWN'});await mongoose.connection.db.admin().ping();const deadLetters=await NotificationOutbox.countDocuments({status:'DEAD_LETTER'});res.status(200).json({status:'READY',database:'UP',outbox:{dispatcher:'AVAILABLE',deadLetters}});}catch{res.status(503).json({status:'NOT_READY',database:'DOWN'});} });
    app.use(errorHandler);
    return app;
};

export default createApp();
