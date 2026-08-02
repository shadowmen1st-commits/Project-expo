import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    getCancellationQuote,
    cancelBooking,
    getCustomerRefunds,
    getRefundDetails,
    resolveDispute,
    getReconciliationIssues,
} from '../controllers/refundController.js';

const router = Router();

router.use(authMiddleware);

router.get('/customer', getCustomerRefunds);
router.get('/:id', getRefundDetails);
router.post('/bookings/:id/cancellation-quote', getCancellationQuote);
router.post('/bookings/:id/cancel', cancelBooking);
router.post('/disputes/:id/resolve', resolveDispute);
router.get('/admin/refund-reconciliation', getReconciliationIssues);
router.post('/admin/refund-reconciliation/run', getReconciliationIssues); // Trigger audit run

export default router;
