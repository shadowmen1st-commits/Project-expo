import { Schema, model } from 'mongoose';

const jobApplicationSchema = new Schema(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: ['PENDING', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'CANCELLED'],
            default: 'PENDING'
        },
        appliedAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate applications
jobApplicationSchema.index({ jobId: 1, workerId: 1 }, { unique: true });

export const JobApplication = model('JobApplication', jobApplicationSchema);
export default JobApplication;
