import { Schema, model } from 'mongoose';

const workerAssignmentSchema = new Schema(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Company User (denormalised for fast ownership checks)
        assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Company User
        status: {
            type: String,
            enum: ['AVAILABLE', 'ASSIGNED', 'WORKING', 'COMPLETED', 'ABSENT', 'REMOVED'],
            default: 'ASSIGNED'
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'RELEASED'],
            default: 'PENDING'
        },
        assignedAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate assignments (same worker on same job)
workerAssignmentSchema.index({ jobId: 1, workerId: 1 }, { unique: true });
workerAssignmentSchema.index({ companyId: 1, status: 1 });
workerAssignmentSchema.index({ workerId: 1, status: 1 });

export const WorkerAssignment = model('WorkerAssignment', workerAssignmentSchema);
export default WorkerAssignment;
