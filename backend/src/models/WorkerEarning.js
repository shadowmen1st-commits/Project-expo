import { Schema, model } from 'mongoose';

const workerEarningSchema = new Schema({
    earningNumber: { type: String, required: true, unique: true, trim: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    ledgerTransactionId: { type: Schema.Types.ObjectId, ref: 'LedgerTransaction' },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', required: true },
    status: {
        type: String,
        enum: ['PENDING', 'AVAILABLE', 'RESERVED', 'PAID', 'FROZEN', 'REVERSED'],
        default: 'PENDING',
        required: true,
    },
    earnedAt: { type: Date, default: Date.now, required: true },
    availableAt: { type: Date },
    reservedAt: { type: Date },
    paidAt: { type: Date },
    reversedAt: { type: Date },
    holdReason: { type: String },
    reversalReason: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
}, {
    timestamps: true,
});

workerEarningSchema.index({ workerId: 1 });
workerEarningSchema.index({ status: 1 });

export const WorkerEarning = model('WorkerEarning', workerEarningSchema);
export default WorkerEarning;
