import { Schema, model } from 'mongoose';

const workerAssignmentSchema = new Schema(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Company User
        status: {
            type: String,
            enum: ['AVAILABLE', 'ASSIGNED', 'WORKING', 'COMPLETED', 'ABSENT', 'REMOVED'],
            default: 'ASSIGNED'
        },
        assignedAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate assignments
workerAssignmentSchema.index({ jobId: 1, workerId: 1 }, { unique: true });

export const WorkerAssignment = model('WorkerAssignment', workerAssignmentSchema);
export default WorkerAssignment;
