import NotificationOutbox from '../../models/NotificationOutbox.js';
import Notification from '../../models/Notification.js';
import NotificationPreference from '../../models/NotificationPreference.js';
import NotificationEmailService from './NotificationEmailService.js';
import { emitToUser } from '../../socketServer.js';
import crypto from 'crypto';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const LOCK_TIMEOUT_MS = 30000;

export class NotificationDispatcher {
    static timer=null;
    static async processBatch() {
        const lockId = crypto.randomUUID();
        const now = new Date();

        // 1. Lock a batch of pending or retry messages that are due
        const claimed=[];for(let i=0;i<BATCH_SIZE;i++){const row=await NotificationOutbox.findOneAndUpdate({
                status: { $in: ['PENDING', 'RETRY'] },
                nextAttemptAt: { $lte: now },
                $or: [
                    { lockedAt: null },
                    { lockedAt: { $lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } }
                ]
            },{
                $set: {
                    status: 'PROCESSING',
                    lockedBy: lockId,
                    lockedAt: now
                }
            },{new:true,sort:{nextAttemptAt:1}}).lean();if(!row)break;claimed.push(row);}if(!claimed.length)return 0;
        const messages = claimed;

        for (const msg of messages) {
            try {
                await this.processMessage(msg);
                
                // Mark processed
                await NotificationOutbox.updateOne(
                    { _id: msg._id },
                    { 
                        $set: { 
                            status: 'PROCESSED', 
                            processedAt: new Date() 
                        } 
                    }
                );
            } catch (error) {
                console.error(`Failed to process outbox message ${msg._id}:`, error);
                
                const attempts = msg.attempts + 1;
                if (attempts >= MAX_ATTEMPTS) {
                    await NotificationOutbox.updateOne(
                        { _id: msg._id },
                        { $set: { status: 'DEAD_LETTER', attempts, lastErrorSafe: error.message } }
                    );
                } else {
                    // Exponential backoff
                    const nextAttemptAt = new Date(Date.now() + Math.pow(2, attempts) * 1000);
                    await NotificationOutbox.updateOne(
                        { _id: msg._id },
                        { $set: { status: 'RETRY', attempts, nextAttemptAt, lastErrorSafe: error.message, lockedBy: null, lockedAt: null } }
                    );
                }
            }
        }

        return messages.length;
    }

    static async processMessage(outboxMsg) {
        // Resolve Notification Preferences for each recipient
        for (const recipientId of outboxMsg.recipientIds) {
            const prefs = await NotificationPreference.findOne({ userId: recipientId }).lean();
            
            // Generate standard Notification record
            let category = 'SYSTEM';
            if (outboxMsg.eventType === 'NEW_CHAT_MESSAGE') category = 'CHAT';

            // Create dedupe key combining outbox dedupe and recipient
            const dedupeKey = `${outboxMsg.dedupeKey}_${recipientId}`;

            // We use upsert to avoid duplicate notifications if outbox processes twice
            const notification = await Notification.findOneAndUpdate(
                { dedupeKey },
                {
                    $setOnInsert: {
                        recipientId,
                        type: outboxMsg.eventType,
                        category,
                        title: outboxMsg.eventType === 'NEW_CHAT_MESSAGE' ? 'New Message' : 'Notification',
                        messageSafe: outboxMsg.payloadSafe.preview || 'You have a new notification',
                        entityType: outboxMsg.aggregateType,
                        entityId: outboxMsg.aggregateId,
                        dedupeKey,
                        status: 'UNREAD'
                    }
                },
                { upsert: true, new: true }
            );

            // If we actually inserted it (or it already existed but we want to try socket again):
            // Emit to socket
            emitToUser(recipientId, 'notification_event', {
                notificationId: notification._id,
                type: notification.type,
                payload: outboxMsg.payloadSafe
            });

            // Trigger EmailService if preference allows
            if (prefs?.channelPreferences?.EMAIL !== false) {
                await NotificationEmailService.sendNotificationEmail(recipientId, notification.title, notification.messageSafe);
            }
        }
    }

    static start(intervalMs = 5000) {
        console.log('Starting Notification Dispatcher...');
        if(this.timer)return this.timer;this.timer=setInterval(async () => {
            try {
                await this.processBatch();
            } catch (error) {
                console.error('Notification Dispatcher polling error:', error);
            }
        }, intervalMs);return this.timer;
    }
    static stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
}

export default NotificationDispatcher;
