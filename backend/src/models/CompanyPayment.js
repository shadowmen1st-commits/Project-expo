import { Schema, model } from 'mongoose';

const companyPaymentSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
        workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        amountPaise: { type: Number, required: true },
        platformCommissionPaise: { type: Number, required: true },
        workerEarningPaise: { type: Number, required: true },
        status: {
            type: String,
            enum: ['PENDING', 'ESCROW', 'RELEASED', 'REFUNDED'],
            default: 'PENDING'
        }
    },
    {
        timestamps: true
    }
);

export const CompanyPayment = model('CompanyPayment', companyPaymentSchema);
export default CompanyPayment;
