import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
    getVerificationStatus,
    saveProfileDraft,
    saveProfessionalDetailsDraft,
    uploadDocument,
    softDeleteDocument,
    submitVerification,
    resubmitVerification,
    getDocumentAccess,
    uploadProfilePhoto,
    serveProfilePhoto
} from '../controllers/verificationController.js';
import {
    getAdminWorkerVerifications,
    getAdminWorkerVerificationDetail,
    startReview,
    approveDocument,
    requestDocumentChanges,
    rejectDocument,
    requestChangesSubmission,
    approveSubmission,
    rejectSubmission,
    suspendWorker,
    restoreWorker
} from '../controllers/adminVerificationController.js';

// Setup memory storage for custom buffer validation
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, preservePath: true });
const router = Router();
const requireWorkerRole = (req, res, next) => {
    if (req.user?.role !== 'WORKER' && req.user?.role !== 'COMPANY') {
        return res.status(403).json({ statusCode: 403, errorCode: 'FORBIDDEN', message: 'Worker or Company account required.' });
    }
    next();
};

// Worker verification routes
router.get('/worker/verification', authMiddleware, requireWorkerRole, getVerificationStatus);
router.put('/worker/verification/profile', authMiddleware, requireWorkerRole, saveProfileDraft);
router.put('/worker/verification/professional-details', authMiddleware, requireWorkerRole, saveProfessionalDetailsDraft);
router.post('/worker/verification/documents', authMiddleware, requireWorkerRole, upload.single('file'), uploadDocument);
router.put('/worker/verification/documents/:documentId', authMiddleware, requireWorkerRole, upload.single('file'), uploadDocument);
router.delete('/worker/verification/documents/:documentId', authMiddleware, requireWorkerRole, softDeleteDocument);
router.post('/worker/verification/profile-photo', authMiddleware, requireWorkerRole, upload.single('file'), uploadProfilePhoto);
router.get('/worker/verification/profile-photo/file/:filename', serveProfilePhoto);
router.post('/worker/verification/submit', authMiddleware, requireWorkerRole, submitVerification);
router.post('/worker/verification/resubmit', authMiddleware, requireWorkerRole, resubmitVerification);
router.get('/worker/verification/documents/:documentId/access', authMiddleware, getDocumentAccess);
// Convenience mapping for serving files dynamically
router.get('/worker/verification/documents/file/:documentId', authMiddleware, getDocumentAccess);

// Admin verification routes
router.get('/admin/worker-verifications', authMiddleware, requirePermission('workerVerification.read'), getAdminWorkerVerifications);
router.get('/admin/worker-verifications/:submissionId', authMiddleware, requirePermission('workerVerification.read'), getAdminWorkerVerificationDetail);
router.post('/admin/worker-verifications/:submissionId/start-review', authMiddleware, requirePermission('workerVerification.review'), startReview);
router.post('/admin/worker-verifications/:submissionId/documents/:documentId/approve', authMiddleware, requirePermission('workerVerification.review'), approveDocument);
router.post('/admin/worker-verifications/:submissionId/documents/:documentId/request-changes', authMiddleware, requirePermission('workerVerification.requestChanges'), requestDocumentChanges);
router.post('/admin/worker-verifications/:submissionId/documents/:documentId/reject', authMiddleware, requirePermission('workerVerification.reject'), rejectDocument);
router.post('/admin/worker-verifications/:submissionId/request-changes', authMiddleware, requirePermission('workerVerification.requestChanges'), requestChangesSubmission);
router.post('/admin/worker-verifications/:submissionId/approve', authMiddleware, requirePermission('workerVerification.approve'), approveSubmission);
router.post('/admin/worker-verifications/:submissionId/reject', authMiddleware, requirePermission('workerVerification.reject'), rejectSubmission);
router.post('/admin/workers/:workerId/suspend', authMiddleware, requirePermission('workerVerification.suspend'), suspendWorker);
router.post('/admin/workers/:workerId/restore', authMiddleware, requirePermission('workerVerification.approve'), restoreWorker);

export default router;
