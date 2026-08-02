import Message from '../models/Message.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import MessageService from '../services/chat/MessageService.js';
import ConversationParticipantState from '../models/ConversationParticipantState.js';
import MessageReport from '../models/MessageReport.js';import CommunicationRestriction from '../models/CommunicationRestriction.js';import ChatAttachment from '../models/ChatAttachment.js';import AuditLog from '../models/AuditLog.js';import NotificationOutbox from '../models/NotificationOutbox.js';import crypto from 'node:crypto';import path from 'node:path';import {sanitizePlainText,communicationError} from '../services/chat/MessageContentService.js';import {emitToRoom} from '../socketServer.js';
const participant=async(conversationId,userId)=>Conversation.findOne({_id:conversationId,participantIds:userId});const safeMessage=m=>{const o=m.toObject?m.toObject():m;delete o.metadataSafe;delete o.idempotencyKey;delete o.requestFingerprint;if(o.deletedAt){o.bodySafe='Message removed';o.attachmentIds=[];}return o;};

export const getConversationHistory = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { limit = 50, beforeSequence } = req.query;

        // Verify eligibility implicitly by checking participant state
        const conversation = await Conversation.findOne({ bookingId }).lean();
        if (!conversation) {
            return res.json({ messages: [], hasMore: false });
        }

        const isParticipant = conversation.participantIds.some(id => id.toString() === req.user.id);
        if (!isParticipant && req.user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const query = { conversationId: conversation._id };
        if (beforeSequence) {
            query.sequenceNumber = { $lt: parseInt(beforeSequence) };
        }

        const messages = await Message.find(query)
            .sort({ sequenceNumber: -1 })
            .limit(parseInt(limit) + 1)
            .lean();

        const hasMore = messages.length > parseInt(limit);
        if (hasMore) messages.pop(); // Remove the lookahead

        res.json({
            messages: messages.reverse().map(safeMessage),
            hasMore,
            conversation
        });
    } catch (error) {
        console.error('getConversationHistory error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const message = await MessageService.sendMessage(req.user.id, req.user.role, bookingId, req.body);
        
        res.status(201).json(message);
    } catch (error) {
        console.warn('sendMessage rejected:', error.errorCode || error.message);
        if (error.message.includes('Chat not permitted')) {
            return res.status(403).json({ message: error.message });
        }
        res.status(400).json({ message: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { lastReadMessageId, lastReadSequenceNumber } = req.body;
        const conversation=await participant(conversationId,req.user.id);if(!conversation)return res.status(403).json({message:'Forbidden'});
        const requested=Math.max(0,Number(lastReadSequenceNumber)||0);const session=await mongoose.startSession();let finalState;
        try{await session.withTransaction(async()=>{const state=await ConversationParticipantState.findOne({conversationId,userId:req.user.id}).session(session);const requestedMessage=requested?await Message.findOne({conversationId,sequenceNumber:requested}).session(session):null;if(requested&&!requestedMessage)throw communicationError('INVALID_READ_SEQUENCE','Read sequence does not identify a conversation message.',400);if(lastReadMessageId&&requestedMessage&&String(lastReadMessageId)!==String(requestedMessage._id))throw communicationError('READ_MESSAGE_MISMATCH','Read message does not match sequence.',400);const target=Math.max(state?.lastReadSequenceNumber||0,requested);const targetMessage=target===requested?requestedMessage:await Message.findOne({conversationId,sequenceNumber:target}).session(session);const unreadCount=await Message.countDocuments({conversationId,sequenceNumber:{$gt:target},senderId:{$ne:req.user.id}}).session(session);finalState=await ConversationParticipantState.findOneAndUpdate({conversationId,userId:req.user.id},{$set:{lastReadMessageId:targetMessage?._id||state?.lastReadMessageId,lastReadSequenceNumber:target,unreadCount},$setOnInsert:{role:req.user.role}},{upsert:true,new:true,session});});}finally{await session.endSession();}
        res.json({ success: true,lastReadSequenceNumber:finalState.lastReadSequenceNumber,unreadCount:finalState.unreadCount });
    } catch (error) {
        res.status(error.statusCode||500).json({ errorCode:error.errorCode,message:error.statusCode?error.message:'Server error' });
    }
};

export const editMessage=async(req,res,next)=>{try{const message=await MessageService.editMessage(req.user.id,req.params.conversationId,req.params.messageId,{text:req.body.text,operationId:req.headers['idempotency-key']});emitToRoom(`conversation:${req.params.conversationId}`,'message:edited',safeMessage(message));res.json({success:true,message:safeMessage(message)});}catch(e){next(e);}};
export const deleteMessage=async(req,res,next)=>{try{const message=await MessageService.deleteMessage(req.user.id,req.params.conversationId,req.params.messageId,{operationId:req.headers['idempotency-key'],reasonCode:req.body.reasonCode});emitToRoom(`conversation:${req.params.conversationId}`,'message:deleted',safeMessage(message));res.json({success:true,message:safeMessage(message)});}catch(e){next(e);}};
export const reportMessage=async(req,res,next)=>{try{const conversation=await participant(req.params.conversationId,req.user.id);if(!conversation)throw communicationError('CONVERSATION_FORBIDDEN','Forbidden',403);const message=await Message.findOne({_id:req.params.messageId,conversationId:conversation._id});if(!message)throw communicationError('MESSAGE_NOT_FOUND','Message not found',404);if(String(message.senderId)===String(req.user.id))throw communicationError('SELF_REPORT_NOT_ALLOWED','You cannot report your own message.');const descriptionSafe=req.body.description?sanitizePlainText(req.body.description,{maximumLength:1000}):'';let report;try{report=await MessageReport.create({messageId:message._id,conversationId:conversation._id,bookingId:conversation.bookingId,reporterId:req.user.id,reportedUserId:message.senderId,reasonCode:req.body.reasonCode,descriptionSafe});}catch(e){if(e.code===11000)throw communicationError('DUPLICATE_REPORT','Message already reported.',409);throw e;}await AuditLog.create({actor:req.user.id,action:'CHAT_MESSAGE_REPORTED',resourceType:'Message',resourceId:String(message._id),afterSnapshot:{reasonCode:report.reasonCode}});if(['THREAT','FRAUD_ATTEMPT','OFF_PLATFORM_PAYMENT'].includes(report.reasonCode))await NotificationOutbox.create({eventType:'HIGH_RISK_CHAT_REPORT',aggregateType:'MESSAGE_REPORT',aggregateId:report._id,recipientIds:[],payloadSafe:{reportId:report._id,reasonCode:report.reasonCode},dedupeKey:`CHAT_REPORT_${report._id}`});res.status(201).json({success:true,report:{id:report._id,reasonCode:report.reasonCode,status:report.status}});}catch(e){next(e);}};
export const restrictConversation=async(req,res,next)=>{try{const conversation=await participant(req.params.conversationId,req.user.id);if(!conversation)throw communicationError('CONVERSATION_FORBIDDEN','Forbidden',403);const target=conversation.participantIds.find(x=>String(x)!==String(req.user.id));let restriction=await CommunicationRestriction.findOneAndUpdate({sourceUserId:req.user.id,targetUserId:target,scope:'BOOKING_CHAT',bookingId:conversation.bookingId,status:'ACTIVE'},{$setOnInsert:{reasonCode:req.body.reasonCode||'USER_SAFETY',createdBy:req.user.id}},{upsert:true,new:true});conversation.status='RESTRICTED';await conversation.save();await AuditLog.create({actor:req.user.id,action:'CONVERSATION_RESTRICTED',resourceType:'Conversation',resourceId:String(conversation._id),afterSnapshot:{targetUserId:String(target)}});const {revokeConversationAccess}=await import('../socketServer.js');await revokeConversationAccess(target,conversation._id,'CONVERSATION_RESTRICTED');res.json({success:true,restrictionId:restriction._id});}catch(e){next(e);}};
export const unrestrictConversation=async(req,res,next)=>{try{const conversation=await participant(req.params.conversationId,req.user.id);if(!conversation)throw communicationError('CONVERSATION_FORBIDDEN','Forbidden',403);await CommunicationRestriction.updateMany({sourceUserId:req.user.id,bookingId:conversation.bookingId,status:'ACTIVE'},{$set:{status:'LIFTED'}});const active=await CommunicationRestriction.exists({bookingId:conversation.bookingId,status:'ACTIVE'});if(!active){conversation.status='ACTIVE';await conversation.save();}await AuditLog.create({actor:req.user.id,action:'CONVERSATION_UNRESTRICTED',resourceType:'Conversation',resourceId:String(conversation._id)});res.json({success:true});}catch(e){next(e);}};
const magicOk=(mime,b)=>mime==='image/jpeg'?(b[0]===0xff&&b[1]===0xd8):mime==='image/png'?(b.slice(1,4).toString()==='PNG'):mime==='image/webp'?(b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP'):mime==='application/pdf'?b.slice(0,4).toString()==='%PDF':false;
export const uploadAttachment=async(req,res,next)=>{try{const conversation=await participant(req.params.conversationId,req.user.id);if(!conversation||conversation.status!=='ACTIVE')throw communicationError('CONVERSATION_FORBIDDEN','Attachment upload forbidden.',403);const policy=conversation.policySnapshot||{};const {fileName,mimeType,contentBase64}=req.body;if(typeof contentBase64!=='string')throw communicationError('ATTACHMENT_CONTENT_REQUIRED','Attachment content required.');const buffer=Buffer.from(contentBase64,'base64'),ext=path.extname(String(fileName||'')).toLowerCase(),allowedExt={"image/jpeg":['.jpg','.jpeg'],"image/png":['.png'],"image/webp":['.webp'],"application/pdf":['.pdf']};if(!allowedExt[mimeType]?.includes(ext)||!magicOk(mimeType,buffer))throw communicationError('ATTACHMENT_TYPE_REJECTED','Attachment type or signature rejected.');if(buffer.length>(policy.maximumAttachmentSizeBytes||5242880))throw communicationError('ATTACHMENT_TOO_LARGE','Attachment is too large.');const safeName=path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g,'_');const a=await ChatAttachment.create({conversationId:conversation._id,uploaderId:req.user.id,storageProvider:'LOCAL_MOCK',storageKey:crypto.randomUUID(),originalFileNameSafe:safeName,mimeType,extension:ext,sizeBytes:buffer.length,checksum:crypto.createHash('sha256').update(buffer).digest('hex'),contentBase64,scanStatus:'SCANNER_NOT_CONFIGURED',status:'AVAILABLE'});res.status(201).json({success:true,attachment:{id:a._id,fileName:a.originalFileNameSafe,mimeType:a.mimeType,sizeBytes:a.sizeBytes,scanStatus:a.scanStatus}});}catch(e){next(e);}};
export const attachmentAccess=async(req,res,next)=>{try{const a=await ChatAttachment.findById(req.params.attachmentId).select('+contentBase64');if(!a||a.status!=='AVAILABLE')throw communicationError('ATTACHMENT_NOT_FOUND','Attachment unavailable.',404);if(!await participant(a.conversationId,req.user.id))throw communicationError('ATTACHMENT_FORBIDDEN','Forbidden.',403);res.json({success:true,accessUrl:`/api/v1/chat/attachments/${a._id}/content`,expiresAt:new Date(Date.now()+300000)});}catch(e){next(e);}};
export const attachmentContent=async(req,res,next)=>{try{const a=await ChatAttachment.findById(req.params.attachmentId).select('+contentBase64');if(!a||a.status!=='AVAILABLE')throw communicationError('ATTACHMENT_NOT_FOUND','Attachment unavailable.',404);if(!await participant(a.conversationId,req.user.id))throw communicationError('ATTACHMENT_FORBIDDEN','Forbidden.',403);res.type(a.mimeType).send(Buffer.from(a.contentBase64,'base64'));}catch(e){next(e);}};
