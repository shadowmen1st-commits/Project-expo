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
import { getCategories, getCategoryById } from './controllers/adminController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rawBodyMiddleware } from './middleware/rawBody.js';
import browserOriginGuard from './middleware/browserOriginGuard.js';
import mongoose from 'mongoose';
import NotificationOutbox from './models/NotificationOutbox.js';
import verificationRoutes from './routes/verificationRoutes.js';
import devRoutes from './routes/devRoutes.js';
import companyRoutes from './routes/companyRoutes.js';

export const createApp = () => {
    const app = express();
    app.set('trust proxy', true);
    
    // Structured JSON Logging
    app.use(pinoHttp({ logger }));

    // Safe Request Logger for mobile API diagnostics
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const origin = req.headers.origin || 'Native/Direct';
            const logMsg = `[API_REQ] ${req.method} ${req.originalUrl || req.url} -> HTTP ${res.statusCode} (${duration}ms) [Origin: ${origin}]`;
            console.log(logMsg);
        });
        next();
    });

    // Health Check (Public - before any middleware)
    app.get(['/health', '/api/health', '/api/v1/health'], (_req, res) => res.status(200).json({ status: 'UP', service: 'project-expo-api', timestamp: new Date().toISOString() }));

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com"],
                frameSrc: ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
                connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com", "https://*.onrender.com", "wss://*.onrender.com", "https://*.trycloudflare.com", "wss://*.trycloudflare.com", "http://localhost:*", "ws://localhost:*"],
                imgSrc: ["'self'", "data:", "https:"],
                styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                fontSrc: ["'self'", "https:", "data:"],
            }
        },
        crossOriginOpenerPolicy: false,
    }));
    const isOriginAllowed = (origin) => {
        if (!origin) return true;
        if (config.CORS_ALLOWED_ORIGINS.includes(origin)) return true;
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
        if (/^capacitor:\/\/localhost$/.test(origin) || /^https:\/\/localhost$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.loca\.lt$/.test(origin)) return true;
        if (/^https:\/\/[a-zA-Z0-9-]+\.pinggy\.link$/.test(origin)) return true;
        if (config.NODE_ENV !== 'production' && (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) || /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) || /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin) || /^exp:\/\//.test(origin))) return true;
        return false;
    };

    app.use(cors({
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                callback(null, true);
            } else {
                const error = new Error(`CORS origin not allowed: ${origin}`);
                error.statusCode = 403;
                error.errorCode = 'CORS_ORIGIN_REJECTED';
                callback(error);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'Origin',
            'X-Requested-With',
            'Idempotency-Key',
            'X-Request-Id'
        ],
        optionsSuccessStatus: 200
    }));
    app.use('/api/v1/webhooks', rawBodyMiddleware, webhookRoutes);
    app.use(browserOriginGuard(config.CORS_ALLOWED_ORIGINS));
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: false, limit: '2mb' }));
    app.use('/api/', rateLimit({ windowMs: 60000, max: process.env.NODE_ENV === 'test' ? 100000 : 10000, standardHeaders: true, legacyHeaders: false, message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } }));
    app.use('/api/auth', authRoutes);
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/dev', devRoutes);
    app.use('/api/workers', workerRoutes);
    app.use('/api/worker', workerRoutes);
    app.use('/api/v1/workers', workerRoutes);
    app.use('/api/v1/worker', workerRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/v1/bookings', bookingRoutes);
    app.use('/api/pricing', pricingRoutes);
    app.use('/api/v1/pricing', pricingRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/v1/payments', paymentRoutes);
    app.use('/api/wallet', walletRoutes);
    app.use('/api/v1/wallet', walletRoutes);
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
    app.use('/api/company', companyRoutes);
    app.use('/api/v1/company', companyRoutes);
    app.get('/api/categories', getCategories);
    app.get('/api/categories/:id', getCategoryById);
    app.get('/api/services', getCategories);
    app.get('/api/services/:id', getCategoryById);
    const healthLimiter = rateLimit({
        windowMs: 60000,
        max: process.env.NODE_ENV === 'test' ? 100000 : 50000,
        standardHeaders: true,
        legacyHeaders: false,
        message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many health check requests.' }
    });

    app.get(['/health', '/api/health', '/api/v1/health'], healthLimiter, (_req, res) => { res.status(200).json({ status: 'UP', service: 'project-expo-api', timestamp: new Date().toISOString() }); });
    app.get(['/ready', '/api/ready', '/api/v1/ready'], healthLimiter, async (_req, res) => { try { const isConnected = mongoose.connection.readyState === 1; res.status(isConnected ? 200 : 503).json({ status: isConnected ? 'READY' : 'NOT_READY', database: isConnected ? 'UP' : 'DOWN' }); } catch { res.status(503).json({ status: 'NOT_READY', database: 'DOWN' }); } });
    app.use(errorHandler);
    return app;
};

export default createApp();
