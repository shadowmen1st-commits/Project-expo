import mongoose from 'mongoose';
import SupportTicket from '../../models/SupportTicket.js';
import SupportTicketMessage from '../../models/SupportTicketMessage.js';
import NotificationOutboxService from '../notifications/NotificationOutboxService.js';
import SupportSlaService from './SupportSlaService.js';
import crypto from 'crypto';
import Booking from '../../models/Booking.js';
import { sanitizePlainText } from '../chat/MessageContentService.js';

export class SupportTicketStateService {
    static transitions={OPEN:['TRIAGED','SPAM'],TRIAGED:['IN_PROGRESS','SPAM'],IN_PROGRESS:['WAITING_FOR_USER','WAITING_FOR_INTERNAL','RESOLVED','SPAM'],WAITING_FOR_USER:['IN_PROGRESS','SPAM'],WAITING_FOR_INTERNAL:['IN_PROGRESS','SPAM'],RESOLVED:['CLOSED','REOPENED'],CLOSED:['REOPENED'],REOPENED:['IN_PROGRESS','SPAM']};
    static async transition(ticketId,target,{actorId,reasonCode,updates={}}={}){const ticket=await SupportTicket.findById(ticketId);if(!ticket)throw new Error('Ticket not found');if(!this.transitions[ticket.status]?.includes(target))throw new Error(`Transition ${ticket.status} -> ${target} is not allowed`);ticket.status=target;Object.assign(ticket,updates);if(target==='RESOLVED')ticket.resolvedAt=new Date();if(target==='CLOSED')ticket.closedAt=new Date();if(target==='REOPENED')ticket.reopenedAt=new Date();ticket.lastActivityAt=new Date();await ticket.save();const {default:AuditLog}=await import('../../models/AuditLog.js');await AuditLog.create({actor:actorId,action:`SUPPORT_TICKET_${target}`,resourceType:'SupportTicket',resourceId:String(ticket._id),afterSnapshot:{status:target,reasonCode}});return ticket;}
    static async generateTicketNumber() {
        // TKT-YYMMDD-XXXX
        const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `TKT-${date}-${random}`;
    }

    static async createTicket(userId, userRole, payload) {
        const { category, subject, description, priority = 'NORMAL', bookingId } = payload;
        if (!['CUSTOMER', 'WORKER'].includes(userRole)) throw new Error('Only customers and workers can create support tickets');
        const subjectSafe = sanitizePlainText(subject, { maximumLength: 200 });
        const descriptionSafe = sanitizePlainText(description, { maximumLength: 5000 });
        if (bookingId) {
            const booking = await Booking.findById(bookingId).lean();
            if (!booking) throw new Error('Booking not found');
            const ownerId = userRole === 'CUSTOMER' ? booking.customerId : booking.workerId;
            if (String(ownerId) !== String(userId)) throw new Error('Booking does not belong to requester');
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        let ticket;

        try {
            const ticketNumber = await this.generateTicketNumber();
            
            // Calculate SLAs
            const slas = await SupportSlaService.calculateSlaDeadlines(category, priority);

            ticket = new SupportTicket({
                ticketNumber,
                requesterId: userId,
                requesterRole: userRole,
                bookingId,
                category,
                subjectSafe,
                descriptionSafe,
                priority,
                status: 'OPEN',
                slaPolicyId: slas.policyId,
                firstResponseDueAt: slas.firstResponseDueAt,
                resolutionDueAt: slas.resolutionDueAt
            });

            await ticket.save({ session });

            // Create initial message from description
            const initialMessage = new SupportTicketMessage({
                ticketId: ticket._id,
                senderId: userId,
                senderType: userRole,
                bodySafe: descriptionSafe,
                visibility: 'REQUESTER_VISIBLE',
                idempotencyKey: crypto.randomUUID()
            });

            await initialMessage.save({ session });

            // Outbox event for Agent notification / email to user
            await NotificationOutboxService.dispatch(
                'TICKET_CREATED',
                'SUPPORT_TICKET',
                ticket._id,
                [userId], // Notify user it was received
                { ticketNumber, subject: subjectSafe },
                `TICKET_CREATED_${ticket._id}`,
                session
            );

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        return ticket;
    }

    static async addReply(ticketId, senderId, senderType, body, visibility = 'REQUESTER_VISIBLE', attempt = 0) {
        const bodySafe = sanitizePlainText(body, { maximumLength: 5000 });
        if (!['REQUESTER_VISIBLE', 'INTERNAL_ONLY'].includes(visibility)) throw new Error('Invalid message visibility');
        const session = await mongoose.startSession();
        let message;

        try {
            await session.withTransaction(async () => {
            const ticket = await SupportTicket.findById(ticketId).session(session);
            if (!ticket) throw new Error('Ticket not found');

            message = new SupportTicketMessage({
                ticketId,
                senderId,
                senderType,
                bodySafe,
                visibility,
                idempotencyKey: crypto.randomUUID()
            });

            await message.save({ session });

            // State Transitions
            const updates = { lastActivityAt: new Date() };

            if (senderType === 'SUPPORT_AGENT' && visibility === 'REQUESTER_VISIBLE') {
                if (!ticket.firstRespondedAt) {
                    updates.firstRespondedAt = new Date();
                }
                updates.status = 'WAITING_FOR_USER';
            } else if (senderType === 'CUSTOMER' || senderType === 'WORKER') {
                updates.status = 'OPEN'; // Goes back to queue essentially
            }

            await SupportTicket.updateOne({ _id: ticketId }, { $set: updates }, { session });

            // Notify via outbox if visible
            if (visibility === 'REQUESTER_VISIBLE') {
                const recipients = senderType === 'SUPPORT_AGENT' ? [ticket.requesterId] : [];
                // Agents use a queue, but if assigned we might notify the assigned agent
                if (senderType !== 'SUPPORT_AGENT' && ticket.assignedAgentId) {
                    recipients.push(ticket.assignedAgentId);
                }

                if (recipients.length > 0) {
                    await NotificationOutboxService.dispatch(
                        'TICKET_REPLY',
                        'SUPPORT_TICKET',
                        ticket._id,
                        recipients,
                        { ticketNumber: ticket.ticketNumber, preview: bodySafe.substring(0, 50) },
                        `TICKET_REPLY_${message._id}`,
                        session
                    );
                }
            }

            });
        } catch (error) {
            if (attempt < 4 && (error.hasErrorLabel?.('TransientTransactionError') || error.hasErrorLabel?.('UnknownTransactionCommitResult') || [112,251].includes(error.code))) {
                await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)));
                return this.addReply(ticketId,senderId,senderType,body,visibility,attempt+1);
            }
            throw error;
        } finally {
            await session.endSession();
        }

        return message;
    }
}

export default SupportTicketStateService;
