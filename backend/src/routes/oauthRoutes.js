import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { startOAuth, oauthCallback, getProvidersStatus } from '../controllers/oauthController.js';

const router = Router();

// Rate limiting for OAuth endpoints to prevent abuse
const oauthStartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 start requests per windowMs
    message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many OAuth start requests.' }
});

const oauthCallbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // limit each IP to 50 callbacks
    message: { statusCode: 429, errorCode: 'TOO_MANY_REQUESTS', message: 'Too many OAuth callbacks.' }
});

router.get('/providers', getProvidersStatus);

router.get('/:provider/start', oauthStartLimiter, startOAuth);
router.get('/:provider/callback', oauthCallbackLimiter, oauthCallback);
router.post('/:provider/callback', oauthCallbackLimiter, oauthCallback);

export default router;
