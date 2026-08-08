import { Schema, model } from 'mongoose';

const companyWalletSchema = new Schema(
    {
        companyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        availableBalancePaise: { type: Number, required: true, default: 0 },
        pendingAmountPaise: { type: Number, required: true, default: 0 },
        escrowAmountPaise: { type: Number, required: true, default: 0 },
        totalSpentPaise: { type: Number, required: true, default: 0 },
        transactionHistory: [
            {
                amountPaise: { type: Number, required: true },
                type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
                description: { type: String, required: true },
                createdAt: { type: Date, default: Date.now }
            }
        ]
    },
    {
        timestamps: true
    }
);

export const CompanyWallet = model('CompanyWallet', companyWalletSchema);
export default CompanyWallet;
