import mongoose from 'mongoose';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import User from '../models/User.js';
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
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
        res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
        return;
    }
    try {
        let profile = await WorkerProfile.findOne({ userId: user.userId });
        if (!profile) {
            profile = new WorkerProfile({
                userId: user.userId,
                verificationStatus: 'DRAFT',
            });
        }
        profile.location = {
            type: 'Point',
            coordinates: [Number(longitude), Number(latitude)],
        };
        await profile.save();
        res.status(200).json({ success: true, message: 'Location updated successfully.' });
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

        if (latitude !== undefined && longitude !== undefined) {
            const radiusKm = Number(maxDistanceKm) || 10;
            const radiusRadians = radiusKm / 6378.1;
            query.location = {
                $geoWithin: {
                    $centerSphere: [[Number(longitude), Number(latitude)], radiusRadians],
                },
            };
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
            profileImage: p.userId?.profileImage,
            serviceCategoryIds: p.serviceCategoryIds,
            skills: p.skills,
            experienceYears: p.experienceYears,
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
                    verificationStatus: 'DRAFT',
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
            profileImage: profile.userId?.profileImage,
            serviceCategoryIds: profile.serviceCategoryIds,
            skills: profile.skills,
            experienceYears: profile.experienceYears,
            bio: profile.bio,
            languages: profile.languages,
            hourlyRate: profile.hourlyRate,
            dailyRate: profile.dailyRate,
            averageRating: profile.averageRating,
            ratingCount: profile.ratingCount,
            verificationBadge: profile.verificationBadge,
            verificationStatus: profile.verificationStatus,
            isOnline: profile.isOnline,
            location: profile.location,
        };
        res.status(200).json({ success: true, data: safeProfile });
    } catch (error) {
        next(error);
    }
};
