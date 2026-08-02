import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Send, X, Paperclip, AlertCircle, Loader } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '');
if (!SOCKET_URL) throw new Error('VITE_SOCKET_URL or VITE_API_URL is required.');

export const Chat = ({ bookingId, participantName, onClose }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [conversationId,setConversationId]=useState(null);
    const messagesEndRef = useRef(null);
    
    // Connect to Socket and Fetch initial history
    useEffect(() => {
        let activeSocket;
        
        const initializeChat = async () => {
            try {
                setLoading(true);
                // 1. Fetch History
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`, { withCredentials: true });
                setMessages(res.data.messages || []);
                setConversationId(res.data.conversation?._id||null);
                
                // 2. Connect socket
                activeSocket = io(SOCKET_URL, {
                    withCredentials: true,
                    reconnection: true
                });

                activeSocket.on('connect', () => {
                    activeSocket.emit('join_conversation', { bookingId }, (response) => {
                        if (response.error) {
                            setError(response.error);
                        } else {
                            setError(null);
                        }
                    });
                });

                activeSocket.on('notification_event', (event) => {
                    if (event.type === 'NEW_CHAT_MESSAGE' && event.payload.bookingId === bookingId) {
                        // In a real app we might fetch the specific message or just rely on the payload preview
                        // For exact replication, fetch history again or append if we have the full message
                        // Here we fetch history to ensure order, but typically we'd just append.
                        fetchHistory();
                    }
                });
                
                activeSocket.on('typing:update', (status) => {
                    if(status.bookingId===bookingId)setIsTyping(status.isTyping);
                });
                activeSocket.on('message:edited',fetchHistory);activeSocket.on('message:deleted',fetchHistory);activeSocket.on('access:revoked',()=>setError('Conversation access has been restricted.'));

                setSocket(activeSocket);
                
                // 3. Mark as read if we have conversation ID
                if (res.data.conversation) {
                    await axios.put(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${res.data.conversation._id}/read`, {
                        lastReadMessageId: res.data.messages[res.data.messages.length - 1]?._id,
                        lastReadSequenceNumber: res.data.messages[res.data.messages.length - 1]?.sequenceNumber
                    }, { withCredentials: true }).catch(() => {});
                }

            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load chat');
            } finally {
                setLoading(false);
            }
        };

        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`, { withCredentials: true });
                setMessages(res.data.messages || []);
                setConversationId(res.data.conversation?._id||null);
                
                if (res.data.conversation && res.data.messages.length > 0) {
                     axios.put(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${res.data.conversation._id}/read`, {
                        lastReadMessageId: res.data.messages[res.data.messages.length - 1]?._id,
                        lastReadSequenceNumber: res.data.messages[res.data.messages.length - 1]?.sequenceNumber
                    }, { withCredentials: true }).catch(() => {});
                }
            } catch (e) {
                console.error(e);
            }
        };

        initializeChat();

        return () => {
            if (activeSocket) {
                activeSocket.emit('leave_conversation', { roomId: `conversation:${bookingId}` });
                activeSocket.disconnect();
            }
        };
    }, [bookingId, user?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage;
        setNewMessage('');
        
        // Optimistic UI update
        const tempMsg = {
            _id: `temp-${Date.now()}`,
            bodySafe: text,
            senderId: user?.id,
            sentAt: new Date().toISOString(),
            isTemp: true
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`, {
                text,
                clientMessageId: tempMsg._id
            }, { withCredentials: true });
            
            // Re-fetch to get real sequence numbers and DB ID
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`, { withCredentials: true });
            setMessages(res.data.messages || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send message');
            setMessages(prev => prev.filter(m => m._id !== tempMsg._id));
            setNewMessage(text); // Put text back
        }
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (socket) {
            socket.emit(e.target.value.length > 0?'typing:start':'typing:stop', { bookingId });
        }
    };
    const editMessage=async msg=>{const text=prompt('Edit message',msg.bodySafe);if(!text||!conversationId)return;await axios.patch(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${conversationId}/messages/${msg._id}`,{text},{withCredentials:true,headers:{'Idempotency-Key':crypto.randomUUID()}});const res=await axios.get(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`,{withCredentials:true});setMessages(res.data.messages||[])};
    const removeMessage=async msg=>{if(!conversationId||!confirm('Remove this message?'))return;await axios.post(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${conversationId}/messages/${msg._id}/delete`,{reasonCode:'SENDER_REQUEST'},{withCredentials:true,headers:{'Idempotency-Key':crypto.randomUUID()}});setMessages(v=>v.map(x=>x._id===msg._id?{...x,bodySafe:'Message removed',deletedAt:new Date().toISOString()}:x))};
    const reportMessage=async msg=>{if(!conversationId)return;const reasonCode=prompt('Report reason: ABUSE, HARASSMENT, THREAT, SPAM, FRAUD_ATTEMPT, PERSONAL_INFORMATION, OFF_PLATFORM_PAYMENT, INAPPROPRIATE_CONTENT, OTHER','SPAM');if(!reasonCode)return;await axios.post(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${conversationId}/messages/${msg._id}/report`,{reasonCode,description:'Reported from conversation UI'},{withCredentials:true});setError('Message report submitted for moderation.')};
    const attach=async e=>{const file=e.target.files?.[0];if(!file||!conversationId)return;const contentBase64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});try{const uploaded=await axios.post(`${import.meta.env.VITE_API_URL}/v1/chat/conversations/${conversationId}/attachments`,{fileName:file.name,mimeType:file.type,contentBase64},{withCredentials:true});await axios.post(`${import.meta.env.VITE_API_URL}/v1/chat/bookings/${bookingId}/messages`,{text:`Attachment: ${uploaded.data.attachment.fileName}`,attachmentIds:[uploaded.data.attachment.id],clientMessageId:crypto.randomUUID()},{withCredentials:true});}catch(err){setError(err.response?.data?.message||'Attachment rejected.')}};

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-[#E7E0D8] overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E0D8] bg-[#FFFBF7]">
                <div>
                    <h3 className="font-semibold text-[#1C1917]">{participantName || 'Chat'}</h3>
                    <p className="text-xs text-[#78716C]">Booking #{bookingId.substring(bookingId.length - 6)}</p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-[#F4EFE6] rounded-full text-[#44403C] transition-colors">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF6F0]">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader className="animate-spin text-[#E87A1E]" size={24} />
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center p-6 text-center text-[#DC2626]">
                        <AlertCircle className="mx-auto mb-2" size={24} />
                        <p>{error}</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#A8A29E]">
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => {
                            const isMe = msg.senderId === user?.id;
                            return (
                                <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div 
                                        className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                                            isMe 
                                                ? 'bg-[#E87A1E] text-white rounded-tr-sm' 
                                                : 'bg-white border border-[#E7E0D8] text-[#1C1917] rounded-tl-sm'
                                        } ${msg.isTemp ? 'opacity-70' : 'opacity-100'}`}
                                    >
                                        <p className="whitespace-pre-wrap break-words">{msg.bodySafe}</p>
                                    </div>
                                    <span className="text-[10px] text-[#A8A29E] mt-1 px-1">
                                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {msg.isTemp && ' • Sending...'}
                                    </span>
                                    {!msg.isTemp&&!msg.deletedAt&&<div className="flex gap-2 text-[9px] mt-1">{isMe?<><button onClick={()=>editMessage(msg)}>Edit</button><button onClick={()=>removeMessage(msg)}>Remove</button></>:<button onClick={()=>reportMessage(msg)}>Report</button>}</div>}
                                </div>
                            );
                        })}
                        {isTyping && (
                            <div className="flex items-start">
                                <div className="bg-white border border-[#E7E0D8] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-[#A8A29E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[#E7E0D8] bg-white">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <label className="p-2 text-[#78716C] hover:text-[#E87A1E] cursor-pointer" title="Attach JPEG, PNG, WebP or PDF"><Paperclip size={20}/><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={attach}/></label>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={handleTyping}
                        placeholder={error ? "Chat disabled" : "Type a message..."}
                        disabled={!!error || loading}
                        className="flex-1 input-field-style rounded-full px-4 py-2"
                    />
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim() || !!error || loading}
                        className="p-2 rounded-full bg-[#E87A1E] text-white hover:bg-[#D97706] disabled:opacity-50 disabled:hover:bg-[#E87A1E] transition-colors"
                    >
                        <Send size={18} className="ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat;
