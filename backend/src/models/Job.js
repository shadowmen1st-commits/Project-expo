import { Schema, model } from 'mongoose';

const jobSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        requiredSkills: [{ type: String, trim: true }],
        workersRequired: { type: Number, required: true, default: 1, min: 1 },
        location: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        workingDate: { type: Date, required: true },
        startTime: { type: String, required: true }, // e.g. "10:00"
        endTime: { type: String, required: true }, // e.g. "18:00"
        payRate: { type: Number, required: true, min: 1 }, // in paise
        paymentType: { type: String, enum: ['DAILY', 'HOURLY'], default: 'DAILY' },
        duration: { type: String, required: true, trim: true }, // e.g. "1 day"
        experienceRequired: { type: Number, default: 0 },
        genderPreference: { type: String, enum: ['ANY', 'MALE', 'FEMALE'], default: 'ANY' },
        instructions: { type: String, trim: true },
        applicationDeadline: { type: Date, required: true },
        status: {
            type: String,
            enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
            default: 'ACTIVE'
        }
    },
    {
        timestamps: true
    }
);

export const Job = model('Job', jobSchema);
export default Job;
