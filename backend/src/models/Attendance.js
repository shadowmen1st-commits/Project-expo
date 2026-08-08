import { Schema, model } from 'mongoose';

const attendanceSchema = new Schema(
    {
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        status: {
            type: String,
            enum: ['PRESENT', 'ABSENT', 'LATE', 'PARTIAL'],
            default: 'PRESENT'
        },
        hoursWorked: { type: Number, required: true, default: 0 }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate attendance for a worker on same job/date
attendanceSchema.index({ jobId: 1, workerId: 1, date: 1 }, { unique: true });

export const Attendance = model('Attendance', attendanceSchema);
export default Attendance;
