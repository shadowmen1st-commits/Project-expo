import crypto from 'crypto';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import User from '../models/User.js';
import WorkerProfile from '../models/WorkerProfile.js';
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
import { validateFileBuffer } from '../utils/fileValidator.js';
import { isValidCategory, isValidCategoryAndTitle } from '../config/jobCategories.js';
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

        if (!category) {
            return res.status(400).json({ success: false, message: 'Please select a category.' });
        }

        if (!title) {
            return res.status(400).json({ success: false, message: 'Please select a job title.' });
        }

        if (!description || workersRequired === undefined || workersRequired === null || !location || !address || !workingDate || !startTime || !endTime || !payRate || !applicationDeadline) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
        }

        if (!isValidCategory(category)) {
            return res.status(400).json({ success: false, message: 'Invalid job category.' });
        }

        if (!isValidCategoryAndTitle(category, title)) {
            return res.status(400).json({ success: false, message: 'Please select a valid job title for this category.' });
        }

        const numWorkers = Number(workersRequired);
        if (isNaN(numWorkers) || numWorkers < 1) {
            return res.status(400).json({ success: false, message: 'Workers Required must be at least 1.' });
        }

        if (endTime <= startTime) {
            return res.status(400).json({ success: false, message: 'End time must be after start time.' });
        }

        const job = await Job.create({
            companyId: req.user.userId,
            title,
            description,
            category,
            requiredSkills: requiredSkills || [],
            workersRequired: numWorkers,
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
        const totalJobEscrow = payRate * numWorkers;
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

        const category = req.body.category !== undefined ? req.body.category : job.category;
        const title = req.body.title !== undefined ? req.body.title : job.title;

        if (req.body.category !== undefined && !category) {
            return res.status(400).json({ success: false, message: 'Please select a category.' });
        }

        if (req.body.title !== undefined && !title) {
            return res.status(400).json({ success: false, message: 'Please select a job title.' });
        }

        if (req.body.category !== undefined && !isValidCategory(category)) {
            return res.status(400).json({ success: false, message: 'Invalid job category.' });
        }

        if ((req.body.category !== undefined || req.body.title !== undefined) && !isValidCategoryAndTitle(category, title)) {
            return res.status(400).json({ success: false, message: 'Please select a valid job title for this category.' });
        }

        if (req.body.workersRequired !== undefined) {
            const numWorkers = Number(req.body.workersRequired);
            if (isNaN(numWorkers) || numWorkers < 1) {
                return res.status(400).json({ success: false, message: 'Workers Required must be at least 1.' });
            }
        }

        if (req.body.startTime !== undefined || req.body.endTime !== undefined) {
            const start = req.body.startTime !== undefined ? req.body.startTime : job.startTime;
            const end = req.body.endTime !== undefined ? req.body.endTime : job.endTime;
            if (end <= start) {
                return res.status(400).json({ success: false, message: 'End time must be after start time.' });
            }
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
        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        if (app.jobId.companyId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, errorCode: 'FORBIDDEN', message: 'Unauthorized. Application belongs to another company.' });
        }

        app.status = status.toUpperCase();
        await app.save();

        // If SELECTED, auto create assignment
        if (app.status === 'SELECTED') {
            const exists = await WorkerAssignment.exists({ jobId: app.jobId._id, workerId: app.workerId });
            if (!exists) {
                await WorkerAssignment.create({
                    jobId: app.jobId._id,
                    workerId: app.workerId,
                    companyId: req.user.userId,
                    assignedBy: req.user.userId,
                    status: 'ASSIGNED',
                    paymentStatus: 'PENDING'
                });
            }

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

// Workers Assigned / Available
export const getCompanyWorkers = async (req, res, next) => {
    try {
        const { search, category, status } = req.query;
        let filter = { role: 'WORKER' };

        if (status) {
            filter.status = status.toUpperCase();
        } else {
            filter.status = 'ACTIVE';
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
        }

        let workers = await User.find(filter).select('_id name email phone status profileImage').sort({ name: 1 });

        if (category) {
            const profiles = await WorkerProfile.find({ category: new RegExp(category, 'i') }).select('userId');
            const matchingUserIds = new Set(profiles.map(p => p.userId.toString()));
            workers = workers.filter(w => matchingUserIds.has(w._id.toString()));
        }

        return res.status(200).json({ success: true, workers });
    } catch (error) {
        next(error);
    }
};

export const createCompanyWorker = async (req, res, next) => {
    try {
        const { name, email, phone, category, skills, hourlyRate, experienceYears } = req.body;

        // 1. Validation
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName || trimmedName.length < 2) {
            return res.status(400).json({ success: false, message: 'Worker name is required.' });
        }

        const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
        }

        const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
        const phoneRegex = /^\+?\d{7,15}$/;
        if (!trimmedPhone || !phoneRegex.test(trimmedPhone)) {
            return res.status(400).json({ success: false, message: 'Please provide a valid phone number.' });
        }

        // 2. Duplicate checks
        const existingEmail = await User.findOne({ email: trimmedEmail });
        if (existingEmail) {
            return res.status(409).json({ 
                success: false, 
                errorCode: 'DUPLICATE_EMAIL',
                message: 'A user with this email address already exists.' 
            });
        }

        const existingPhone = await User.findOne({ phone: trimmedPhone });
        if (existingPhone) {
            return res.status(409).json({ 
                success: false, 
                errorCode: 'DUPLICATE_PHONE',
                message: 'A user with this phone number already exists.' 
            });
        }

        // 3. Create User record
        const randomPass = crypto.randomBytes(8).toString('hex');
        const passwordHash = await hashPassword(randomPass);

        const workerUser = await User.create({
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
            passwordHash,
            role: 'WORKER',
            status: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true
        });

        // 4. Create WorkerProfile
        const parsedSkills = Array.isArray(skills) 
            ? skills 
            : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

        const profile = await WorkerProfile.create({
            userId: workerUser._id,
            category: category || 'Event Staffing',
            skills: parsedSkills,
            hourlyRate: Number(hourlyRate) || 100,
            experienceYears: Number(experienceYears) || 1,
            verificationStatus: 'APPROVED',
            isPubliclyVisible: true,
            verificationBadge: true,
            approvedAt: new Date(),
            approvedBy: req.user.userId
        });

        // 5. Audit Log & Notification
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_WORKER_CREATE',
            resourceType: 'User',
            resourceId: workerUser._id.toString()
        }).save();

        await new Notification({
            recipientId: workerUser._id,
            title: 'Welcome to HyperLocal Marketplace',
            message: `You have been added to the workforce pool by company.`,
            type: 'INFO'
        }).save();

        return res.status(201).json({
            success: true,
            message: 'Worker created successfully.',
            worker: {
                _id: workerUser._id,
                name: workerUser.name,
                email: workerUser.email,
                phone: workerUser.phone,
                status: workerUser.status,
                profile
            }
        });
    } catch (error) {
        next(error);
    }
};

// Teams Management
export const getCompanyTeams = async (req, res, next) => {
    try {
        const teams = await CompanyTeam.find({ companyId: req.user.userId })
            .populate('leaderId', 'name email phone profileImage')
            .populate('members', 'name email phone profileImage')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, teams });
    } catch (error) {
        next(error);
    }
};

export const createCompanyTeam = async (req, res, next) => {
    try {
        const { name, leaderId, members } = req.body;

        // 1. Team Name validation
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
            return res.status(400).json({ 
                success: false, 
                errorCode: 'INVALID_TEAM_NAME',
                message: 'Team name is required and must be between 2 and 100 characters.' 
            });
        }

        // 2. Leader ID validation
        if (!leaderId || !mongoose.Types.ObjectId.isValid(leaderId)) {
            return res.status(400).json({ 
                success: false, 
                errorCode: 'INVALID_WORKER_ID',
                message: 'Please select a valid team leader.' 
            });
        }

        // 3. Members array validation
        const rawMembers = Array.isArray(members) ? members : [];
        for (const mId of rawMembers) {
            if (!mId || !mongoose.Types.ObjectId.isValid(mId)) {
                return res.status(400).json({ 
                    success: false, 
                    errorCode: 'INVALID_WORKER_ID',
                    message: 'Please select valid team members.' 
                });
            }
        }

        // 4. Automatically include leader in members & remove duplicates
        const uniqueWorkerIdStrs = Array.from(new Set([
            leaderId.toString(), 
            ...rawMembers.map(m => m.toString())
        ]));

        // 5. Query MongoDB for worker documents
        const foundWorkers = await User.find({ 
            _id: { $in: uniqueWorkerIdStrs } 
        });

        if (foundWorkers.length !== uniqueWorkerIdStrs.length) {
            return res.status(404).json({ 
                success: false, 
                errorCode: 'WORKER_NOT_FOUND',
                message: 'One or more selected workers do not exist.' 
            });
        }

        // 6. Verify role, status, and company authorization
        for (const w of foundWorkers) {
            if (w.role !== 'WORKER' || w.status !== 'ACTIVE') {
                return res.status(403).json({ 
                    success: false, 
                    errorCode: 'WORKER_NOT_AUTHORIZED',
                    message: 'One or more selected workers are not available to this company.' 
                });
            }
        }

        // 7. Create team
        const team = await CompanyTeam.create({
            companyId: req.user.userId,
            name: trimmedName,
            leaderId,
            members: uniqueWorkerIdStrs
        });

        // 8. Populate & return created team
        const populatedTeam = await CompanyTeam.findById(team._id)
            .populate('leaderId', 'name email phone profileImage')
            .populate('members', 'name email phone profileImage');

        return res.status(201).json({ 
            success: true, 
            message: 'Team created successfully.', 
            team: populatedTeam 
        });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyTeam = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false, 
                errorCode: 'INVALID_TEAM_ID',
                message: 'Invalid team ID.' 
            });
        }

        const team = await CompanyTeam.findOne({ _id: id, companyId: req.user.userId });
        if (!team) {
            return res.status(404).json({ success: false, message: 'Team not found.' });
        }

        const { name, leaderId, members } = req.body;

        // 1. Name validation
        if (name !== undefined) {
            const trimmedName = typeof name === 'string' ? name.trim() : '';
            if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 100) {
                return res.status(400).json({ 
                    success: false, 
                    errorCode: 'INVALID_TEAM_NAME',
                    message: 'Team name is required and must be between 2 and 100 characters.' 
                });
            }
            team.name = trimmedName;
        }

        // 2. Leader ID validation
        const targetLeaderId = leaderId || team.leaderId?.toString();
        if (!targetLeaderId || !mongoose.Types.ObjectId.isValid(targetLeaderId)) {
            return res.status(400).json({ 
                success: false, 
                errorCode: 'INVALID_WORKER_ID',
                message: 'Please select a valid team leader.' 
            });
        }

        // 3. Members validation
        const rawMembers = Array.isArray(members) ? members : (team.members || []);
        for (const mId of rawMembers) {
            if (!mId || !mongoose.Types.ObjectId.isValid(mId)) {
                return res.status(400).json({ 
                    success: false, 
                    errorCode: 'INVALID_WORKER_ID',
                    message: 'Please select valid team members.' 
                });
            }
        }

        // 4. Include leader & deduplicate
        const uniqueWorkerIdStrs = Array.from(new Set([
            targetLeaderId.toString(), 
            ...rawMembers.map(m => m.toString())
        ]));

        // 5. Worker checks
        const foundWorkers = await User.find({ 
            _id: { $in: uniqueWorkerIdStrs } 
        });

        if (foundWorkers.length !== uniqueWorkerIdStrs.length) {
            return res.status(404).json({ 
                success: false, 
                errorCode: 'WORKER_NOT_FOUND',
                message: 'One or more selected workers do not exist.' 
            });
        }

        for (const w of foundWorkers) {
            if (w.role !== 'WORKER' || w.status !== 'ACTIVE') {
                return res.status(403).json({ 
                    success: false, 
                    errorCode: 'WORKER_NOT_AUTHORIZED',
                    message: 'One or more selected workers are not available to this company.' 
                });
            }
        }

        team.leaderId = targetLeaderId;
        team.members = uniqueWorkerIdStrs;
        await team.save();

        const populatedTeam = await CompanyTeam.findById(team._id)
            .populate('leaderId', 'name email phone profileImage')
            .populate('members', 'name email phone profileImage');

        return res.status(200).json({ 
            success: true, 
            message: 'Team updated successfully.', 
            team: populatedTeam 
        });
    } catch (error) {
        next(error);
    }
};

export const deleteCompanyTeam = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false, 
                errorCode: 'INVALID_TEAM_ID',
                message: 'Invalid team ID.' 
            });
        }

        const result = await CompanyTeam.deleteOne({ _id: id, companyId: req.user.userId });
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

        // 1. Job ID validation
        if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid job ID.' });
        }

        const job = await Job.findOne({ _id: jobId, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }

        // 2. Resolve target workers
        let targets = [];
        if (workerIds && Array.isArray(workerIds)) {
            for (const wId of workerIds) {
                if (!wId || !mongoose.Types.ObjectId.isValid(wId)) {
                    return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid worker ID.' });
                }
            }
            targets = workerIds.map(w => w.toString());
        } else if (teamId) {
            if (!mongoose.Types.ObjectId.isValid(teamId)) {
                return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid team ID.' });
            }
            const team = await CompanyTeam.findOne({ _id: teamId, companyId: req.user.userId });
            if (!team) {
                return res.status(404).json({ success: false, message: 'Team not found.' });
            }
            targets = team.members.map(m => m.toString());
            if (team.leaderId && !targets.includes(team.leaderId.toString())) {
                targets.push(team.leaderId.toString());
            }
        } else {
            return res.status(400).json({ success: false, message: 'Please select workers or a team to assign.' });
        }

        // Deduplicate targets
        targets = Array.from(new Set(targets));

        // 3. Worker Role & Status & Schedule Conflict Checks
        const created = [];
        for (const workerIdStr of targets) {
            const worker = await User.findById(workerIdStr);
            if (!worker || worker.role !== 'WORKER' || worker.status !== 'ACTIVE') {
                return res.status(403).json({
                    success: false,
                    errorCode: 'WORKER_NOT_AUTHORIZED',
                    message: `Worker ${worker?.name || workerIdStr} is inactive or not available.`
                });
            }

            // Schedule Conflict Check: Check if worker has existing active assignment on same workingDate
            const existingAssignments = await WorkerAssignment.find({
                workerId: workerIdStr,
                status: { $in: ['ASSIGNED', 'WORKING', 'AVAILABLE'] }
            }).populate('jobId');

            for (const existing of existingAssignments) {
                if (existing.jobId && existing.jobId._id.toString() !== jobId.toString()) {
                    const exDateStr = existing.jobId.workingDate ? new Date(existing.jobId.workingDate).toISOString().slice(0, 10) : '';
                    const newDateStr = job.workingDate ? new Date(job.workingDate).toISOString().slice(0, 10) : '';
                    if (exDateStr && newDateStr && exDateStr === newDateStr) {
                        const exStart = existing.jobId.startTime || '00:00';
                        const exEnd = existing.jobId.endTime || '23:59';
                        const newStart = job.startTime || '00:00';
                        const newEnd = job.endTime || '23:59';

                        // Check time overlap
                        if (exStart < newEnd && exEnd > newStart) {
                            return res.status(400).json({
                                success: false,
                                errorCode: 'WORKER_NOT_AVAILABLE',
                                message: `Worker ${worker.name} is not available during the selected time due to a schedule conflict.`
                            });
                        }
                    }
                }
            }

            // Prevent duplicate assignment for same job
            const exists = await WorkerAssignment.exists({ jobId, workerId: workerIdStr });
            if (!exists) {
                const assign = await WorkerAssignment.create({
                    jobId,
                    workerId: workerIdStr,
                    companyId: req.user.userId,   // denormalised for direct ownership checks
                    assignedBy: req.user.userId,
                    status: 'ASSIGNED',
                    paymentStatus: 'PENDING'
                });
                created.push(assign);

                await new AuditLog({
                    actor: req.user.userId,
                    action: 'WORKER_ASSIGNED_TO_JOB',
                    resourceType: 'Job',
                    resourceId: jobId.toString()
                }).save();

                await Notification.create({
                    recipientId: workerIdStr,
                    type: 'WORKER_ACCEPTED',
                    category: 'BOOKING',
                    title: 'New Job Assignment',
                    messageSafe: `You have been directly assigned to job: ${job.title}`,
                    entityType: 'Job',
                    entityId: job._id,
                    dedupeKey: `job-assign-${job._id}-${workerIdStr}`
                });
            }
        }

        return res.status(200).json({ success: true, message: `Assigned ${created.length} workers successfully.`, assignments: created });
    } catch (error) {
        next(error);
    }
};

// GET all assignments for authenticated company — fully populated
export const getCompanyAssignments = async (req, res, next) => {
    try {
        // Support both companyId field (new) and assignedBy field (legacy)
        const assignments = await WorkerAssignment.find({
            $or: [
                { companyId: req.user.userId },
                { assignedBy: req.user.userId }
            ]
        })
            .populate('jobId', 'title category payRate paymentType workingDate startTime endTime location address description')
            .populate('workerId', 'name email phone status profileImage')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, assignments });
    } catch (error) {
        next(error);
    }
};

// GET single assignment by ID — company-scoped
export const getCompanyAssignmentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ASSIGNMENT_ID', message: 'Invalid assignment ID.' });
        }

        const assignment = await WorkerAssignment.findById(id)
            .populate('jobId', 'title category payRate paymentType workingDate startTime endTime location address description')
            .populate('workerId', 'name email phone status profileImage');

        if (!assignment) {
            return res.status(404).json({ success: false, errorCode: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found.' });
        }

        // Authorization: check companyId (new) or assignedBy (legacy) or job.companyId
        const ownerCompanyId = assignment.companyId?.toString() ||
            assignment.assignedBy?.toString() ||
            assignment.jobId?.companyId?.toString();

        if (ownerCompanyId !== req.user.userId) {
            return res.status(403).json({ success: false, errorCode: 'FORBIDDEN', message: 'Unauthorized access to this assignment.' });
        }

        return res.status(200).json({ success: true, assignment });
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
        if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid job ID.' });
        }
        if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid worker ID.' });
        }
        if (!date || !status) {
            return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
        }

        const job = await Job.findOne({ _id: jobId, companyId: req.user.userId });
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found.' });
        }

        // Verify worker is assigned to job
        const isAssigned = await WorkerAssignment.exists({ jobId, workerId });
        if (!isAssigned) {
            return res.status(403).json({ success: false, errorCode: 'WORKER_NOT_ASSIGNED', message: 'Worker is not assigned to this job.' });
        }

        const record = await Attendance.findOneAndUpdate(
            { jobId, workerId, date: new Date(date) },
            { startTime: startTime || '09:00', endTime: endTime || '18:00', status: status.toUpperCase(), hoursWorked: hoursWorked || 8 },
            { upsert: true, new: true }
        );

        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_ATTENDANCE_LOGGED',
            resourceType: 'Attendance',
            resourceId: record._id.toString()
        }).save();

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

        // 1. Validate ObjectId
        if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
            return res.status(400).json({
                success: false,
                errorCode: 'INVALID_ASSIGNMENT_ID',
                message: 'Invalid assignment ID.'
            });
        }

        // 2. Find the assignment
        const assign = await WorkerAssignment.findById(assignmentId).populate('jobId');
        if (!assign) {
            return res.status(404).json({
                success: false,
                errorCode: 'ASSIGNMENT_NOT_FOUND',
                message: 'Assignment not found.'
            });
        }

        // 3. Authorize — check companyId (new field) or assignedBy (legacy) or job owner
        const ownerCompanyId = assign.companyId?.toString() ||
            assign.assignedBy?.toString() ||
            assign.jobId?.companyId?.toString();

        if (ownerCompanyId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                errorCode: 'FORBIDDEN',
                message: 'You are not authorized to release payment for this assignment.'
            });
        }

        // 4. Prevent double-payment
        if (assign.paymentStatus === 'RELEASED' || assign.status === 'COMPLETED') {
            return res.status(409).json({
                success: false,
                errorCode: 'PAYMENT_ALREADY_RELEASED',
                message: 'Payment has already been released for this assignment.'
            });
        }

        // 5. Calculate amounts
        const totalPay = assign.jobId.payRate || 0;
        const totalPayPaise = totalPay;
        const commissionPaise = Math.round(totalPayPaise * 0.1); // 10% platform fee
        const workerEarningPaise = totalPayPaise - commissionPaise;

        // 6. Verify Company Wallet balance
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

        const currentTotalBalance = wallet.availableBalancePaise + wallet.escrowAmountPaise;
        if (currentTotalBalance < totalPayPaise) {
            return res.status(400).json({
                success: false,
                errorCode: 'INSUFFICIENT_FUNDS',
                message: 'Insufficient wallet balance. Please deposit funds first.'
            });
        }

        // 7. Debit company wallet
        if (wallet.escrowAmountPaise >= totalPayPaise) {
            wallet.escrowAmountPaise -= totalPayPaise;
        } else {
            const remainder = totalPayPaise - wallet.escrowAmountPaise;
            wallet.escrowAmountPaise = 0;
            wallet.availableBalancePaise = Math.max(0, wallet.availableBalancePaise - remainder);
        }
        wallet.totalSpentPaise += totalPayPaise;
        wallet.transactionHistory.push({
            amountPaise: totalPayPaise,
            type: 'DEBIT',
            description: `Payment released for job "${assign.jobId.title}" (assignment: ${assign._id})`
        });
        await wallet.save();

        // 8. Credit worker wallet
        let workerWallet = await mongoose.model('WorkerWallet').findOne({ workerId: assign.workerId });
        if (workerWallet) {
            workerWallet.availableBalancePaise += workerEarningPaise;
            workerWallet.totalEarnedPaise += workerEarningPaise;
            await workerWallet.save();
        }

        // 9. Create payment record
        await CompanyPayment.create({
            companyId: req.user.userId,
            jobId: assign.jobId._id,
            workerId: assign.workerId,
            amountPaise: totalPayPaise,
            platformCommissionPaise: commissionPaise,
            workerEarningPaise: workerEarningPaise,
            status: 'RELEASED'
        });

        // 10. Mark assignment complete
        assign.status = 'COMPLETED';
        assign.paymentStatus = 'RELEASED';
        await assign.save();

        // 11. Audit log
        await new AuditLog({
            actor: req.user.userId,
            action: 'COMPANY_PAYMENT_RELEASED',
            resourceType: 'WorkerAssignment',
            resourceId: assign._id.toString()
        }).save();

        // 12. Notify worker
        const payInRupees = (totalPayPaise / 100).toFixed(2);
        await Notification.create({
            recipientId: assign.workerId,
            type: 'PAYMENT_RECEIVED',
            category: 'PAYMENT',
            title: 'Payment Received',
            messageSafe: `Payment of ₹${payInRupees} for job "${assign.jobId.title}" has been released.`,
            entityType: 'WorkerAssignment',
            entityId: assign._id
        });

        return res.status(200).json({
            success: true,
            message: `Payment of ₹${payInRupees} released to worker successfully.`,
            assignmentId: assign._id
        });
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
            details: !!(profile.legalCompanyName || profile.registrationNumber || profile.gstNumber || profile.panNumber),
            businessRegistration: false,
            addressProof: false,
            authorizedPersonId: false,
            companyPan: false
        };

        if (checklist.profile) progress += 20;
        if (checklist.details) progress += 20;

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

        // Add 15% for each present/approved mandatory document
        const docs = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN'];
        docs.forEach(dtype => {
            const hasDoc = documents.find(d => d.documentType === dtype && (d.status === 'APPROVED' || d.status === 'PENDING'));
            if (hasDoc) progress += 15;
        });

        if (progress > 100) progress = 100;
        if (profile.verificationStatus === 'VERIFIED' || profile.verificationStatus === 'APPROVED') {
            progress = 100;
        }

        return res.status(200).json({
            success: true,
            verificationStatus: profile.verificationStatus,
            progress,
            checklist,
            profile,
            documents,
            completedSteps: profile.completedSteps || [],
            lastStep: profile.lastStep || 1,
            needsInfoReason: profile.needsInfoReason,
            rejectionReason: profile.rejectionReason,
            suspensionReason: profile.suspensionReason
        });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyVerificationProfile = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const {
            companyName,
            email,
            phone,
            authorizedPersonName,
            authorizedPersonPhone,
            companyType,
            businessType,
            website,
            address,
            city,
            state,
            pincode,
            country
        } = req.body;

        if (!companyName || !email || !phone || !authorizedPersonName || !authorizedPersonPhone || !address || !city || !state || !pincode) {
            return res.status(400).json({ success: false, message: 'Please fill in all required profile fields.' });
        }

        const profile = await CompanyProfile.findOne({ userId: companyId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        profile.companyName = companyName.trim();
        profile.email = email.trim().toLowerCase();
        profile.phone = phone.trim();
        profile.authorizedPersonName = authorizedPersonName.trim();
        profile.authorizedPersonPhone = authorizedPersonPhone.trim();
        if (companyType || businessType) profile.businessType = (companyType || businessType).trim();
        if (companyType) profile.companyType = companyType.trim();
        if (website !== undefined) profile.website = website ? website.trim() : '';
        profile.address = address.trim();
        profile.city = city.trim();
        profile.state = state.trim();
        profile.pincode = pincode.trim();
        if (country) profile.country = country.trim();

        if (!profile.completedSteps.includes('PROFILE')) {
            profile.completedSteps.push('PROFILE');
        }
        profile.lastStep = Math.max(profile.lastStep || 1, 2);

        await profile.save();

        return res.status(200).json({
            success: true,
            message: 'Company profile updated successfully.',
            profile
        });
    } catch (error) {
        next(error);
    }
};

export const updateCompanyVerificationDetails = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const {
            legalCompanyName,
            tradeName,
            companyType,
            registrationNumber,
            dateOfIncorporation,
            numberOfEmployees,
            industry,
            description,
            registeredAddress,
            operationalAddress,
            gstNumber,
            panNumber
        } = req.body;

        // Validation for GSTIN & PAN formats if provided
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;

        if (gstNumber && !gstRegex.test(gstNumber.trim())) {
            return res.status(400).json({ success: false, message: 'Invalid GSTIN format. Expected 15-character GSTIN (e.g. 22AAAAA0000A1Z5).' });
        }

        if (panNumber && !panRegex.test(panNumber.trim())) {
            return res.status(400).json({ success: false, message: 'Invalid PAN format. Expected 10-character PAN (e.g. ABCDE1234F).' });
        }

        const profile = await CompanyProfile.findOne({ userId: companyId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Company profile not found.' });
        }

        if (legalCompanyName) profile.legalCompanyName = legalCompanyName.trim();
        if (tradeName !== undefined) profile.tradeName = tradeName.trim();
        if (companyType) profile.companyType = companyType.trim();
        if (registrationNumber) profile.registrationNumber = registrationNumber.trim();
        if (dateOfIncorporation) profile.dateOfIncorporation = new Date(dateOfIncorporation);
        if (numberOfEmployees) profile.numberOfEmployees = numberOfEmployees.trim();
        if (industry) profile.industry = industry.trim();
        if (description) profile.description = description.trim();
        if (registeredAddress) profile.registeredAddress = registeredAddress.trim();
        if (operationalAddress) profile.operationalAddress = operationalAddress.trim();
        if (gstNumber) profile.gstNumber = gstNumber.trim().toUpperCase();
        if (panNumber) profile.panNumber = panNumber.trim().toUpperCase();

        if (!profile.completedSteps.includes('DETAILS')) {
            profile.completedSteps.push('DETAILS');
        }
        profile.lastStep = Math.max(profile.lastStep || 1, 3);

        await profile.save();

        return res.status(200).json({
            success: true,
            message: 'Business details updated successfully.',
            profile
        });
    } catch (error) {
        next(error);
    }
};

export const uploadCompanyDocument = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const { documentType } = req.body;

        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ success: false, message: 'No file uploaded or file buffer is empty.' });
        }

        const validTypes = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'GST_CERTIFICATE', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN', 'OTHER_SUPPORTING_DOCUMENT'];
        if (!documentType || !validTypes.includes(documentType)) {
            return res.status(400).json({ success: false, message: 'Valid documentType is required.' });
        }

        // Validate buffer, filename, extension, MIME type, magic bytes, size limit (10MB)
        try {
            validateFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, 10 * 1024 * 1024);
        } catch (valErr) {
            return res.status(400).json({
                success: false,
                errorCode: valErr.message || 'INVALID_FILE',
                message: `File validation failed: ${valErr.message}`
            });
        }

        const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
        const STORAGE_DIR = path.join(uploadRoot, 'verification');
        try {
            if (!fs.existsSync(STORAGE_DIR)) {
                fs.mkdirSync(STORAGE_DIR, { recursive: true });
            }
        } catch (err) {
            console.error('Warning: Failed creating company storage directory:', err.message);
        }

        const fileExt = path.extname(req.file.originalname).toLowerCase();
        const randomName = `${crypto.randomUUID()}${fileExt}`;
        const filePath = path.join(STORAGE_DIR, randomName);

        // Write file buffer to disk
        fs.writeFileSync(filePath, req.file.buffer);

        // Verify storage write succeeded
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            return res.status(500).json({
                success: false,
                errorCode: 'STORAGE_UPLOAD_FAILED',
                message: 'Failed to write physical document file to storage.'
            });
        }

        const fileSize = fs.statSync(filePath).size;

        // Upsert document in MongoDB only AFTER storage confirmation
        const document = await CompanyVerificationDocument.findOneAndUpdate(
            { companyId, documentType },
            {
                documentUrl: `/uploads/verification/${randomName}`,
                storageKey: randomName,
                fileName: req.file.originalname,
                fileSize,
                mimeType: req.file.mimetype,
                status: 'PENDING',
                rejectionReason: null
            },
            { upsert: true, new: true }
        );

        // Check if mandatory documents are uploaded
        const mandatoryDocs = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN'];
        const allDocs = await CompanyVerificationDocument.find({ companyId });
        const hasAllMandatory = mandatoryDocs.every(type => allDocs.some(d => d.documentType === type));

        const profile = await CompanyProfile.findOne({ userId: companyId });
        if (profile) {
            if (hasAllMandatory && !profile.completedSteps.includes('DOCUMENTS')) {
                profile.completedSteps.push('DOCUMENTS');
            }
            profile.lastStep = Math.max(profile.lastStep || 1, 3);
            await profile.save();
        }

        return res.status(200).json({ success: true, message: 'Document uploaded successfully.', document });
    } catch (error) {
        next(error);
    }
};

export const deleteCompanyDocument = async (req, res, next) => {
    try {
        const companyId = req.user.userId;
        const { id } = req.params; // document ID or documentType

        const query = { companyId };
        if (id.match(/^[0-9a-fA-F]{24}$/)) {
            query._id = id;
        } else {
            query.documentType = id;
        }

        const document = await CompanyVerificationDocument.findOne(query);
        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        // Try deleting file from disk
        if (document.storageKey) {
            const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
            const filePath = path.join(uploadRoot, 'verification', document.storageKey);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await CompanyVerificationDocument.deleteOne({ _id: document._id });

        return res.status(200).json({ success: true, message: 'Document removed successfully.' });
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

        // Validate completeness of documents
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
        profile.submittedAt = new Date();
        profile.submittedBy = companyId;
        if (!profile.completedSteps.includes('REVIEW')) profile.completedSteps.push('REVIEW');
        if (!profile.completedSteps.includes('VERIFICATION')) profile.completedSteps.push('VERIFICATION');
        profile.lastStep = 5;

        profile.reviewHistory.push({
            action: 'SUBMITTED',
            reason: 'KYC Verification application submitted by company.',
            actor: companyId,
            timestamp: new Date()
        });

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


