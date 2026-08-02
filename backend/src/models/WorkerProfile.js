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

const workerProfileSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        serviceCategoryIds: [{ type: Schema.Types.ObjectId, ref: 'ServiceCategory' }],
        skills: [{ type: String, trim: true }],
        experienceYears: { type: Number, default: 0, min: 0 },
        bio: { type: String, trim: true },
        languages: [{ type: String, trim: true }],
        hourlyRate: { type: Number, required: true, default: 0 }, // in paise
        dailyRate: { type: Number, required: true, default: 0 }, // in paise
        minimumBookingDuration: { type: Number, default: 1 }, // hours or days
        bufferMinutes: { type: Number, default: 30 },
        serviceRadiusKm: { type: Number, default: 10 },
        timezone: { type: String, default: 'Asia/Kolkata' },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: [77.5946, 12.9716] }, // [longitude, latitude]
        },
        averageRating: { type: Number, default: null, min: 0, max: 5 },
        ratingCount: { type: Number, default: 0, min: 0 },
        completedBookings: { type: Number, default: 0, min: 0 },
        cancelledBookings: { type: Number, default: 0, min: 0 },
        verificationStatus: {
            type: String,
            enum: [
                'DRAFT',
                'PENDING_APPROVAL',
                'UNDER_REVIEW',
                'MORE_INFO_REQUIRED',
                'APPROVED',
                'REJECTED',
                'SUSPENDED',
                'BLOCKED',
            ],
            default: 'DRAFT',
        },
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
        isPubliclyVisible: { type: Boolean, default: true },
        approvedAt: { type: Date },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        rejectionReason: { type: String },
        suspensionReason: { type: String },
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
workerProfileSchema.index({ location: '2dsphere' });
workerProfileSchema.index({ verificationStatus: 1, serviceCategoryIds: 1, isPubliclyVisible: 1 });

export const WorkerProfile = model('WorkerProfile', workerProfileSchema);
export default WorkerProfile;
