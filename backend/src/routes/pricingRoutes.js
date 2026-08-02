import { Router } from 'express';
import {
    createPriceQuote,
    getCommissionRules,
    getCommissionRuleDetails,
    previewCommissionRule,
    createCommissionRule,
    resolveCommissionPreview,
} from '../controllers/pricingController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Customer quote endpoint
router.post('/quote', createPriceQuote);

// Admin commission management endpoints
router.get('/admin/commission-rules', getCommissionRules);
router.get('/admin/commission-rules/:id', getCommissionRuleDetails);
router.post('/admin/commission-rules/preview', previewCommissionRule);
router.post('/admin/commission-rules', createCommissionRule);
router.post('/admin/commission-rules/resolve-preview', resolveCommissionPreview);

export default router;
