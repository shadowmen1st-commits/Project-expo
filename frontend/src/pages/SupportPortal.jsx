import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Plus, MessageSquare, Clock, CheckCircle, Search } from 'lucide-react';

export const SupportPortal = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTicket, setNewTicket] = useState({ category: 'OTHER', subject: '', description: '', priority: 'NORMAL' });
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/support`, { withCredentials: true });
            setTickets(res.data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/v1/support`, newTicket, { withCredentials: true });
            setTickets([res.data, ...tickets]);
            setIsCreating(false);
            setNewTicket({ category: 'OTHER', subject: '', description: '', priority: 'NORMAL' });
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create ticket');
        }
    };

    const fetchTicketDetails = async (id) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/support/${id}`, { withCredentials: true });
            setSelectedTicket(res.data.ticket);
            setMessages(res.data.messages);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load details');
        }
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/v1/support/${selectedTicket._id}/messages`, {
                body: replyText,
                visibility: user.role === 'ADMIN' ? 'REQUESTER_VISIBLE' : undefined
            }, { withCredentials: true });
            setMessages([...messages, res.data]);
            setReplyText('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send reply');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPEN': return 'bg-blue-100 text-blue-800';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
            case 'WAITING_FOR_USER': return 'bg-yellow-100 text-[#EAB308]';
            case 'RESOLVED':
            case 'CLOSED': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 flex gap-6 h-[calc(100vh-80px)]">
            {/* Sidebar / Ticket List */}
            <div className="w-1/3 bg-white rounded-xl shadow-sm border border-[#E7E0D8] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#E7E0D8] bg-[#FFFBF7] flex justify-between items-center">
                    <h2 className="font-semibold text-lg">Support Tickets</h2>
                    <button 
                        onClick={() => { setIsCreating(true); setSelectedTicket(null); }}
                        className="p-2 bg-[#EAB308] text-white rounded-lg hover:bg-[#D97706] transition"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-[#FAF6F0] p-2 space-y-2">
                    {loading ? (
                        <p className="p-4 text-center text-[#78716C]">Loading...</p>
                    ) : tickets.length === 0 ? (
                        <p className="p-4 text-center text-[#78716C]">No support tickets found.</p>
                    ) : (
                        tickets.map(ticket => (
                            <div 
                                key={ticket._id}
                                onClick={() => { fetchTicketDetails(ticket._id); setIsCreating(false); }}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                    selectedTicket?._id === ticket._id 
                                        ? 'bg-white border-[#EAB308] shadow-sm' 
                                        : 'bg-white border-[#E7E0D8] hover:border-[#DCD4C8]'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-sm text-[#1C1917] truncate">{ticket.ticketNumber}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getStatusColor(ticket.status)}`}>
                                        {ticket.status.replace(/_/g, ' ')}
                                    </span>
                                </div>
                                <h3 className="text-sm font-semibold text-[#1C1917] truncate">{ticket.subjectSafe}</h3>
                                <div className="flex items-center gap-4 mt-2 text-xs text-[#78716C]">
                                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(ticket.lastActivityAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-[#E7E0D8] flex flex-col overflow-hidden">
                {isCreating ? (
                    <div className="p-6 overflow-y-auto">
                        <h2 className="text-2xl font-bold mb-6">Create New Ticket</h2>
                        <form onSubmit={handleCreateTicket} className="space-y-4 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium text-[#44403C] mb-1">Subject</label>
                                <input 
                                    type="text" 
                                    required 
                                    maxLength={200}
                                    value={newTicket.subject}
                                    onChange={e => setNewTicket({...newTicket, subject: e.target.value})}
                                    className="w-full input-field-style rounded-lg p-2.5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#44403C] mb-1">Category</label>
                                <select 
                                    value={newTicket.category}
                                    onChange={e => setNewTicket({...newTicket, category: e.target.value})}
                                    className="w-full input-field-style rounded-lg p-2.5"
                                >
                                    <option value="ACCOUNT">Account</option>
                                    <option value="BOOKING">Booking Issue</option>
                                    <option value="PAYMENT">Payment</option>
                                    <option value="TECHNICAL">Technical Issue</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#44403C] mb-1">Description</label>
                                <textarea 
                                    required
                                    rows={5}
                                    value={newTicket.description}
                                    onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                                    className="w-full input-field-style rounded-lg p-2.5 resize-none"
                                />
                            </div>
                            <button type="submit" className="w-full btn-primary-gradient py-3 rounded-lg font-semibold">
                                Submit Ticket
                            </button>
                        </form>
                    </div>
                ) : selectedTicket ? (
                    <>
                        <div className="p-6 border-b border-[#E7E0D8] bg-[#FFFBF7]">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-xl font-bold text-[#1C1917]">{selectedTicket.subjectSafe}</h2>
                                    <p className="text-sm text-[#78716C]">{selectedTicket.ticketNumber} • {selectedTicket.category}</p>
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(selectedTicket.status)}`}>
                                    {selectedTicket.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex-1 p-6 overflow-y-auto bg-[#FAF6F0] space-y-6">
                            {messages.map(msg => {
                                const isInternal = msg.visibility === 'INTERNAL_ONLY';
                                return (
                                    <div key={msg._id} className={`flex flex-col ${msg.senderType === user.role ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-[#44403C]">
                                                {msg.senderType.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs text-[#A8A29E]">
                                                {new Date(msg.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className={`max-w-[80%] p-4 rounded-2xl ${
                                            isInternal 
                                                ? 'bg-yellow-100 border border-yellow-300 text-yellow-900' 
                                                : msg.senderType === user.role 
                                                    ? 'bg-[#EAB308] text-white rounded-tr-sm' 
                                                    : 'bg-white border border-[#E7E0D8] text-[#1C1917] rounded-tl-sm'
                                        }`}>
                                            {isInternal && <p className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1"><AlertCircle size={12}/> Internal Note</p>}
                                            <p className="whitespace-pre-wrap">{msg.bodySafe}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' && (
                            <div className="p-4 border-t border-[#E7E0D8] bg-white">
                                <form onSubmit={handleReply} className="flex gap-2">
                                    <textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder="Type your reply..."
                                        className="flex-1 input-field-style rounded-lg p-3 resize-none h-12"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!replyText.trim()}
                                        className="px-6 rounded-lg bg-[#EAB308] text-white hover:bg-[#D97706] disabled:opacity-50 transition"
                                    >
                                        Reply
                                    </button>
                                </form>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#A8A29E]">
                        <MessageSquare size={48} className="mb-4 opacity-50" />
                        <p>Select a ticket or create a new one</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupportPortal;
