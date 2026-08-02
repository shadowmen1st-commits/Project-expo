import Booking from '../../models/Booking.js';
import Conversation from '../../models/Conversation.js';
import CommunicationRestriction from '../../models/CommunicationRestriction.js';
import CommunicationPolicy from '../../models/CommunicationPolicy.js';

export class ConversationEligibilityService {
    static async validateEligibility(userId, bookingId, userRole) {
        // 1. Authenticated user exists (Handled by caller/auth middleware)

        // 2. Load Booking
        const booking = await Booking.findById(bookingId).lean();
        if (!booking) {
            return { eligible: false, code: 'BOOKING_NOT_FOUND' };
        }

        // 3. User is booking Customer or assigned Worker
        if (
            booking.customerId.toString() !== userId.toString() &&
            booking.workerId.toString() !== userId.toString()
        ) {
            return { eligible: false, code: 'NOT_BOOKING_PARTICIPANT' };
        }

        // Check if there are active communication restrictions
        const restriction = await CommunicationRestriction.findOne({$and:[{$or:[{sourceUserId:booking.customerId,targetUserId:booking.workerId},{sourceUserId:booking.workerId,targetUserId:booking.customerId},{targetUserId:userId,scope:'PLATFORM_RESTRICTION'}]},{status:'ACTIVE'},{$or:[{expiresAt:{$exists:false}},{expiresAt:null},{expiresAt:{$gt:new Date()}}]}]}).lean();

        if (restriction) {
            return { eligible: false, code: 'COMMUNICATION_BLOCKED' };
        }

        // Fetch Policy
        const policy = await CommunicationPolicy.findOne({
            isActive: true,
            effectiveFrom: { $lte: new Date() },
            $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gt: new Date() } }]
        }).sort({ effectiveFrom: -1 }).lean();
        let effectivePolicy=policy;
        if(!effectivePolicy){effectivePolicy=(await CommunicationPolicy.create({chatEnabled:true,allowedBookingStatuses:['ACCEPTED','CONFIRMED','WORKER_EN_ROUTE','STARTED','COMPLETION_REQUESTED','COMPLETED','DISPUTED'],chatStartRule:'AFTER_ACCEPTED',postCompletionChatWindowHours:48,maximumMessageLength:2000,maximumMessagesPerMinute:30,maximumAttachmentsPerMessage:3,maximumAttachmentSizeBytes:5242880,allowedAttachmentMimeTypes:['image/jpeg','image/png','image/webp','application/pdf'],messageEditWindowMinutes:15,messageDeleteWindowMinutes:60,typingEventLimitPerMinute:20,contactInformationSharingPolicy:'WARNING',externalLinkPolicy:'BLOCKED',retentionDays:1095,supportRetentionDays:2555,policyVersion:1,requiresBusinessApproval:true,isActive:true,effectiveFrom:new Date(0),createdBy:'DEVELOPMENT_DEFAULT_REQUIRES_BUSINESS_APPROVAL',updatedBy:'DEVELOPMENT_DEFAULT_REQUIRES_BUSINESS_APPROVAL'})).toObject();}
        /* development fallback retained as a persisted, versioned policy */
        const policyValue=effectivePolicy || {
            chatEnabled: true,
            allowedBookingStatuses: ['ACCEPTED', 'CONFIRMED', 'WORKER_EN_ROUTE', 'STARTED', 'COMPLETION_REQUESTED', 'COMPLETED', 'DISPUTED'],
            postCompletionChatWindowHours: 48
        };

        if (!policyValue.chatEnabled) {
            return { eligible: false, code: 'CHAT_NOT_AVAILABLE' };
        }

        // Check Booking Status
        if (!policyValue.allowedBookingStatuses.includes(booking.bookingStatus)) {
            return { eligible: false, code: 'CHAT_NOT_AVAILABLE' };
        }

        // Check time window if completed
        if (booking.bookingStatus === 'COMPLETED' && booking.completedAt) {
            const completedHoursAgo = (Date.now() - new Date(booking.completedAt).getTime()) / (1000 * 60 * 60);
            if (completedHoursAgo > policyValue.postCompletionChatWindowHours) {
                return { eligible: false, code: 'CHAT_WINDOW_CLOSED' };
            }
        }

        // Fetch or create Conversation
        let conversation = await Conversation.findOne({ bookingId }).lean();
        if (conversation && conversation.status === 'RESTRICTED') {
            return { eligible: false, code: 'CONVERSATION_RESTRICTED' };
        }

        return {
            eligible: true,
            booking,
            conversation,
            policy: policyValue
        };
    }
}

export default ConversationEligibilityService;
