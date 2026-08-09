import crypto from 'crypto';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import CompanyTeam from '../models/CompanyTeam.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import Attendance from '../models/Attendance.js';
import CompanyWallet from '../models/CompanyWallet.js';
import CompanyPayment from '../models/CompanyPayment.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import CompanyVerificationDocument from '../models/CompanyVerificationDocument.js';
import { hashPassword, comparePassword } from '../utils/authUtils.js';
import { issueSession, setSessionCookies, safeUser } from './authController.js';

// Helper for data validation
const validatePassword = (p) => {
    return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
};

export const registerCompany = async (req, res, next) => {
    try {
        const {
            companyName,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            businessType,
            description,
            gstNumber,
            website,
            password,
            confirmPassword,
            authorizedPersonName,
            authorizedPersonPhone,
            panNumber
        } = req.body;

        if (!companyName || !email || !phone || !address || !city || !state || !pincode || !businessType || !description || !password || !authorizedPersonName || !authorizedPersonPhone) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters, contain a letter and a number.' });
        }

        const emailExists = await User.exists({ email: email.toLowerCase().trim() });
        if (emailExists) {
            return res.status(409).json({ success: false, errorCode: 'EMAIL_EXISTS', field: 'email', message: 'This email is already registered.' });
        }

        const phoneExists = await User.exists({ phone: phone.trim() });
        if (phoneExists) {
            return res.status(409).json({ success: false, errorCode: 'PHONE_EXISTS', field: 'phone', message: 'This phone number is already registered.' });
        }

        // Create User
        const user = await User.create({
            name: companyName,
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            passwordHash: await hashPassword(password),
            role: 'COMPANY',
            status: 'ACTIVE'
        });

        try {
            // Create Profile
            await CompanyProfile.create({
                userId: user._id,
                companyName,
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                address,
                city,
                state,
                pincode,
                businessType,
                description,
                gstNumber,
                website,
                authorizedPersonName,
                authorizedPersonPhone,
                panNumber,
                verificationStatus: 'PENDING'
            });

            // Create Default Wallet
            await CompanyWallet.create({
                companyId: user._id,
                availableBalancePaise: 0,
                pendingAmountPaise: 0,
                escrowAmountPaise: 0,
                totalSpentPaise: 0
            });
        } catch (profileError) {
            await User.deleteOne({ _id: user._id });
            throw profileError;
        }

        return res.status(201).json({
            success: true,
            message: 'Company registration successful.',
            user: safeUser(user)
        });
    } catch (error) {
        next(error);
    }
};

export const loginCompany = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'COMPANY' }).select('+passwordHash');
        if (!user || !(await comparePassword(password, user.passwordHash))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ success: false, message: 'Account is locked or suspended.' });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const session = await issueSession(user);
        setSessionCookies(res, session.accessToken, session.refreshToken);

        return res.status(200).json({
            success: true,
            accessToken: session.accessToken,
            user: safeUser(user)
        });
    } catch (error) {
        next(error);
    }
};

export const getCompanyMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const profile = await CompanyProfile.findOne({ userId: user._id });
        return res.status(200).json({
            success: true,
            user: safeUser(user),
            profile
        });
    } catch (error) {
        next(error);
    }
};

export const getCompanyProfile = async (req, res, next) => {
    try {
        const profile = await CompanyProfile.findOne({ userId: req.user.userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }
        return res.status(200).json({ success: true, profile });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyProfile = async (req, res, next) => {
    try {
        const { companyName, phone, address, city, state, pincode, businessType, description, gstNumber, website } = req.body;
        const profile = await CompanyProfile.findOne({ userId: req.user.userId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        if (companyName) profile.companyName = companyName;
        if (phone) profile.phone = phone;
        if (address) profile.address = address;
        if (city) profile.city = city;
        if (state) profile.state = state;
        if (pincode) profile.pincode = pincode;
        if (businessType) profile.businessType = businessType;
        if (description) profile.description = description;
        if (gstNumber) profile.gstNumber = gstNumber;
        if (website) profile.website = website;

        await profile.save();

        // Sync main name
        if (companyName) {
            await User.updateOne({ _id: req.user.userId }, { name: companyName });
        }

        return res.status(200).json({ success: true, message: 'Profile updated successfully.', profile });
    } catch (error) {
        next(error);
    }
};

// Jobs CRUD
export const createJob = async (req, res, next) => {
    try {
        const {
            title,
            description,
            category,
            requiredSkills,
            workersRequired,
            location,
            address,
            workingDate,
            startTime,
            endTime,
            payRate,
            paymentType,
            duration,
            experienceRequired,
            genderPreference,
            instructions,
            applicationDeadline
        } = req.body;

        if (!title || !description || !category || !workersRequired || !location || !address || !workingDate || !startTime || !endTime || !payRate || !applicationDeadline) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
        }

        const job = await Job.create({
            companyId: req.user.userId,
            title,
            description,
            category,
            requiredSkills: requiredSkills || [],
            workersRequired,
            location,
            address,
            workingDate,
            startTime,
            endTime,
            payRate,
            paymentType,
            duration: duration || '1 day',
            experienceRequired: experienceRequired || 0,
            genderPreference: genderPreference || 'ANY',
            instructions,
            applicationDeadline,
            status: 'ACTIVE'
        });

        // Trigger Escrow status or Payment required for jobs
        const totalJobEscrow = payRate * workersRequired;
        const wallet = await CompanyWallet.findOne({ companyId: req.user.userId });
        if (wallet) {
            wallet.escrowAmountPaise += totalJobEscrow;
            wallet.transactionHistory.push({
                amountPaise: totalJobEscrow,
                type: 'DEBIT',
                description: `Escrow hold for posted job: ${title}`
            });
            await wallet.save();
        }

        return res.status(201).json({ success: true, message: 'Job posted successfully.', job });
    } catch (error) {
        next(error);
    }
};

export const getCompanyJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find({ companyId: req.user.userId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, jobs });
    } catch (error) {
        next(error);
    }
};

export const getCompanyJobById = async (req, res, next) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }
        return res.status(200).json({ success: true, job });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyJob = async (req, res, next) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }
        Object.assign(job, req.body);
        await job.save();
        return res.status(200).json({ success: true, message: 'Job updated successfully.', job });
    } catch (error) {
        next(error);
    }
};

export const deleteCompanyJob = async (req, res, next) => {
    try {
        const job = await Job.findOne({ _id: req.params.id, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }
        job.status = 'CANCELLED';
        await job.save();
        return res.status(200).json({ success: true, message: 'Job cancelled successfully.' });
    } catch (error) {
        next(error);
    }
};

// Applications
export const getCompanyApplications = async (req, res, next) => {
    try {
        const jobs = await Job.find({ companyId: req.user.userId }).select('_id');
        const jobIds = jobs.map(j => j._id);
        const applications = await JobApplication.find({ jobId: { $in: jobIds } })
            .populate('jobId', 'title payRate location')
            .populate('workerId', 'name email phone profileImage')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, applications });
    } catch (error) {
        next(error);
    }
};

export const updateApplicationStatus = async (req, res, next) => {
    try {
        const { id, status } = req.params; // E.g., select, reject, shortlist
        const app = await JobApplication.findById(id).populate('jobId');
        if (!app || app.jobId.companyId.toString() !== req.user.userId) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }

        app.status = status.toUpperCase();
        await app.save();

        // If SELECTED, auto create assignment
        if (app.status === 'SELECTED') {
            await WorkerAssignment.create({
                jobId: app.jobId._id,
                workerId: app.workerId,
                assignedBy: req.user.userId,
                status: 'ASSIGNED'
            });

            // Dispatch notification
            await Notification.create({
                recipientId: app.workerId,
                type: 'WORKER_ACCEPTED',
                category: 'BOOKING',
                title: 'Application Selected',
                messageSafe: `Congratulations! You have been selected for: ${app.jobId.title}`,
                entityType: 'Job',
                entityId: app.jobId._id,
                dedupeKey: `job-select-${app._id}`
            });
        }

        return res.status(200).json({ success: true, message: `Application ${status.toLowerCase()}ed successfully.`, application: app });
    } catch (error) {
        next(error);
    }
};

// Workers Assigned
export const getCompanyWorkers = async (req, res, next) => {
    try {
        const jobs = await Job.find({ companyId: req.user.userId }).select('_id');
        const jobIds = jobs.map(j => j._id);
        const assignments = await WorkerAssignment.find({ jobId: { $in: jobIds } })
            .populate('jobId', 'title payRate location')
            .populate('workerId', 'name email phone profileImage')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, workers: assignments });
    } catch (error) {
        next(error);
    }
};

// Teams Management
export const getCompanyTeams = async (req, res, next) => {
    try {
        const teams = await CompanyTeam.find({ companyId: req.user.userId })
            .populate('leaderId', 'name email')
            .populate('members', 'name email phone');
        return res.status(200).json({ success: true, teams });
    } catch (error) {
        next(error);
    }
};

export const createCompanyTeam = async (req, res, next) => {
    try {
        const { name, leaderId, members } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Team name is required.' });
        }
        const team = await CompanyTeam.create({
            companyId: req.user.userId,
            name,
            leaderId,
            members: members || []
        });
        return res.status(201).json({ success: true, message: 'Team created successfully.', team });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyTeam = async (req, res, next) => {
    try {
        const team = await CompanyTeam.findOne({ _id: req.params.id, companyId: req.user.userId });
        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found.' });
        }
        Object.assign(team, req.body);
        await team.save();
        return res.status(200).json({ success: true, message: 'Team updated successfully.', team });
    } catch (error) {
        next(error);
    }
};

export const deleteCompanyTeam = async (req, res, next) => {
    try {
        const result = await CompanyTeam.deleteOne({ _id: req.params.id, companyId: req.user.userId });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Team not found.' });
        }
        return res.status(200).json({ success: true, message: 'Team deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

// Assignments (Directly assign)
export const assignWorkers = async (req, res, next) => {
    try {
        const { jobId, workerIds, teamId } = req.body;
        if (!jobId) {
            return res.status(400).json({ success: false, message: 'Job ID is required.' });
        }

        const job = await Job.findOne({ _id: jobId, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }

        let targets = [];
        if (workerIds && Array.isArray(workerIds)) {
            targets = workerIds;
        } else if (teamId) {
            const team = await CompanyTeam.findOne({ _id: teamId, companyId: req.user.userId });
            if (team) {
                targets = team.members;
                if (team.leaderId && !targets.includes(team.leaderId)) {
                    targets.push(team.leaderId);
                }
            }
        }

        const created = [];
        for (const workerId of targets) {
            // Prevent duplicate assignments
            const exists = await WorkerAssignment.exists({ jobId, workerId });
            if (!exists) {
                const assign = await WorkerAssignment.create({
                    jobId,
                    workerId,
                    assignedBy: req.user.userId,
                    status: 'ASSIGNED'
                });
                created.push(assign);

                // Dispatch notification
                await Notification.create({
                    recipientId: workerId,
                    type: 'WORKER_ACCEPTED',
                    category: 'BOOKING',
                    title: 'New Job Assignment',
                    messageSafe: `You have been directly assigned to job: ${job.title}`,
                    entityType: 'Job',
                    entityId: job._id,
                    dedupeKey: `job-assign-${job._id}-${workerId}`
                });
            }
        }

        return res.status(200).json({ success: true, message: `Assigned ${created.length} workers successfully.`, assignments: created });
    } catch (error) {
        next(error);
    }
};

// Attendance
export const getCompanyAttendance = async (req, res, next) => {
    try {
        const jobs = await Job.find({ companyId: req.user.userId }).select('_id');
        const jobIds = jobs.map(j => j._id);
        const attendance = await Attendance.find({ jobId: { $in: jobIds } })
            .populate('jobId', 'title payRate')
            .populate('workerId', 'name email phone')
            .sort({ date: -1 });

        return res.status(200).json({ success: true, attendance });
    } catch (error) {
        next(error);
    }
};

export const postAttendance = async (req, res, next) => {
    try {
        const { jobId, workerId, date, startTime, endTime, status, hoursWorked } = req.body;
        if (!jobId || !workerId || !date || !status) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        const job = await Job.findOne({ _id: jobId, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }

        const record = await Attendance.findOneAndUpdate(
            { jobId, workerId, date: new Date(date) },
            { startTime: startTime || '09:00', endTime: endTime || '18:00', status, hoursWorked: hoursWorked || 0 },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, message: 'Attendance record saved successfully.', record });
    } catch (error) {
        next(error);
    }
};

// Payments & Wallet
export const getCompanyPayments = async (req, res, next) => {
    try {
        const payments = await CompanyPayment.find({ companyId: req.user.userId })
            .populate('jobId', 'title payRate')
            .populate('workerId', 'name email')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, payments });
    } catch (error) {
        next(error);
    }
};

export const getCompanyWallet = async (req, res, next) => {
    try {
        let wallet = await CompanyWallet.findOne({ companyId: req.user.userId });
        if (!wallet) {
            wallet = await CompanyWallet.create({
                companyId: req.user.userId,
                availableBalancePaise: 0,
                pendingAmountPaise: 0,
                escrowAmountPaise: 0,
                totalSpentPaise: 0
            });
        }
        return res.status(200).json({ success: true, wallet });
    } catch (error) {
        next(error);
    }
};

export const addWalletMoney = async (req, res, next) => {
    try {
        const { amount } = req.body; // in paise
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount.' });
        }

        const wallet = await CompanyWallet.findOne({ companyId: req.user.userId });
        wallet.availableBalancePaise += Number(amount);
        wallet.transactionHistory.push({
            amountPaise: Number(amount),
            type: 'CREDIT',
            description: 'Funds deposited via gateway simulated success.'
        });
        await wallet.save();

        return res.status(200).json({ success: true, message: 'Funds deposited successfully.', wallet });
    } catch (error) {
        next(error);
    }
};

export const releaseEscrowPayment = async (req, res, next) => {
    try {
        const { assignmentId } = req.body;
        const assign = await WorkerAssignment.findById(assignmentId).populate('jobId');
        if (!assign || assign.jobId.companyId.toString() !== req.user.userId) {
            return res.status(404).json({ success: false, message: 'Assignment not found.' });
        }

        if (assign.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Payment already released.' });
        }

        const totalPay = assign.jobId.payRate;
        const commission = Math.round(totalPay * 0.1); // 10% Platform fee
        const workerEarning = totalPay - commission;

        // Deduct from Company Wallet escrow and transfer to worker
        const wallet = await CompanyWallet.findOne({ companyId: req.user.userId });
        if (wallet) {
            wallet.escrowAmountPaise = Math.max(0, wallet.escrowAmountPaise - totalPay);
            wallet.totalSpentPaise += totalPay;
            await wallet.save();
        }

        // Create Payment record
        await CompanyPayment.create({
            companyId: req.user.userId,
            jobId: assign.jobId._id,
            workerId: assign.workerId,
            amountPaise: totalPay,
            platformCommissionPaise: commission,
            workerEarningPaise: workerEarning,
            status: 'RELEASED'
        });

        assign.status = 'COMPLETED';
        await assign.save();

        return res.status(200).json({ success: true, message: 'Payment released to worker successfully.' });
    } catch (error) {
        next(error);
    }
};

// Reports
export const getCompanyReports = async (req, res, next) => {
    try {
        const companyId = new mongoose.Types.ObjectId(req.user.userId);
        const totalJobs = await Job.countDocuments({ companyId });
        const activeJobs = await Job.countDocuments({ companyId, status: 'ACTIVE' });
        const completedJobs = await Job.countDocuments({ companyId, status: 'COMPLETED' });
        const cancelledJobs = await Job.countDocuments({ companyId, status: 'CANCELLED' });

        const jobs = await Job.find({ companyId }).select('_id');
        const jobIds = jobs.map(j => j._id);
        const totalHired = await WorkerAssignment.countDocuments({ jobId: { $in: jobIds }, status: 'COMPLETED' });

        const paymentAggr = await CompanyPayment.aggregate([
            { $match: { companyId, status: 'RELEASED' } },
            { $group: { _id: null, totalSpent: { $sum: '$amountPaise' } } }
        ]);
        const totalSpent = paymentAggr[0]?.totalSpent || 0;

        return res.status(200).json({
            success: true,
            data: {
                totalJobs,
                activeJobs,
                completedJobs,
                cancelledJobs,
                totalHired,
                totalSpent,
                averageJobCost: totalJobs > 0 ? Math.round(totalSpent / totalJobs) : 0
            }
        });
    } catch (error) {
        next(error);
    }
};

// Notifications
export const getCompanyNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user.userId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, notifications });
    } catch (error) {
        next(error);
    }
};

export const getCompanyDashboard = async (req, res, next) => {
    try {
        const companyId = new mongoose.Types.ObjectId(req.user.userId);
        const jobs = await Job.find({ companyId }).sort({ createdAt: -1 }).limit(5);
        const jobIds = jobs.map(j => j._id);

        const activeJobsCount = await Job.countDocuments({ companyId, status: 'ACTIVE' });
        const completedJobsCount = await Job.countDocuments({ companyId, status: 'COMPLETED' });

        const applications = await JobApplication.find({ jobId: { $in: jobIds } })
            .populate('workerId', 'name email')
            .populate('jobId', 'title')
            .limit(5);

        const assignedCount = await WorkerAssignment.countDocuments({ jobId: { $in: jobIds }, status: 'ASSIGNED' });
        const workingCount = await WorkerAssignment.countDocuments({ jobId: { $in: jobIds }, status: 'WORKING' });

        const wallet = await CompanyWallet.findOne({ companyId });

        return res.status(200).json({
            success: true,
            data: {
                activeJobs: activeJobsCount,
                completedJobs: completedJobsCount,
                applications: applications.length,
                workersAssigned: assignedCount,
                workersWorking: workingCount,
                walletBalance: wallet?.availableBalancePaise || 0,
                totalSpent: wallet?.totalSpentPaise || 0,
                recentJobs: jobs,
                recentApplications: applications
            }
        });
    } catch (error) {
        next(error);
    }
};

// Company KYC Verification Endpoints
export const getCompanyVerification = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const profile = await CompanyProfile.findOne({ userId: companyId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        const documents = await CompanyVerificationDocument.find({ companyId });

        // Calculate Progress
        let progress = 0;
        const checklist = {
            profile: !!(profile.companyName && profile.address && profile.businessType && profile.authorizedPersonName),
            businessRegistration: false,
            addressProof: false,
            authorizedPersonId: false,
            companyPan: false
        };

        if (checklist.profile) progress += 20;

        documents.forEach(doc => {
            if (doc.status === 'APPROVED' || doc.status === 'PENDING') {
                if (doc.documentType === 'BUSINESS_REGISTRATION') {
                    checklist.businessRegistration = doc.status;
                } else if (doc.documentType === 'ADDRESS_PROOF') {
                    checklist.addressProof = doc.status;
                } else if (doc.documentType === 'AUTHORIZED_PERSON_ID') {
                    checklist.authorizedPersonId = doc.status;
                } else if (doc.documentType === 'COMPANY_PAN') {
                    checklist.companyPan = doc.status;
                }
            }
        });

        // Add 20% for each present/approved document
        const docs = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN'];
        docs.forEach(dtype => {
            const hasDoc = documents.find(d => d.documentType === dtype && (d.status === 'APPROVED' || d.status === 'PENDING'));
            if (hasDoc) progress += 20;
        });

        return res.status(200).json({
            success: true,
            verificationStatus: profile.verificationStatus,
            progress,
            checklist,
            documents,
            needsInfoReason: profile.needsInfoReason,
            rejectionReason: profile.rejectionReason,
            suspensionReason: profile.suspensionReason
        });
    } catch (error) {
        next(error);
    }
};

export const uploadCompanyDocument = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const { documentType } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        if (!documentType) {
            return res.status(400).json({ success: false, message: 'documentType is required.' });
        }

        const STORAGE_DIR = path.resolve('uploads/verification');
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }

        const fileExt = path.extname(req.file.originalname);
        const randomName = `${crypto.randomUUID()}${fileExt}`;
        const filePath = path.join(STORAGE_DIR, randomName);
        fs.writeFileSync(filePath, req.file.buffer);

        // Upsert document
        const document = await CompanyVerificationDocument.findOneAndUpdate(
            { companyId, documentType },
            {
                documentUrl: `/uploads/verification/${randomName}`,
                storageKey: randomName,
                status: 'PENDING',
                rejectionReason: null
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, message: 'Document uploaded successfully.', document });
    } catch (error) {
        next(error);
    }
};

export const submitCompanyVerification = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const profile = await CompanyProfile.findOne({ userId: companyId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        // Validate completeness
        const requiredDocs = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN'];
        const uploadedDocs = await CompanyVerificationDocument.find({ companyId });

        for (const type of requiredDocs) {
            const hasDoc = uploadedDocs.some(d => d.documentType === type);
            if (!hasDoc) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Please upload all required documents: ${type.replace('_', ' ')} is missing.` 
                });
            }
        }

        const beforeSnapshot = JSON.parse(JSON.stringify(profile));
        profile.verificationStatus = 'UNDER_REVIEW';
        await profile.save();

        // Audit Log
        await new AuditLog({
            actor: companyId,
            action: 'COMPANY_VERIFICATION_SUBMITTED',
            resourceType: 'COMPANY_PROFILE',
            resourceId: companyId.toString(),
            beforeSnapshot,
            afterSnapshot: JSON.parse(JSON.stringify(profile)),
            requestId: req.requestId
        }).save();

        // Notify Admins
        const admins = await User.find({ role: 'ADMIN' });
        for (const admin of admins) {
            await new Notification({
                recipientId: admin._id,
                title: 'New Company KYC Submitted',
                message: `Company ${profile.companyName} has submitted KYC documents for review.`,
                type: 'WARNING'
            }).save();
        }

        // Notify Company
        await new Notification({
            recipientId: companyId,
            title: 'KYC Submitted Successfully',
            message: 'Your company verification documents are under review.',
            type: 'INFO'
        }).save();

        return res.status(200).json({ success: true, message: 'KYC submitted for review.', profile });
    } catch (error) {
        next(error);
    }
};

