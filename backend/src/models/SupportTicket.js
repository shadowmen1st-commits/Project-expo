import { Schema, model } from 'mongoose';

const supportTicketSchema = new Schema(
    {
        ticketNumber: { type: String, required: true, unique: true },
        requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        requesterRole: { type: String, enum: ['CUSTOMER', 'WORKER'], required: true },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' }, // Optional, can be account-related
        category: {
            type: String,
            enum: [
                'ACCOUNT',
                'BOOKING',
                'PAYMENT',
                'REFUND',
                'DISPUTE',
                'PAYOUT',
                'WORKER_BEHAVIOUR',
                'CUSTOMER_BEHAVIOUR',
                'REVIEW',
                'TECHNICAL',
                'SAFETY',
                'OTHER'
            ],
            required: true
        },
        subjectSafe: { type: String, required: true, maxlength: 200 },
        descriptionSafe: { type: String, required: true, maxlength: 5000 },
        priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' },
        status: {
            type: String,
            enum: [
                'OPEN',
                'TRIAGED',
                'IN_PROGRESS',
                'WAITING_FOR_USER',
                'WAITING_FOR_INTERNAL',
                'RESOLVED',
                'CLOSED',
                'REOPENED',
                'SPAM'
            ],
            default: 'OPEN'
        },
        assignedTeam: { type: String, default: 'TIER_1' },
        assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin
        escalationLevel: { type: Number, default: 0 },
        slaPolicyId: { type: Schema.Types.ObjectId, ref: 'SupportSlaPolicy' },
        firstResponseDueAt: { type: Date },
        resolutionDueAt: { type: Date },
        firstRespondedAt: { type: Date },
        resolvedAt: { type: Date },
        closedAt: { type: Date },
        reopenedAt: { type: Date },
        customerSatisfactionRating: { type: Number, min: 1, max: 5 },
        tags: [{ type: String }],
        relatedEntityType: { type: String },
        relatedEntityId: { type: Schema.Types.ObjectId },
        lastActivityAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

supportTicketSchema.index({ requesterId: 1, status: 1 });
supportTicketSchema.index({ assignedAgentId: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1, resolutionDueAt: 1 }); // For queue SLA sorting
supportTicketSchema.index({ bookingId: 1 }, { sparse: true });

export const SupportTicket = model('SupportTicket', supportTicketSchema);
export default SupportTicket;
