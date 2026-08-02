import mongoose from 'mongoose';
import NotificationOutbox from '../../models/NotificationOutbox.js';
import crypto from 'crypto';

export class NotificationOutboxService {
    /**
     * Atomically creates an outbox event within an existing transaction session.
     * MUST be called passing a mongoose session to guarantee atomicity.
     */
    static async dispatch(eventType, aggregateType, aggregateId, recipientIds, payload, dedupeKey, session) {
        if (!session) {
            throw new Error('NotificationOutboxService.dispatch MUST be called within a Mongoose transaction session.');
        }

        const outbox = new NotificationOutbox({
            eventType,
            aggregateType,
            aggregateId,
            recipientIds,
            payloadSafe: payload,
            dedupeKey: dedupeKey || crypto.randomUUID()
        });

        await outbox.save({ session });
        return outbox;
    }
}

export default NotificationOutboxService;
