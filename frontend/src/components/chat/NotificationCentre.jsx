import React, { useState, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '');
if (!SOCKET_URL) throw new Error('VITE_SOCKET_URL or VITE_API_URL is required.');

export const NotificationCentre = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;

        const fetchNotifications = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL}/v1/notifications`, { withCredentials: true });
                const fetched = res.data.notifications || [];
                setNotifications(fetched);
                setUnreadCount(fetched.filter(n => n.status === 'UNREAD').length);
            } catch (err) {
                console.error('Failed to fetch notifications', err);
            }
        };

        fetchNotifications();

        const socket = io(SOCKET_URL, { withCredentials: true, reconnection: true });
        
        socket.on('connect', () => {
            // Already joins `user:${user.id}` on backend upon auth middleware success
        });

        socket.on('notification_event', (event) => {
            // We can fetch entirely or optimally unshift a new block
            // Simplest safe way is refetching:
            fetchNotifications();
        });

        return () => {
            socket.disconnect();
        };
    }, [user]);

    const markAllRead = async () => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/v1/notifications/mark-all-read`, {}, { withCredentials: true });
            setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' })));
            setUnreadCount(0);
        } catch (err) {
            console.error(err);
        }
    };

    const markAsRead = async (id) => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/v1/notifications/${id}/read`, {}, { withCredentials: true });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: 'READ' } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-[#44403C] hover:bg-[#F4EFE6] rounded-full transition-colors focus:outline-none"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[#DC2626] border-2 border-white rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#E7E0D8] z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E0D8] bg-[#FFFBF7]">
                        <h3 className="font-semibold text-[#1C1917]">Notifications</h3>
                        {unreadCount > 0 && (
                            <button 
                                onClick={markAllRead}
                                className="text-xs text-[#E87A1E] font-medium hover:underline flex items-center gap-1"
                            >
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto bg-[#FAF6F0]">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-[#A8A29E]">
                                <Bell className="mx-auto mb-2 opacity-50" size={24} />
                                <p className="text-sm">No notifications right now.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[#E7E0D8]">
                                {notifications.map(notification => (
                                    <div 
                                        key={notification._id} 
                                        className={`p-4 flex gap-3 ${notification.status === 'UNREAD' ? 'bg-white' : 'bg-[#FAF6F0] opacity-80'}`}
                                    >
                                        {/* Optional Icon based on category */}
                                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${notification.status === 'UNREAD' ? 'bg-[#E87A1E]' : 'bg-transparent'}`} />
                                        
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-[#1C1917] truncate">{notification.title}</p>
                                            <p className="text-sm text-[#44403C] line-clamp-2 mt-0.5">{notification.messageSafe}</p>
                                            <p className="text-xs text-[#78716C] mt-1">
                                                {new Date(notification.createdAt).toLocaleDateString()} at {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        
                                        {notification.status === 'UNREAD' && (
                                            <button 
                                                onClick={() => markAsRead(notification._id)}
                                                className="self-start p-1 text-[#A8A29E] hover:text-[#1C1917]"
                                                title="Mark as read"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t border-[#E7E0D8] bg-white text-center">
                        <button className="text-sm text-[#44403C] font-medium hover:text-[#E87A1E] transition-colors">
                            View all settings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCentre;
