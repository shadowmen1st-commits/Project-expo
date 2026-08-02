import mongoose from 'mongoose';
import Message from '../../models/Message.js';
import Conversation from '../../models/Conversation.js';
import ConversationParticipantState from '../../models/ConversationParticipantState.js';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import ConversationEligibilityService from './ConversationEligibilityService.js';
import crypto from 'crypto';
import { sanitizePlainText, communicationError } from './MessageContentService.js';
import AuditLog from '../../models/AuditLog.js';

export class MessageService {
    static async sendMessage(userId, userRole, bookingId, payload, attempt = 0) {
        const { text, clientMessageId, attachmentIds = [], replyToMessageId } = payload;
        
        // Basic input validation
        if (!text && (!attachmentIds || attachmentIds.length === 0)) {
            throw new Error('Message body or attachments required');
        }

        // Validate Eligibility
        const eligibility = await ConversationEligibilityService.validateEligibility(userId, bookingId, userRole);
        if (!eligibility.eligible) {
            throw new Error(`Chat not permitted: ${eligibility.code}`);
        }

        const { booking, policy } = eligibility;
        let { conversation } = eligibility;

        if(attachmentIds.length>policy.maximumAttachmentsPerMessage)throw communicationError('TOO_MANY_ATTACHMENTS','Too many attachments.');
        const bodySafe=text?sanitizePlainText(text,{maximumLength:policy.maximumMessageLength}):'';
        const requestFingerprint=crypto.createHash('sha256').update(JSON.stringify({bodySafe,attachmentIds:[...attachmentIds].map(String).sort(),replyToMessageId:replyToMessageId||null})).digest('hex');
        const fail = point => { if (process.env.NODE_ENV === 'test' && payload.failurePoint === point) throw communicationError('INJECTED_TRANSACTION_FAILURE', point, 503); };

        const session = await mongoose.startSession();
        session.startTransaction();
        let message;
        
        try {
            // 1. Create Conversation if it doesn't exist
            if (!conversation) {
                const newConversation = new Conversation({
                    bookingId: booking._id,
                    customerId: booking.customerId,
                    workerId: booking.workerId,
                    participantIds: [booking.customerId, booking.workerId],
                    policySnapshot: policy
                });
                conversation = await newConversation.save({ session });
            }

            // 2. Check Idempotency
            if (clientMessageId) {
                const existingMessage = await Message.findOne({
                    conversationId: conversation._id,
                    senderId: userId,
                    clientMessageId
                }).session(session);

                if (existingMessage) {
                    if (existingMessage.requestFingerprint !== requestFingerprint) {
                        throw communicationError('MESSAGE_IDEMPOTENCY_CONFLICT','ClientMessageId reused with different payload.',409);
                    }
                    await session.abortTransaction();
                    session.endSession();
                    return existingMessage;
                }
            }

            // 3. Allocate Sequence Number using atomic increment on Conversation
            const updatedConversation = await Conversation.findOneAndUpdate(
                { _id: conversation._id },
                { $inc: { messageCount: 1 } },
                { new: true, session }
            );
            
            const sequenceNumber = updatedConversation.messageCount;
            fail('AFTER_SEQUENCE');

            // 4. Create Message
            message = new Message({
                conversationId: conversation._id,
                bookingId: booking._id,
                senderId: userId,
                senderRole: userRole,
                messageType: attachmentIds?.length > 0 ? 'ATTACHMENT' : 'TEXT',
                bodySafe,
                clientMessageId,
                idempotencyKey: crypto.randomUUID(),
                requestFingerprint,
                sequenceNumber,
                attachmentIds,
                replyToMessageId
            });

            await message.save({ session });
            fail('AFTER_MESSAGE');

            // 5. Update Conversation Summary
            await Conversation.updateOne(
                { _id: conversation._id },
                {
                    $set: {
                        lastMessageId: message._id,
                        lastMessageAt: message.sentAt,
                        lastMessagePreviewSafe: message.bodySafe.substring(0, 100)
                    }
                },
                { session }
            );
            fail('AFTER_CONVERSATION');

            // 6. Update Participant States (Increment unread for others)
            const otherParticipants = conversation.participantIds.filter(id => id.toString() !== userId.toString());
            
            for (const participantId of otherParticipants) {
                await ConversationParticipantState.findOneAndUpdate(
                    { conversationId: conversation._id, userId: participantId },
                    {
                        $inc: { unreadCount: 1 },
                        $setOnInsert: { role: participantId.toString() === booking.customerId.toString() ? 'CUSTOMER' : 'WORKER' }
                    },
                    { upsert: true, session }
                );
            }

            // Also upsert for sender (unread = 0)
            await ConversationParticipantState.findOneAndUpdate(
                { conversationId: conversation._id, userId: userId },
                {
                    $set: { lastReadMessageId: message._id, lastReadSequenceNumber: sequenceNumber },
                    $setOnInsert: { role: userRole }
                },
                { upsert: true, session }
            );
            fail('AFTER_UNREAD');

            // 7. Drop Notification Outbox Event
            const outbox = new NotificationOutbox({
                eventType: 'NEW_CHAT_MESSAGE',
                aggregateType: 'MESSAGE',
                aggregateId: message._id,
                recipientIds: otherParticipants,
                payloadSafe: {
                    messageId: message._id,
                    conversationId: conversation._id,
                    bookingId: booking._id,
                    senderRole: userRole,
                    preview: message.bodySafe.substring(0, 100)
                },
                dedupeKey: `CHAT_MSG_${message._id}`
            });
            await outbox.save({ session });
            fail('AFTER_OUTBOX');

            await AuditLog.create([{actor:userId,action:'CHAT_MESSAGE_CREATED',resourceType:'Message',resourceId:String(message._id),afterSnapshot:{conversationId:String(conversation._id),sequenceNumber}}],{session});
            fail('BEFORE_COMMIT');

            // 8. Commit Transaction
            await session.commitTransaction();
            fail('AFTER_COMMIT_BEFORE_EMIT');
            
        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            if (clientMessageId && (error.code === 11000 || error.hasErrorLabel?.('TransientTransactionError') || error.code === 112)) {
                const existing = await Message.findOne({senderId:userId,clientMessageId});
                if (existing) {
                    if (existing.requestFingerprint !== requestFingerprint) throw communicationError('MESSAGE_IDEMPOTENCY_CONFLICT','ClientMessageId reused with different payload.',409);
                    return existing;
                }
                if (attempt < 50) {
                    await new Promise(resolve=>setTimeout(resolve,Math.min(100,5*(attempt+1))+Math.floor(Math.random()*10)));
                    return this.sendMessage(userId,userRole,bookingId,payload,attempt+1);
                }
            }
            throw error;
        } finally {
            session.endSession();
        }

        return message;
    }

    static async editMessage(userId,conversationId,messageId,{text,operationId}){const conversation=await Conversation.findOne({_id:conversationId,participantIds:userId});if(!conversation)throw communicationError('CONVERSATION_FORBIDDEN','Conversation not found.',403);const message=await Message.findOne({_id:messageId,conversationId});if(!message)throw communicationError('MESSAGE_NOT_FOUND','Message not found.',404);if(String(message.senderId)!==String(userId))throw communicationError('MESSAGE_EDIT_FORBIDDEN','Only the sender may edit this message.',403);if(message.messageType!=='TEXT'||message.deletedAt||['HIDDEN','REMOVED'].includes(message.moderationStatus))throw communicationError('MESSAGE_NOT_EDITABLE','This message cannot be edited.',409);const windowMinutes=conversation.policySnapshot?.messageEditWindowMinutes??15;if(Date.now()-message.sentAt.getTime()>windowMinutes*60000)throw communicationError('MESSAGE_EDIT_WINDOW_EXPIRED','Message edit window expired.',409);if(operationId&&message.metadataSafe?.lastEditOperationId===operationId)return message;const safe=sanitizePlainText(text,{maximumLength:conversation.policySnapshot?.maximumMessageLength??2000});const beforeHash=crypto.createHash('sha256').update(message.bodySafe||'').digest('hex');message.bodySafe=safe;message.editCount+=1;message.editedAt=new Date();message.metadataSafe={...(message.metadataSafe||{}),lastEditOperationId:operationId||undefined};await message.save();await AuditLog.create({actor:userId,action:'CHAT_MESSAGE_EDITED',resourceType:'Message',resourceId:String(message._id),beforeSnapshot:{bodyHash:beforeHash},afterSnapshot:{editCount:message.editCount}});return message;}

    static async deleteMessage(userId,conversationId,messageId,{operationId,reasonCode='SENDER_REQUEST'}={}){const conversation=await Conversation.findOne({_id:conversationId,participantIds:userId});if(!conversation)throw communicationError('CONVERSATION_FORBIDDEN','Conversation not found.',403);const message=await Message.findOne({_id:messageId,conversationId});if(!message)throw communicationError('MESSAGE_NOT_FOUND','Message not found.',404);if(String(message.senderId)!==String(userId))throw communicationError('MESSAGE_DELETE_FORBIDDEN','Only the sender may remove this message.',403);if(message.deletedAt)return message;const windowMinutes=conversation.policySnapshot?.messageDeleteWindowMinutes??60;if(Date.now()-message.sentAt.getTime()>windowMinutes*60000)throw communicationError('MESSAGE_DELETE_WINDOW_EXPIRED','Message deletion window expired.',409);message.deletedAt=new Date();message.deletionType='SOFT';message.deletionReasonCode=reasonCode;message.metadataSafe={...(message.metadataSafe||{}),originalBodyEvidence:message.bodySafe,lastDeleteOperationId:operationId||undefined};message.bodySafe='Message removed';message.attachmentIds=[];await message.save();await AuditLog.create({actor:userId,action:'CHAT_MESSAGE_SOFT_DELETED',resourceType:'Message',resourceId:String(message._id),afterSnapshot:{tombstone:true,reasonCode}});return message;}
}

export default MessageService;
