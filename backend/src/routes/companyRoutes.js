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
    getCompanyDashboard
} from '../controllers/companyController.js';

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
router.post('/jobs', authMiddleware, requireCompanyRole, createJob);
router.get('/jobs', authMiddleware, requireCompanyRole, getCompanyJobs);
router.get('/jobs/:id', authMiddleware, requireCompanyRole, getCompanyJobById);
router.put('/jobs/:id', authMiddleware, requireCompanyRole, updateCompanyJob);
router.delete('/jobs/:id', authMiddleware, requireCompanyRole, deleteCompanyJob);

// Applications
router.get('/applications', authMiddleware, requireCompanyRole, getCompanyApplications);
router.patch('/applications/:id/:status', authMiddleware, requireCompanyRole, updateApplicationStatus);

// Workers
router.get('/workers', authMiddleware, requireCompanyRole, getCompanyWorkers);

// Teams
router.get('/teams', authMiddleware, requireCompanyRole, getCompanyTeams);
router.post('/teams', authMiddleware, requireCompanyRole, createCompanyTeam);
router.put('/teams/:id', authMiddleware, requireCompanyRole, updateCompanyTeam);
router.delete('/teams/:id', authMiddleware, requireCompanyRole, deleteCompanyTeam);

// Assignments
router.post('/assignments', authMiddleware, requireCompanyRole, assignWorkers);

// Attendance
router.get('/attendance', authMiddleware, requireCompanyRole, getCompanyAttendance);
router.post('/attendance', authMiddleware, requireCompanyRole, postAttendance);

// Wallet & Payments
router.get('/wallet', authMiddleware, requireCompanyRole, getCompanyWallet);
router.post('/wallet/add', authMiddleware, requireCompanyRole, addWalletMoney);
router.get('/payments', authMiddleware, requireCompanyRole, getCompanyPayments);
router.post('/payments/release', authMiddleware, requireCompanyRole, releaseEscrowPayment);

// Reports
router.get('/reports', authMiddleware, requireCompanyRole, getCompanyReports);

// Notifications
router.get('/notifications', authMiddleware, requireCompanyRole, getCompanyNotifications);

export default router;
