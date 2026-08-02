import { Schema, model } from 'mongoose';

const communicationRestrictionSchema = new Schema(
    {
        sourceUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        scope: {
            type: String,
            enum: ['BOOKING_CHAT', 'DIRECT_COMMUNICATION', 'PLATFORM_RESTRICTION'],
            required: true
        },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' }, // If scope is BOOKING_CHAT
        reasonCode: { type: String },
        status: { type: String, enum: ['ACTIVE', 'LIFTED', 'EXPIRED'], default: 'ACTIVE' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        expiresAt: { type: Date }
    },
    { timestamps: true }
);

communicationRestrictionSchema.index({ sourceUserId: 1, targetUserId: 1, status: 1 });
communicationRestrictionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CommunicationRestriction = model('CommunicationRestriction', communicationRestrictionSchema);
export default CommunicationRestriction;
