import { Server } from 'socket.io';
import socketAuthMiddleware from './middleware/socketAuthMiddleware.js';
import ConversationEligibilityService from './services/chat/ConversationEligibilityService.js';
import MessageService from './services/chat/MessageService.js';

let io;
const typingTimers=new Map();const typingRates=new Map();const joinRates=new Map();

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            credentials: true
        }
    });

    // Apply strict authentication
    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        const user = socket.user;

        console.log(`Socket connected: ${socket.id} (User: ${user.id})`);

        // Join personal user room (e.g. for notifications)
        socket.join(`user:${user.id}`);

        // Handle joining conversation rooms strictly based on Booking/Conversation eligibility
        socket.on('join_conversation', async ({ bookingId }, callback) => {
            try {
                if (!bookingId) throw new Error('bookingId required');
                const rateKey=`${user.id}:join`,now=Date.now(),recent=(joinRates.get(rateKey)||[]).filter(t=>now-t<60000);
                if(recent.length>=30)throw new Error('Join rate limited');recent.push(now);joinRates.set(rateKey,recent);

                const { eligible, conversation, code } = await ConversationEligibilityService.validateEligibility(user.id, bookingId, user.role);

                if (!eligible) {
                    return callback && callback({ error: `Not eligible: ${code}` });
                }

                // If eligible, join the room!
                const roomName = `conversation:${conversation ? conversation._id.toString() : bookingId}`;
                socket.join(roomName);
                
                socket.data.conversations ||= new Map();socket.data.conversations.set(String(bookingId),roomName);
                if (callback) callback({ success: true });
            } catch (error) {
                console.warn('Socket join rejected:', error.errorCode || error.message);
                if (callback) callback({ error: error.message });
            }
        });

        // Handle leaving conversation room
        socket.on('leave_conversation', ({ roomId }) => {
            if (roomId) {
                socket.leave(roomId);
            }
        });

        // Handle typing indicator (requires room validation implicitly by broadcast.to)
        const typing=async(bookingId,isTyping,callback)=>{try{const eligibility=await ConversationEligibilityService.validateEligibility(user.id,bookingId,user.role);if(!eligibility.eligible)throw new Error(`Not eligible: ${eligibility.code}`);const room=socket.data.conversations?.get(String(bookingId));if(!room||!socket.rooms.has(room))throw new Error('Conversation room not joined');const key=`${user.id}:${bookingId}`,now=Date.now(),rate=typingRates.get(key)||[];const recent=rate.filter(t=>now-t<60000);if(recent.length>=(eligibility.policy.typingEventLimitPerMinute||20))throw new Error('Typing rate limited');recent.push(now);typingRates.set(key,recent);clearTimeout(typingTimers.get(key));socket.to(room).emit('typing:update',{bookingId,isTyping:Boolean(isTyping)});if(isTyping)typingTimers.set(key,setTimeout(()=>{socket.to(room).emit('typing:update',{bookingId,isTyping:false});typingTimers.delete(key);},5000));callback?.({success:true});}catch(e){callback?.({error:e.message});}};
        socket.on('typing:start',({bookingId},cb)=>typing(bookingId,true,cb));socket.on('typing:stop',({bookingId},cb)=>typing(bookingId,false,cb));

        // Client-direct messaging (optional if client wants to use socket.io emit instead of REST POST)
        // Usually, the REST POST is preferred, and the outbox dispatcher handles the socket EMIT.
        // But if we want Socket-to-DB creation directly:
        socket.on('send_message', async (payload, callback) => {
            try {
                // Must ensure payload has bookingId, text, etc.
                const message = await MessageService.sendMessage(user.id, user.role, payload.bookingId, payload);
                
                // Do NOT emit the message directly to the room here. 
                // Why? We rely on the Notification Outbox to process and broadcast the event securely and idempotently.
                // We just return success to the sender.
                
                if (callback) callback({ success: true, messageId: message._id, tempId: payload.clientMessageId });
            } catch (error) {
                console.warn('Socket message rejected:', error.errorCode || error.message);
                if (callback) callback({ error: error.message });
            }
        });

        socket.on('ping', (data) => {
            socket.emit('pong', data);
        });

        socket.on('disconnect', () => {
            for(const [key,timer] of typingTimers){if(key.startsWith(`${user.id}:`)){clearTimeout(timer);typingTimers.delete(key);}}
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Utility to dispatch from backend (e.g. from Notification Outbox Dispatcher)
export const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

export const emitToRoom = (roomId, event, data) => {
    if (io) {
        io.to(roomId).emit(event, data);
    }
};
export const revokeConversationAccess=async(userId,conversationId,reason='ACCESS_REVOKED')=>{if(!io)return 0;const room=`conversation:${conversationId}`;const sockets=await io.in(room).fetchSockets();let removed=0;for(const socket of sockets){if(String(socket.user?.id)===String(userId)){socket.emit('access:revoked',{conversationId:String(conversationId),reason});await socket.leave(room);for(const [bookingId,mapped] of socket.data.conversations||[]){if(mapped===room)socket.data.conversations.delete(bookingId);}removed++;}}return removed;};
export const closeSocketServer=async()=>{for(const timer of typingTimers.values())clearTimeout(timer);typingTimers.clear();typingRates.clear();joinRates.clear();if(io)await new Promise(resolve=>io.close(resolve));io=undefined;};
