import { Schema, model } from 'mongoose';

const availabilitySlotSchema = new Schema(
    {
        day: { type: Number, required: true, min: 0, max: 6 },
        start: { type: String, required: true, default: '09:00' },
        end: { type: String, required: true, default: '18:00' },
        isWorking: { type: Boolean, default: true },
    },
    { _id: false }
);

const blockedRangeSchema = new Schema(
    {
        start: { type: Date, required: true },
        end: { type: Date, required: true },
        reason: { type: String },
    },
    { _id: false }
);

const pointSchema = new Schema(
    {
        type: { type: String, enum: ['Point'], default: 'Point', required: true },
        coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    { _id: false }
);

const workerProfileSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        fullName: { type: String, trim: true },
        dateOfBirth: { type: Date },
        gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
        phone: { type: String, trim: true },
        alternatePhone: { type: String, trim: true },
        address: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        country: { type: String, default: 'India', trim: true },
        profilePhotoId: { type: String }, // URL or File key
        bio: { type: String, trim: true },
        yearsOfExperience: { type: Number, default: 0, min: 0 },
        primaryServiceCategoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
        serviceIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }], // Sub-services if any, or just category mappings
        serviceCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }], // Preserve legacy field for compatibility
        skills: [{ type: String, trim: true }],
        languages: [{ type: String, trim: true }],
        hourlyRate: { type: Number, required: true, default: 0 }, // in paise
        dailyRate: { type: Number, required: true, default: 0 }, // in paise
        minimumBookingDuration: { type: Number, default: 1 }, // hours or days
        bufferMinutes: { type: Number, default: 30 },
        serviceRadiusKm: { type: Number, default: 10 },
        workRadiusKm: { type: Number, default: 10 },
        emergencyContact: {
            name: { type: String, trim: true },
            phone: { type: String, trim: true },
            relationship: { type: String, trim: true }
        },
        timezone: { type: String, default: 'Asia/Kolkata' },
        location: { type: pointSchema, default: undefined },
        averageRating: { type: Number, default: null, min: 0, max: 5 },
        ratingCount: { type: Number, default: 0, min: 0 },
        completedBookings: { type: Number, default: 0, min: 0 },
        cancelledBookings: { type: Number, default: 0, min: 0 },
        verificationStatus: {
            type: String,
            enum: [
                'NOT_SUBMITTED',
                'INCOMPLETE_PROFILE',
                'DRAFT',
                'SUBMITTED',
                'PENDING_APPROVAL',
                'UNDER_REVIEW',
                'CHANGES_REQUIRED',
                'APPROVED',
                'REJECTED',
                'SUSPENDED'
            ],
            default: 'NOT_SUBMITTED',
        },
        onboardingProgressPercent: { type: Number, default: 0 },
        submittedAt: { type: Date },
        approvedAt: { type: Date },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        rejectedAt: { type: Date },
        rejectionReason: { type: String },
        suspendedAt: { type: Date },
        suspensionReason: { type: String },
        latestSubmissionId: { type: Schema.Types.ObjectId, ref: 'VerificationSubmission' },
        verificationVersion: { type: Number, default: 1 },
        verificationBadge: { type: Boolean, default: false },
        availability: {
            type: [availabilitySlotSchema],
            default: [
                { day: 0, start: '09:00', end: '18:00', isWorking: true },
                { day: 1, start: '09:00', end: '18:00', isWorking: true },
                { day: 2, start: '09:00', end: '18:00', isWorking: true },
                { day: 3, start: '09:00', end: '18:00', isWorking: true },
                { day: 4, start: '09:00', end: '18:00', isWorking: true },
                { day: 5, start: '09:00', end: '18:00', isWorking: true },
                { day: 6, start: '09:00', end: '18:00', isWorking: true },
            ],
        },
        leaveDates: [{ type: Date }],
        blockedRanges: [blockedRangeSchema],
        isOnline: { type: Boolean, default: true },
        isTemporarilyUnavailable: { type: Boolean, default: false },
        isPubliclyVisible: { type: Boolean, default: false }, // Set false by default until approved
    },
    {
        timestamps: true,
    }
);

// Indexes
workerProfileSchema.index({ serviceCategoryIds: 1 });
workerProfileSchema.index({ skills: 1 });
workerProfileSchema.index({ verificationStatus: 1 });
workerProfileSchema.index({ averageRating: -1 });
workerProfileSchema.index({ hourlyRate: 1 });
workerProfileSchema.index({ dailyRate: 1 });
workerProfileSchema.index({ isOnline: 1 });
workerProfileSchema.index({ isPubliclyVisible: 1 });
workerProfileSchema.index({ location: '2dsphere' }, { sparse: true });
workerProfileSchema.index({ verificationStatus: 1, serviceCategoryIds: 1, isPubliclyVisible: 1 });

export const WorkerProfile = model('WorkerProfile', workerProfileSchema);
export default WorkerProfile;
