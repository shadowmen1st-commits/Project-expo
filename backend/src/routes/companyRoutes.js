import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    registerCompany,
    loginCompany,
    getCompanyMe,
    getCompanyProfile,
    updateCompanyProfile,
    createJob,
    getCompanyJobs,
    getCompanyJobById,
    updateCompanyJob,
    deleteCompanyJob,
    getCompanyApplications,
    updateApplicationStatus,
    getCompanyWorkers,
    createCompanyWorker,
    getCompanyTeams,
    createCompanyTeam,
    updateCompanyTeam,
    deleteCompanyTeam,
    assignWorkers,
    getCompanyAttendance,
    postAttendance,
    getCompanyPayments,
    getCompanyWallet,
    addWalletMoney,
    releaseEscrowPayment,
    getCompanyReports,
    getCompanyNotifications,
    getCompanyDashboard,
    getCompanyVerification,
    updateCompanyVerificationProfile,
    updateCompanyVerificationDetails,
    uploadCompanyDocument,
    deleteCompanyDocument,
    submitCompanyVerification
} from '../controllers/companyController.js';
import { viewCompanyVerificationDocument } from '../controllers/adminController.js';
import { requireVerifiedCompany } from '../middleware/requireVerifiedCompany.js';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

const requireCompanyRole = (req, res, next) => {
    if (req.user?.role !== 'COMPANY') {
        return res.status(403).json({ success: false, message: 'Forbidden. Company role required.' });
    }
    next();
};

// Auth
router.post('/register', registerCompany);
router.post('/login', loginCompany);
router.get('/me', authMiddleware, requireCompanyRole, getCompanyMe);

// Dashboard
router.get('/dashboard', authMiddleware, requireCompanyRole, getCompanyDashboard);

// Profile
router.get('/profile', authMiddleware, requireCompanyRole, getCompanyProfile);
router.put('/profile', authMiddleware, requireCompanyRole, updateCompanyProfile);

// Jobs
router.post('/jobs', authMiddleware, requireCompanyRole, requireVerifiedCompany, createJob);
router.get('/jobs', authMiddleware, requireCompanyRole, getCompanyJobs);
router.get('/jobs/:id', authMiddleware, requireCompanyRole, getCompanyJobById);
router.put('/jobs/:id', authMiddleware, requireCompanyRole, requireVerifiedCompany, updateCompanyJob);
router.delete('/jobs/:id', authMiddleware, requireCompanyRole, requireVerifiedCompany, deleteCompanyJob);

// Applications
router.get('/applications', authMiddleware, requireCompanyRole, getCompanyApplications);
router.patch('/applications/:id/:status', authMiddleware, requireCompanyRole, requireVerifiedCompany, updateApplicationStatus);

// Workers
router.get('/workers', authMiddleware, requireCompanyRole, getCompanyWorkers);
router.post('/workers', authMiddleware, requireCompanyRole, requireVerifiedCompany, createCompanyWorker);
router.post('/workers/create', authMiddleware, requireCompanyRole, requireVerifiedCompany, createCompanyWorker);
router.post('/workers/invite', authMiddleware, requireCompanyRole, requireVerifiedCompany, createCompanyWorker);

// Teams
router.get('/teams', authMiddleware, requireCompanyRole, getCompanyTeams);
router.post('/teams', authMiddleware, requireCompanyRole, requireVerifiedCompany, createCompanyTeam);
router.put('/teams/:id', authMiddleware, requireCompanyRole, requireVerifiedCompany, updateCompanyTeam);
router.delete('/teams/:id', authMiddleware, requireCompanyRole, requireVerifiedCompany, deleteCompanyTeam);

// Assignments
router.post('/assignments', authMiddleware, requireCompanyRole, requireVerifiedCompany, assignWorkers);

// Attendance
router.get('/attendance', authMiddleware, requireCompanyRole, getCompanyAttendance);
router.post('/attendance', authMiddleware, requireCompanyRole, postAttendance);

// Wallet & Payments
router.get('/wallet', authMiddleware, requireCompanyRole, getCompanyWallet);
router.post('/wallet/add', authMiddleware, requireCompanyRole, addWalletMoney);
router.get('/payments', authMiddleware, requireCompanyRole, getCompanyPayments);
router.post('/payments/release', authMiddleware, requireCompanyRole, requireVerifiedCompany, releaseEscrowPayment);

// Reports
router.get('/reports', authMiddleware, requireCompanyRole, getCompanyReports);

// Notifications
router.get('/notifications', authMiddleware, requireCompanyRole, getCompanyNotifications);

// Company KYC Verification
router.get('/verification', authMiddleware, requireCompanyRole, getCompanyVerification);
router.post('/verification/profile', authMiddleware, requireCompanyRole, updateCompanyVerificationProfile);
router.post('/verification/details', authMiddleware, requireCompanyRole, updateCompanyVerificationDetails);
router.post('/verification/submit', authMiddleware, requireCompanyRole, submitCompanyVerification);
router.post('/verification/documents', authMiddleware, requireCompanyRole, upload.single('file'), uploadCompanyDocument);
router.get('/verification/documents/:documentId/view', authMiddleware, requireCompanyRole, viewCompanyVerificationDocument);
router.delete('/verification/documents/:id', authMiddleware, requireCompanyRole, deleteCompanyDocument);

export default router;
