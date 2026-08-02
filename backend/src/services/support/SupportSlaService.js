import SupportTicket from '../../models/SupportTicket.js';
import SupportSlaPolicy from '../../models/SupportSlaPolicy.js';

export class SupportSlaService {
    static async scanBreaches(referenceDate=new Date(),actorId){const tickets=await SupportTicket.find({status:{$nin:['RESOLVED','CLOSED','SPAM']},$or:[{firstRespondedAt:null,firstResponseDueAt:{$lt:referenceDate}},{resolutionDueAt:{$lt:referenceDate}}]});const {default:NotificationOutbox}=await import('../../models/NotificationOutbox.js');const {default:AuditLog}=await import('../../models/AuditLog.js');let escalated=0;for(const ticket of tickets){const level=Math.max(1,ticket.escalationLevel+1);ticket.escalationLevel=level;await ticket.save();await NotificationOutbox.updateOne({dedupeKey:`SUPPORT_SLA_BREACH_${ticket._id}_${level}`},{$setOnInsert:{eventType:'SUPPORT_SLA_BREACH',aggregateType:'SUPPORT_TICKET',aggregateId:ticket._id,recipientIds:ticket.assignedAgentId?[ticket.assignedAgentId]:[],payloadSafe:{ticketNumber:ticket.ticketNumber,escalationLevel:level}}},{upsert:true});if(actorId)await AuditLog.create({actor:actorId,action:'SUPPORT_SLA_ESCALATED',resourceType:'SupportTicket',resourceId:String(ticket._id),afterSnapshot:{escalationLevel:level}});escalated++;}return{scanned:tickets.length,escalated};}
    static async calculateSlaDeadlines(category, priority, referenceDate = new Date()) {
        const policy = await SupportSlaPolicy.findOne({
            category,
            priority,
            isActive: true,
            effectiveFrom: { $lte: referenceDate },
            $or: [{ effectiveUntil: { $exists: false } }, { effectiveUntil: { $gt: referenceDate } }]
        }).sort({ effectiveFrom: -1 }).lean();

        if (!policy) {
            // Default fallback if no SLA policy configured
            return {
                firstResponseDueAt: new Date(referenceDate.getTime() + 24 * 60 * 60 * 1000), // 24 hours
                resolutionDueAt: new Date(referenceDate.getTime() + 72 * 60 * 60 * 1000), // 72 hours
                policyId: null
            };
        }

        // Simplistic 24/7 SLA calculation.
        // A full business-hours SLA calculator would require holiday maps and schedule offsets.
        const firstResponseDueAt = new Date(referenceDate.getTime() + policy.firstResponseMinutes * 60 * 1000);
        const resolutionDueAt = new Date(referenceDate.getTime() + policy.resolutionMinutes * 60 * 1000);

        return {
            firstResponseDueAt,
            resolutionDueAt,
            policyId: policy._id
        };
    }
}

export default SupportSlaService;
