import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import WorkerProfile from '../models/WorkerProfile.js';
import VerificationDocument from '../models/VerificationDocument.js';
import VerificationSubmission from '../models/VerificationSubmission.js';
import VerificationReviewEvent from '../models/VerificationReviewEvent.js';
import User from '../models/User.js';
import ServiceCategory from '../models/ServiceCategory.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { validateFileBuffer } from '../utils/fileValidator.js';
import { encryptText, maskDocumentNumber } from '../utils/crypto.js';

// Setup private storage directory
const STORAGE_DIR = path.resolve('uploads/verification');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Age calculator helper
const calculateAge = (dob) => {
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
        age--;
    }
    return age;
};

// Dynamic conditional document requirements based on category slug
const getRequiredDocsForCategory = async (categoryId) => {
    const docs = ['AADHAAR', 'PAN', 'ADDRESS_PROOF'];
    if (!categoryId) return docs;
    
    const category = await ServiceCategory.findById(categoryId);
    if (!category) return docs;

    const slug = category.slug || category.name.toLowerCase();
    if (slug.includes('driver')) {
        docs.push('DRIVING_LICENSE');
    } else if (
        slug.includes('care') || 
        slug.includes('health') || 
        slug.includes('nurse') || 
        slug.includes('senior') || 
        slug.includes('patient')
    ) {
        docs.push('EXPERIENCE_CERTIFICATE');
    } else if (slug.includes('sit') || slug.includes('baby')) {
        docs.push('POLICE_VERIFICATION');
    }
    return docs;
};

// Compute profile progress percentage
const calculateProgress = (profile, docsCount, requiredDocsCount) => {
    let fields = 0;
    let filled = 0;

    // Personal details fields
    const personalFields = ['fullName', 'dateOfBirth', 'phone', 'address', 'city', 'state', 'postalCode', 'profilePhotoId'];
    personalFields.forEach(f => {
        fields++;
        if (profile[f]) filled++;
    });

    // Professional details fields
    const professionalFields = ['bio', 'yearsOfExperience', 'primaryServiceCategoryId', 'hourlyRate', 'dailyRate', 'serviceRadiusKm'];
    professionalFields.forEach(f => {
        fields++;
        if (profile[f] !== undefined && profile[f] !== null && profile[f] !== '') filled++;
    });

    // Document checklist
    fields += requiredDocsCount;
    filled += docsCount;

    return Math.round((filled / fields) * 100);
};

export const getVerificationStatus = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            profile = new WorkerProfile({ userId: workerId, verificationStatus: 'INCOMPLETE_PROFILE' });
            await profile.save();
        }

        const requiredDocs = await getRequiredDocsForCategory(profile.primaryServiceCategoryId);
        const docs = await VerificationDocument.find({ workerId, isCurrent: true });
        const historyCounts = await VerificationDocument.aggregate([
            { $match: { workerId: new mongoose.Types.ObjectId(workerId), isCurrent: false } },
            { $group: { _id: '$documentType', count: { $sum: 1 } } }
        ]);
        const historyByType = new Map(historyCounts.map(item => [item._id, item.count]));

        // Count approved/active required docs
        const currentUploadedTypes = docs.map(d => d.documentType);
        const missingDocs = requiredDocs.filter(type => !currentUploadedTypes.includes(type));

        const progressPercent = calculateProgress(profile, docs.length, requiredDocs.length);
        profile.onboardingProgressPercent = progressPercent;
        await profile.save();

        const submissions = await VerificationSubmission.find({ workerId }).sort({ version: -1 });

        // Safe DTO summary of documents
        const safeDocs = docs.map(d => ({
            id: d._id,
            documentType: d.documentType,
            documentNumberLast4: d.documentNumberLast4,
            verificationStatus: d.verificationStatus,
            reviewReasonCode: d.reviewReasonCode,
            reviewComment: d.reviewComment,
            uploadedAt: d.uploadedAt,
            scanStatus: d.scanStatus,
            expiryDate: d.expiryDate
            ,version: d.version || 1
            ,historicalVersionCount: historyByType.get(d.documentType) || 0
        }));

        res.status(200).json({
            success: true,
            data: {
                profile: {
                    fullName: profile.fullName,
                    dateOfBirth: profile.dateOfBirth,
                    phone: profile.phone,
                    alternatePhone: profile.alternatePhone,
                    address: profile.address,
                    city: profile.city,
                    state: profile.state,
                    postalCode: profile.postalCode,
                    country: profile.country,
                    profilePhotoId: profile.profilePhotoId,
                    bio: profile.bio,
                    yearsOfExperience: profile.yearsOfExperience,
                    primaryServiceCategoryId: profile.primaryServiceCategoryId,
                    serviceCategoryIds: profile.serviceCategoryIds,
                    skills: profile.skills,
                    languages: profile.languages,
                    hourlyRate: profile.hourlyRate,
                    dailyRate: profile.dailyRate,
                    serviceRadiusKm: profile.serviceRadiusKm,
                    verificationStatus: profile.verificationStatus,
                    onboardingProgressPercent: profile.onboardingProgressPercent,
                    rejectionReason: profile.rejectionReason,
                    suspensionReason: profile.suspensionReason
                },
                requiredFields: [
                    'fullName', 'dateOfBirth', 'phone', 'address', 'city', 'state', 
                    'postalCode', 'profilePhotoId', 'bio', 'yearsOfExperience', 
                    'primaryServiceCategoryId', 'hourlyRate', 'dailyRate', 'serviceRadiusKm'
                ],
                requiredDocumentTypes: requiredDocs,
                missingDocumentTypes: missingDocs,
                uploadedDocuments: safeDocs,
                submissionHistory: submissions.map(s => ({
                    submissionId: s._id,
                    version: s.version,
                    status: s.status,
                    submittedAt: s.submittedAt,
                    finalReasonCode: s.finalReasonCode,
                    finalComment: s.finalComment
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

export const saveProfileDraft = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        const { fullName, dateOfBirth, gender, phone, alternatePhone, address, city, state, postalCode, country, profilePhotoId } = req.body;

        if (dateOfBirth && calculateAge(dateOfBirth) < 18) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'AGE_REQUIREMENT_NOT_MET',
                message: 'Worker must be at least 18 years old.'
            });
        }

        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            profile = new WorkerProfile({ userId: workerId });
        }

        if (profile.verificationStatus === 'PENDING_APPROVAL') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VERIFICATION_ALREADY_SUBMITTED',
                message: 'Profile is locked for review. Cannot modify draft.'
            });
        }

        profile.fullName = fullName;
        profile.dateOfBirth = dateOfBirth;
        profile.gender = gender;
        profile.phone = phone;
        profile.alternatePhone = alternatePhone;
        profile.address = address;
        profile.city = city;
        profile.state = state;
        profile.postalCode = postalCode;
        if (country) profile.country = country;
        if (profilePhotoId) profile.profilePhotoId = profilePhotoId;

        if (profile.verificationStatus === 'INCOMPLETE_PROFILE') {
            profile.verificationStatus = 'DRAFT';
        }

        await profile.save();

        res.status(200).json({ success: true, message: 'Profile draft saved successfully.', data: profile });
    } catch (error) {
        next(error);
    }
};

export const saveProfessionalDetailsDraft = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        const { primaryServiceCategoryId, serviceCategoryIds, skills, languages, hourlyRate, dailyRate, serviceRadiusKm, bio, yearsOfExperience } = req.body;

        if (primaryServiceCategoryId) {
            const cat = await ServiceCategory.findById(primaryServiceCategoryId);
            if (!cat) {
                return res.status(400).json({
                    statusCode: 400,
                    errorCode: 'SERVICE_NOT_ALLOWED',
                    message: 'Selected service category is invalid or inactive.'
                });
            }
        }

        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            profile = new WorkerProfile({ userId: workerId });
        }

        if (profile.verificationStatus === 'PENDING_APPROVAL') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VERIFICATION_ALREADY_SUBMITTED',
                message: 'Profile is locked for review. Cannot modify draft.'
            });
        }

        if (primaryServiceCategoryId) profile.primaryServiceCategoryId = primaryServiceCategoryId;
        if (serviceCategoryIds) profile.serviceCategoryIds = serviceCategoryIds;
        if (skills) profile.skills = skills;
        if (languages) profile.languages = languages;
        if (hourlyRate !== undefined) profile.hourlyRate = hourlyRate;
        if (dailyRate !== undefined) profile.dailyRate = dailyRate;
        if (serviceRadiusKm !== undefined) {
            profile.serviceRadiusKm = serviceRadiusKm;
            profile.workRadiusKm = serviceRadiusKm;
        }
        if (bio) profile.bio = bio;
        if (yearsOfExperience !== undefined) profile.yearsOfExperience = yearsOfExperience;

        if (profile.verificationStatus === 'INCOMPLETE_PROFILE') {
            profile.verificationStatus = 'DRAFT';
        }

        await profile.save();

        res.status(200).json({ success: true, message: 'Professional details draft saved successfully.', data: profile });
    } catch (error) {
        next(error);
    }
};

export const uploadDocument = async (req, res, next) => {
    let createdFilePath;
    let session;
    try {
        const workerId = req.user.userId;
        const canonicalType = req.body.documentType === 'DRIVING_LICENCE' ? 'DRIVING_LICENSE' : req.body.documentType;
        const { documentNumber, expiryDate, issuingAuthority } = req.body;
        const operationId = String(req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body.clientOperationId || '').trim() || undefined;
        const replacementId = req.params.documentId;

        if (!req.file) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_REQUIRED',
                message: 'No file uploaded.'
            });
        }

        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (profile && profile.verificationStatus === 'PENDING_APPROVAL') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VERIFICATION_ALREADY_SUBMITTED',
                message: 'Upload locked. Verification is currently under review.'
            });
        }

        // Validate File Buffer
        try {
            validateFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
        } catch (fErr) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: fErr.message,
                message: 'File security or type check failed.'
            });
        }

        if (!documentNumber || !canonicalType) {
            return res.status(400).json({ statusCode: 400, errorCode: 'DOCUMENT_METADATA_REQUIRED', message: 'Document type and identifier are required.' });
        }

        const operationHash = crypto.createHash('sha256')
            .update(req.file.buffer)
            .update(JSON.stringify({ documentType: canonicalType, documentNumber: String(documentNumber), expiryDate: expiryDate || '', issuingAuthority: issuingAuthority || '', replacementId: replacementId || '' }))
            .digest('hex');
        if (operationId) {
            const prior = await VerificationDocument.findOne({ workerId, operationId });
            if (prior) {
                if (prior.operationHash !== operationHash) {
                    return res.status(409).json({ statusCode: 409, errorCode: 'IDEMPOTENCY_CONFLICT', message: 'This operation key was already used with different content.' });
                }
                return res.status(200).json({ success: true, idempotent: true, message: 'Document operation already completed.', document: { id: prior._id, documentType: prior.documentType, documentNumberLast4: prior.documentNumberLast4, verificationStatus: prior.verificationStatus, version: prior.version || 1 } });
            }
        }

        if (!replacementId) {
            const existing = await VerificationDocument.findOne({ workerId, documentType: canonicalType, isCurrent: true }).select('_id');
            if (existing) {
                return res.status(409).json({ statusCode: 409, errorCode: 'DOCUMENT_ALREADY_EXISTS', message: 'A current document of this type already exists.', existingDocumentId: existing._id, allowedAction: 'REPLACE' });
            }
        }

        // Create randomized private file before the transaction; remove it on any failure.
        const fileExt = path.extname(req.file.originalname);
        const randomName = `${crypto.randomUUID()}${fileExt}`;
        const filePath = path.join(STORAGE_DIR, randomName);
        fs.writeFileSync(filePath, req.file.buffer);
        createdFilePath = filePath;

        // Sensitive-data handling
        const docNumStr = String(documentNumber).trim();
        const encryptedNum = encryptText(docNumStr);
        const last4 = docNumStr.slice(-4);
        const hash = crypto.createHash('sha256').update(docNumStr).digest('hex');

        let doc;
        const persistDocument = async (activeSession = null) => {
            let oldDoc = null;
            if (replacementId) {
                const oldQuery = VerificationDocument.findById(replacementId);
                oldDoc = activeSession ? await oldQuery.session(activeSession) : await oldQuery;
                if (!oldDoc) throw Object.assign(new Error('Document not found.'), { statusCode: 404, errorCode: 'DOCUMENT_NOT_FOUND' });
                if (oldDoc.workerId.toString() !== workerId) throw Object.assign(new Error('Unauthorized document replacement.'), { statusCode: 403, errorCode: 'DOCUMENT_NOT_OWNED' });
                if (!oldDoc.isCurrent) throw Object.assign(new Error('Only the current document can be replaced.'), { statusCode: 409, errorCode: 'DOCUMENT_NOT_CURRENT' });
                if (oldDoc.documentType !== canonicalType) throw Object.assign(new Error('Replacement document type must match.'), { statusCode: 409, errorCode: 'DOCUMENT_TYPE_MISMATCH' });
                const updateOptions = activeSession ? { session: activeSession } : {};
                const claimed = await VerificationDocument.updateOne(
                    { _id: oldDoc._id, workerId, isCurrent: true },
                    { $set: { isCurrent: false, 'metadata.replacedAt': new Date() } },
                    updateOptions
                );
                if (claimed.modifiedCount !== 1) throw Object.assign(new Error('Only the current document can be replaced.'), { statusCode: 409, errorCode: 'DOCUMENT_NOT_CURRENT' });
            }

            const newDocument = new VerificationDocument({
                workerId, documentType: canonicalType, documentNumberEncrypted: encryptedNum,
                documentNumberLast4: last4, documentNumberHash: hash, frontFile: 'PRIVATE', frontFileId: randomName,
                fileMimeType: req.file.mimetype, fileSize: req.file.size, verificationStatus: 'UPLOADED', expiryDate,
                issuingAuthority, isCurrent: true, scanStatus: 'SCANNER_NOT_CONFIGURED', replacedDocumentId: oldDoc?._id,
                version: oldDoc ? (oldDoc.version || 1) + 1 : 1, operationId, operationHash
            });
            try {
                doc = await newDocument.save(activeSession ? { session: activeSession } : {});
            } catch (insertError) {
                // Standalone MongoDB has no transaction rollback. Restore the claimed original safely.
                if (!activeSession && oldDoc) {
                    await VerificationDocument.updateOne(
                        { _id: oldDoc._id, workerId, isCurrent: false },
                        { $set: { isCurrent: true }, $unset: { 'metadata.replacedAt': 1 } }
                    );
                }
                throw insertError;
            }

            if (profile && profile.verificationStatus === 'INCOMPLETE_PROFILE') {
                await WorkerProfile.updateOne(
                    { _id: profile._id },
                    { $set: { verificationStatus: 'DRAFT' } },
                    activeSession ? { session: activeSession } : {}
                );
            }
        };

        session = await mongoose.startSession();
        try {
            await session.withTransaction(() => persistDocument(session));
        } catch (transactionError) {
            const transactionUnsupported = transactionError?.code === 20
                || /Transaction numbers are only allowed on a replica set member or mongos/i.test(transactionError?.message || '');
            if (!transactionUnsupported || process.env.NODE_ENV === 'production') throw transactionError;
            await session.endSession();
            session = undefined;
            await persistDocument();
        }
        createdFilePath = undefined;

        // Create Audit Log
        await new AuditLog({
            actor: workerId,
            action: 'WORKER_DOCUMENT_UPLOAD',
            resourceType: 'VerificationDocument',
            resourceId: doc._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(201).json({
            success: true,
            message: 'Document uploaded successfully.',
            document: {
                id: doc._id,
                documentType: doc.documentType,
                documentNumberLast4: doc.documentNumberLast4,
                verificationStatus: doc.verificationStatus
                ,version: doc.version
            }
        });
    } catch (error) {
        if (createdFilePath && fs.existsSync(createdFilePath)) fs.unlinkSync(createdFilePath);
        if (error?.code === 11000) {
            const errorMsg = error.message || '';
            const keyPattern = error.keyPattern || {};
            if (errorMsg.includes('unique_worker_document_operation') || keyPattern.operationId) {
                return res.status(409).json({
                    statusCode: 409,
                    errorCode: 'IDEMPOTENCY_CONFLICT',
                    message: 'This operation key was already used or is processing.'
                });
            }
            const canonicalType = req.body.documentType === 'DRIVING_LICENCE' ? 'DRIVING_LICENSE' : req.body.documentType;
            const existing = await VerificationDocument.findOne({ workerId: req.user.userId, documentType: canonicalType, isCurrent: true }).select('_id');
            if (req.params.documentId) {
                return res.status(409).json({
                    statusCode: 409,
                    errorCode: 'CONCURRENT_REPLACEMENT',
                    message: 'The document was replaced by another request.',
                    existingDocumentId: existing?._id,
                    allowedAction: 'REFRESH'
                });
            } else {
                return res.status(409).json({
                    statusCode: 409,
                    errorCode: 'DOCUMENT_ALREADY_EXISTS',
                    message: 'A current document of this type already exists.',
                    existingDocumentId: existing?._id,
                    allowedAction: 'REPLACE'
                });
            }
        }
        if (error?.statusCode) return res.status(error.statusCode).json({ statusCode: error.statusCode, errorCode: error.errorCode, message: error.message });
        next(error);
    } finally {
        if (session) await session.endSession();
    }
};

export const softDeleteDocument = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        const { documentId } = req.params;

        const doc = await VerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        if (doc.workerId.toString() !== workerId) {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'DOCUMENT_NOT_OWNED',
                message: 'Unauthorized document access.'
            });
        }

        const profile = await WorkerProfile.findOne({ userId: workerId });
        if (profile && !['DRAFT', 'INCOMPLETE_PROFILE', 'CHANGES_REQUIRED'].includes(profile.verificationStatus)) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_REVIEW_LOCKED',
                message: 'Cannot delete document while review is pending or complete.'
            });
        }

        // Soft delete: mark isCurrent false
        doc.isCurrent = false;
        await doc.save();

        await new AuditLog({
            actor: workerId,
            action: 'WORKER_DOCUMENT_SOFT_DELETE',
            resourceType: 'VerificationDocument',
            resourceId: documentId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        res.status(200).json({ success: true, message: 'Document soft-deleted successfully.' });
    } catch (error) {
        next(error);
    }
};

export const submitVerification = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        const { declarationAccepted, consentAccepted } = req.body;

        if (!declarationAccepted || !consentAccepted) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DECLARATION_REQUIRED',
                message: 'Declaration and consent acceptance is required.'
            });
        }

        const profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile details not found.' });
        }

        if (profile.verificationStatus === 'PENDING_APPROVAL') {
            const existing=await VerificationSubmission.findById(profile.latestSubmissionId);
            return res.status(200).json({success:true,idempotent:true,message:'Verification has already been submitted.',data:{submissionId:existing?._id,status:'PENDING_APPROVAL'}});
        }

        // 1. Validate required profile fields
        const requiredFields = ['fullName', 'dateOfBirth', 'phone', 'address', 'city', 'state', 'postalCode', 'profilePhotoId', 'bio', 'primaryServiceCategoryId', 'hourlyRate'];
        const missingField = requiredFields.find(f => !profile[f]);
        if (missingField) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'PROFILE_INCOMPLETE',
                message: `Required profile field '${missingField}' is missing.`
            });
        }

        // 2. Validate required documents
        const requiredDocs = await getRequiredDocsForCategory(profile.primaryServiceCategoryId);
        const docs = await VerificationDocument.find({ workerId, isCurrent: true });
        const currentDocTypes = docs.map(d => d.documentType);

        const missingDoc = requiredDocs.find(type => !currentDocTypes.includes(type));
        if (missingDoc) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_REQUIRED',
                message: `Required document verification for '${missingDoc}' is missing.`
            });
        }

        // Expiry checks
        const expiredDoc = docs.find(d => d.expiryDate && new Date(d.expiryDate) < new Date());
        if (expiredDoc) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'DOCUMENT_EXPIRED',
                message: `Your document '${expiredDoc.documentType}' has expired.`
            });
        }

        // Max version/submission count
        const prevSubmissions = await VerificationSubmission.find({ workerId });
        const submissionNumber = prevSubmissions.length + 1;
        const version = submissionNumber;

        // Take snapshot
        const submission = new VerificationSubmission({
            workerId,
            submissionNumber,
            version,
            profileSnapshot: profile.toJSON(),
            serviceSnapshot: {
                skills: profile.skills,
                languages: profile.languages,
                hourlyRate: profile.hourlyRate,
                dailyRate: profile.dailyRate
            },
            documentIds: docs.map(d => d._id),
            declarationAccepted,
            consentAccepted,
            status: 'PENDING_APPROVAL'
        });

        await submission.save();

        // Update profile verificationStatus
        profile.verificationStatus = 'PENDING_APPROVAL';
        profile.latestSubmissionId = submission._id;
        profile.submittedAt = new Date();
        profile.isPubliclyVisible = false; // Block visibility until approved
        await profile.save();

        // Lock all current docs to pending review
        await VerificationDocument.updateMany(
            { workerId, isCurrent: true },
            { verificationStatus: 'PENDING_REVIEW' }
        );

        // Audit Log
        await new AuditLog({
            actor: workerId,
            action: 'WORKER_VERIFICATION_SUBMIT',
            resourceType: 'VerificationSubmission',
            resourceId: submission._id.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.requestId
        }).save();

        // Worker Notification
        await new Notification({
            recipientId: workerId,
            title: 'Verification Submission Received',
            message: 'Your verification submission is now pending admin review.',
            type: 'INFO'
        }).save();

        // Admin Notification
        const adminUsers = await User.find({ role: 'ADMIN' });
        for (const admin of adminUsers) {
            await new Notification({
                recipientId: admin._id,
                title: 'New Verification Request',
                message: `Worker ${profile.fullName} has submitted KYC documents for approval.`,
                type: 'WARNING'
            }).save();
        }

        res.status(200).json({
            success: true,
            message: 'Verification submitted successfully.',
            data: { submissionId: submission._id, status: profile.verificationStatus }
        });
    } catch (error) {
        next(error);
    }
};

export const resubmitVerification = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        const profile = await WorkerProfile.findOne({ userId: workerId });
        
        if (!profile || !['CHANGES_REQUIRED', 'REJECTED'].includes(profile.verificationStatus)) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VERIFICATION_CHANGES_NOT_ALLOWED',
                message: 'Resubmission is only allowed when changes are requested or profile is rejected.'
            });
        }

        req.body.declarationAccepted = true;
        req.body.consentAccepted = true;
        return submitVerification(req, res, next);
    } catch (error) {
        next(error);
    }
};

export const getDocumentAccess = async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const doc = await VerificationDocument.findById(documentId);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found.' });
        }

        // Authorization checks: Owner OR Admin with review permission
        const isOwner = doc.workerId.toString() === req.user.userId;
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                statusCode: 403,
                errorCode: 'UNAUTHORIZED',
                message: 'Access denied. You do not have permission to view this document.'
            });
        }

        if (!doc.frontFileId || path.basename(doc.frontFileId) !== doc.frontFileId) {
            return res.status(404).json({ success: false, message: 'Document file reference is invalid.' });
        }
        const filePath = path.join(STORAGE_DIR, doc.frontFileId);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Document file not found on disk.' });
        }

        // Log document view audit for Admins
        if (isAdmin) {
            await new AuditLog({
                actor: req.user.userId,
                action: 'ADMIN_DOCUMENT_VIEW_ACCESS',
                resourceType: 'VerificationDocument',
                resourceId: documentId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                requestId: req.requestId
            }).save();
        }

        res.setHeader('Content-Type', doc.fileMimeType);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `inline; filename="document${path.extname(doc.frontFileId)}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        next(error);
    }
};

export const uploadProfilePhoto = async (req, res, next) => {
    try {
        const workerId = req.user.userId;

        if (!req.file) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'FILE_REQUIRED',
                message: 'No profile photo file uploaded.'
            });
        }

        // Validate File Buffer
        try {
            validateFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
        } catch (fErr) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: fErr.message,
                message: 'File security or type check failed.'
            });
        }

        // Must be image mimetype
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'INVALID_FILE_TYPE',
                message: 'Profile photo must be an image.'
            });
        }

        // Create Private File Storage directory if it doesn't exist
        const PHOTO_DIR = path.resolve('uploads/profile-photos');
        if (!fs.existsSync(PHOTO_DIR)) {
            fs.mkdirSync(PHOTO_DIR, { recursive: true });
        }

        const fileExt = path.extname(req.file.originalname);
        const randomName = `${crypto.randomUUID()}${fileExt}`;
        const filePath = path.join(PHOTO_DIR, randomName);
        fs.writeFileSync(filePath, req.file.buffer);

        // Update profilePhotoId on WorkerProfile
        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (!profile) {
            profile = new WorkerProfile({ userId: workerId });
        }

        if (profile.verificationStatus === 'PENDING_APPROVAL') {
            return res.status(400).json({
                statusCode: 400,
                errorCode: 'VERIFICATION_ALREADY_SUBMITTED',
                message: 'Profile is locked for review. Cannot upload photo.'
            });
        }

        const photoUrl = `/api/v1/worker/verification/profile-photo/file/${randomName}`;
        profile.profilePhotoId = photoUrl;
        await profile.save();
        await User.findByIdAndUpdate(workerId, { profileImage: photoUrl });

        res.status(200).json({
            success: true,
            message: 'Profile photo uploaded successfully.',
            photoUrl: photoUrl
        });
    } catch (error) {
        next(error);
    }
};

export const deleteProfilePhoto = async (req, res, next) => {
    try {
        const workerId = req.user.userId;
        let profile = await WorkerProfile.findOne({ userId: workerId });
        if (profile) {
            profile.profilePhotoId = null;
            await profile.save();
        }
        await User.findByIdAndUpdate(workerId, { profileImage: null });

        res.status(200).json({
            success: true,
            message: 'Profile photo removed successfully.'
        });
    } catch (error) {
        next(error);
    }
};

export const serveProfilePhoto = async (req, res, next) => {
    try {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        const { filename } = req.params;
        const filePath = path.join(path.resolve('uploads/profile-photos'), filename);
        if (!fs.existsSync(filePath)) {
            res.status(404);
            res.setHeader('Content-Type', 'image/png');
            const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            return res.send(transparentPng);
        }
        
        let contentType = 'image/jpeg';
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        next(error);
    }
};
