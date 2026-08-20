import mongoose from 'mongoose';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import WorkerAssignment from '../models/WorkerAssignment.js';
import Booking from '../models/Booking.js';
import BookingLocation from '../models/BookingLocation.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { getIO } from '../socketServer.js';
import { workerOnboardingSchema } from '../utils/validation.js';
import { encryptText, maskDocumentNumber } from '../utils/crypto.js';

export const submitOnboarding = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'WORKER' && user.role !== 'COMPANY')) {
        res.status(403).json({
            statusCode: 403,
            errorCode: 'FORBIDDEN',
            message: 'Only users registered as workers can access onboarding.',
        });
        return;
    }
    try {
        const validatedData = workerOnboardingSchema.parse(req.body);
        const {
            serviceCategoryIds,
            skills,
            experienceYears,
            bio,
            languages,
            hourlyRate,
            dailyRate,
            minimumBookingDuration,
            serviceRadiusKm,
            latitude,
            longitude,
            documents,
        } = validatedData;

        let profile = await WorkerProfile.findOne({ userId: user.userId });
        if (!profile) {
            profile = new WorkerProfile({
                userId: user.userId,
                verificationStatus: 'DRAFT',
            });
        }
        profile.serviceCategoryIds = serviceCategoryIds;
        profile.skills = skills;
        profile.experienceYears = experienceYears;
        profile.bio = bio;
        profile.languages = languages;
        profile.hourlyRate = hourlyRate;
        profile.dailyRate = dailyRate;
        profile.minimumBookingDuration = minimumBookingDuration;
        profile.serviceRadiusKm = serviceRadiusKm;
        profile.location = {
            type: 'Point',
            coordinates: [longitude, latitude],
        };
        profile.verificationStatus = 'PENDING_APPROVAL';
        await profile.save();

        await VerificationDocument.deleteMany({ workerId: user.userId });
        for (const doc of documents) {
            const encryptedNum = encryptText(doc.documentNumber);
            const maskedNum = maskDocumentNumber(doc.documentType, doc.documentNumber);
            const verificationDoc = new VerificationDocument({
                workerId: user.userId,
                documentType: doc.documentType,
                documentNumberEncrypted: encryptedNum,
                documentNumberMasked: maskedNum,
                frontFile: doc.frontFile,
                backFile: doc.backFile,
                fileMimeType: 'image/jpeg',
                fileSize: 1024 * 500,
                storageProvider: 'LOCAL',
                verificationStatus: 'PENDING',
            });
            await verificationDoc.save();
        }
        res.status(200).json({
            success: true,
            message: 'Onboarding documents submitted successfully. Account pending admin review.',
            verificationStatus: profile.verificationStatus,
        });
    } catch (error) {
        next(error);
    }
};

export const updateLocation = async (req, res, next) => {
    const user = req.user;
    if (!user || (user.role !== 'WORKER' && user.role !== 'COMPANY')) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    const { latitude, longitude, city, state, address } = req.body;
    if (latitude === undefined || longitude === undefined) {
        res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        return;
    }
    try {
        const latNum = Number(latitude);
        const lngNum = Number(longitude);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
            res.status(400).json({ success: false, message: 'Invalid latitude or longitude coordinates.' });
            return;
        }

        let profile = await WorkerProfile.findOne({ userId: user.userId });
        if (!profile) {
            profile = new WorkerProfile({
                userId: user.userId,
                verificationStatus: 'NOT_SUBMITTED',
            });
        }
        profile.location = {
            type: 'Point',
            coordinates: [lngNum, latNum],
        };
        if (city) profile.city = city;
        if (state) profile.state = state;
        if (address) profile.address = address;
        await profile.save();

        console.log(`[WORKER_LOCATION_UPDATED] workerId=${user.userId} lat=${latNum} lng=${lngNum} city=${city || profile.city}`);

        // Automatically sync latest location to active bookings
        try {
            const activeStatuses = ['CONFIRMED', 'PAID', 'ACCEPTED', 'WORKER_EN_ROUTE', 'ARRIVED', 'STARTED', 'COMPLETION_REQUESTED'];
            const activeBookings = await Booking.find({
                workerId: user.userId,
                bookingStatus: { $in: activeStatuses },
            });

            if (activeBookings.length > 0) {
                const io = getIO();
                for (const b of activeBookings) {
                    const ping = await BookingLocation.create({
                        bookingId: b._id,
                        workerId: user.userId,
                        latitude: latNum,
                        longitude: lngNum,
                        heading: 0,
                        speed: 0,
                        accuracy: 5,
                        timestamp: new Date(),
                    });

                    if (io) {
                        const payload = {
                            bookingId: b._id.toString(),
                            workerId: user.userId.toString(),
                            latitude: latNum,
                            longitude: lngNum,
                            heading: 0,
                            speed: 0,
                            accuracy: 5,
                            timestamp: ping.timestamp,
                        };
                        io.to(`tracking:${b._id.toString()}`).emit('location:updated', payload);
                        io.to(`conversation:${b._id.toString()}`).emit('location:updated', payload);
                    }
                }
            }
        } catch (activeBookingErr) {
            console.warn('[WORKER_ACTIVE_BOOKING_LOCATION_SYNC_FAIL]', activeBookingErr?.message);
        }

        res.status(200).json({
            success: true,
            message: 'Location updated successfully.',
            location: {
                latitude: latNum,
                longitude: lngNum,
                city: profile.city || null,
                state: profile.state || null
            }
        });
    } catch (error) {
        next(error);
    }
};

export const searchWorkers = async (req, res, next) => {
    try {
        const {
            categoryId,
            skill,
            latitude,
            longitude,
            maxDistanceKm,
            maxPrice,
            minRating,
            page = 1,
            limit = 10,
        } = req.query;

        const skipCount = (Number(page) - 1) * Number(limit);

        const query = {
            verificationStatus: 'APPROVED',
            isPubliclyVisible: true,
        };

        if (categoryId) {
            query.serviceCategoryIds = categoryId;
        }

        if (skill) {
            query.skills = { $in: [new RegExp(String(skill), 'i')] };
        }

        if (maxPrice) {
            query.hourlyRate = { $lte: Number(maxPrice) };
        }

        if (minRating) {
            query.averageRating = { $gte: Number(minRating) };
        }

        const queryLat = latitude !== undefined ? latitude : req.query.lat;
        const queryLng = longitude !== undefined ? longitude : req.query.lng;

        if (queryLat !== undefined && queryLng !== undefined && !isNaN(Number(queryLat)) && !isNaN(Number(queryLng))) {
            const radiusKm = Number(maxDistanceKm) || 100;
            const radiusRadians = radiusKm / 6378.1;
            query.$or = [
                {
                    location: {
                        $geoWithin: {
                            $centerSphere: [[Number(queryLng), Number(queryLat)], radiusRadians],
                        },
                    },
                },
                { location: { $exists: false } },
                { location: null },
                { 'location.coordinates': { $size: 0 } },
            ];
        }

        const profiles = await WorkerProfile.find(query)
            .populate({
                path: 'userId',
                select: 'name profileImage emailVerified phoneVerified',
            })
            .skip(skipCount)
            .limit(Number(limit));

        const totalCount = await WorkerProfile.countDocuments(query);

        const dtos = profiles.map((p) => ({
            workerId: p.userId?._id,
            name: p.userId?.name,
            profileImage: p.userId?.profileImage || p.profilePhotoId,
            serviceCategoryIds: p.serviceCategoryIds,
            skills: p.skills,
            experienceYears: p.yearsOfExperience,
            bio: p.bio,
            languages: p.languages,
            hourlyRate: p.hourlyRate,
            dailyRate: p.dailyRate,
            averageRating: p.averageRating,
            ratingCount: p.ratingCount,
            verificationBadge: p.verificationBadge,
            isOnline: p.isOnline,
            location: p.location,
        }));

        res.status(200).json({
            success: true,
            data: dtos,
            pagination: {
                total: totalCount,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        });
    } catch (error) {
        console.error('searchWorkers Error:', error);
        next(error);
    }
};

export const getWorkerProfile = async (req, res, next) => {
    const { id } = req.params;
    try {
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: 'Invalid worker ID parameter.' });
            return;
        }

        const objectId = new mongoose.Types.ObjectId(id);

        let profile = await WorkerProfile.findOne({
            $or: [{ userId: objectId }, { _id: objectId }]
        }).populate({
            path: 'userId',
            select: 'name profileImage emailVerified phoneVerified',
        });

        if (!profile) {
            const targetUser = await User.findById(objectId);
            if (targetUser && (targetUser.role === 'WORKER' || targetUser.role === 'COMPANY')) {
                profile = new WorkerProfile({
                    userId: targetUser._id,
                    verificationStatus: 'NOT_SUBMITTED',
                    isPubliclyVisible: false,
                    verificationBadge: false,
                });
                await profile.save();
                profile = await WorkerProfile.findById(profile._id).populate({
                    path: 'userId',
                    select: 'name profileImage emailVerified phoneVerified',
                });
            } else {
                res.status(404).json({ success: false, message: 'Worker profile not found.' });
                return;
            }
        }
        const safeProfile = {
            workerId: profile.userId?._id || profile.userId,
            name: profile.userId?.name || 'Worker',
            profileImage: profile.userId?.profileImage || profile.profilePhotoId,
            serviceCategoryIds: profile.serviceCategoryIds,
            skills: profile.skills,
            experienceYears: profile.yearsOfExperience,
            bio: profile.bio,
            languages: profile.languages,
            hourlyRate: profile.hourlyRate,
            dailyRate: profile.dailyRate,
            averageRating: profile.averageRating,
            ratingCount: profile.ratingCount,
            verificationBadge: profile.verificationBadge || false,
            verificationStatus: profile.verificationStatus,
            kycStatus: profile.verificationStatus,
            isKycVerified: profile.verificationStatus === 'APPROVED',
            isOnline: profile.isOnline,
            location: profile.location,
        };
        res.status(200).json({ success: true, data: safeProfile });
    } catch (error) {
        next(error);
    }
};

export const getWorkerAvailableJobs = async (req, res, next) => {
    try {
        const { search, category } = req.query;
        let query = { status: 'ACTIVE' };

        if (category) {
            query.category = new RegExp(category, 'i');
        }

        if (search) {
            query.title = new RegExp(search, 'i');
        }

        const jobs = await Job.find(query)
            .populate('companyId', 'name profileImage')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, jobs });
    } catch (error) {
        next(error);
    }
};

export const applyForJob = async (req, res, next) => {
    try {
        const { id } = req.params; // jobId
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, errorCode: 'INVALID_ID', message: 'Invalid job ID.' });
        }

        // Verify active worker status
        const currentUser = await User.findById(req.user.userId);
        if (!currentUser || currentUser.role !== 'WORKER' || currentUser.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                errorCode: 'WORKER_NOT_ACTIVE',
                message: 'Only active workers with approved profiles can apply for jobs.'
            });
        }

        const job = await Job.findById(id);
        if (!job || job.status !== 'ACTIVE') {
            return res.status(404).json({ success: false, message: 'Job is not open for applications.' });
        }

        // Prevent duplicate application
        const existingApp = await JobApplication.findOne({ jobId: id, workerId: req.user.userId });
        if (existingApp) {
            return res.status(409).json({
                success: false,
                errorCode: 'DUPLICATE_APPLICATION',
                message: 'You have already applied for this job.'
            });
        }

        const application = await JobApplication.create({
            jobId: id,
            workerId: req.user.userId,
            status: 'PENDING'
        });

        await new AuditLog({
            actor: req.user.userId,
            action: 'WORKER_JOB_APPLICATION_SUBMITTED',
            resourceType: 'JobApplication',
            resourceId: application._id.toString()
        }).save();

        await new Notification({
            recipientId: job.companyId,
            title: 'New Job Application Received',
            message: `${currentUser.name} applied for "${job.title}".`,
            type: 'INFO'
        }).save();

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully.',
            application
        });
    } catch (error) {
        next(error);
    }
};

export const getWorkerApplications = async (req, res, next) => {
    try {
        const applications = await JobApplication.find({ workerId: req.user.userId })
            .populate({
                path: 'jobId',
                populate: { path: 'companyId', select: 'name profileImage' }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, applications });
    } catch (error) {
        next(error);
    }
};

export const getWorkerAssignments = async (req, res, next) => {
    try {
        const assignments = await WorkerAssignment.find({ workerId: req.user.userId })
            .populate({
                path: 'jobId',
                populate: { path: 'companyId', select: 'name profileImage' }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, assignments });
    } catch (error) {
        next(error);
    }
};
