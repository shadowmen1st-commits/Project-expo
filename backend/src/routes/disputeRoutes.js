import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { uploadEvidenceMiddleware } from '../middleware/evidenceUpload.js';
import {
    raiseDispute,
    getCustomerDisputes,
    getWorkerDisputes,
    getDisputeDetails,
    uploadEvidence,
    respondToDispute,
    cancelDispute,
} from '../controllers/disputeController.js';

const router = Router();

router.use(authMiddleware);

router.post('/', raiseDispute);
router.get('/customer', getCustomerDisputes);
router.get('/worker', getWorkerDisputes);
router.get('/:id', getDisputeDetails);
router.post('/:id/evidence', uploadEvidenceMiddleware.single('evidence'), uploadEvidence);
router.post('/:id/respond', respondToDispute);
router.post('/:id/cancel', cancelDispute);

export default router;
