import { Router } from 'express';
import { getWalletDetails, requestWithdrawal } from '../controllers/walletController.js';
import { authMiddleware } from '../middleware/auth.js';
const router = Router();
router.use(authMiddleware);
router.get('/details', getWalletDetails);
router.post('/withdraw', requestWithdrawal);
export default router;
