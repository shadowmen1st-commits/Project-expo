import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
    Calendar, Search, Filter, RefreshCw, Navigation, MapPin,
    User, Briefcase, DollarSign, Clock, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { formatBookingDateIST, formatBookingAmount, isTrackableBookingStatus, normalizeBookingStatus, resolveBookingId } from '../utils/formatters';

const STATUS_FILTERS = [
    'ALL',
    'PAYMENT_PENDING',
    'PAID',
    'CONFIRMED',
    'WORKER_EN_ROUTE',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
];

const TERMINAL_STATUSES = [
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
];

const TRACKABLE_STATUSES = [
    'PAID',
    'CONFIRMED',
    'ASSIGNED',
    'ACCEPTED',
    'WORKER_EN_ROUTE',
    'EN_ROUTE',
    'ARRIVED',
    'STARTED',
    'IN_PROGRESS',
];

export const AdminBookingsPanel = () => {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalBookings, setTotalBookings] = useState(0);
    const [limit] = useState(15);
    const [error, setError] = useState('');

    const searchTimerRef = useRef(null);

    const handleSearch = (e) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = {
                page,
                limit,
            };
            if (selectedStatus !== 'ALL') {
                params.status = selectedStatus;
            }
            if (debouncedSearch.trim()) {
                params.search = debouncedSearch.trim();
            }

            const res = await api.get('/v1/bookings/admin', { params }).catch(() => null);

            if (res && res.data?.success) {
                console.log('[WEB ADMIN BOOKINGS API]', {
                    status: res?.status,
                    success: res?.data?.success,
                    count: res?.data?.bookings?.length,
                    firstBooking: res?.data?.bookings?.[0],
                });
                setBookings(res.data.bookings || []);
                if (res.data.pagination) {
                    setTotalPages(res.data.pagination.totalPages || 1);
                    setTotalBookings(res.data.pagination.total || 0);
                }
            } else {
                // Fallback to /bookings
                const fallbackRes = await api.get('/v1/bookings', { params });
                console.log('[WEB GENERAL BOOKINGS FALLBACK]', fallbackRes?.status, fallbackRes?.data);
                const list = Array.isArray(fallbackRes.data)
                    ? fallbackRes.data
                    : fallbackRes.data?.bookings || [];
                setBookings(list);
                setTotalBookings(list.length);
                setTotalPages(1);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch platform bookings.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, selectedStatus, debouncedSearch]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-white border border-[#FEF3C7] rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-black text-[#1C1917] flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[#F97316]" />
                            <span>Platform Bookings Management</span>
                        </h2>
                        <p className="text-xs text-[#78716C] mt-0.5">
                            Full visibility and live tracking access across all customers and workers. ({totalBookings} total)
                        </p>
                    </div>

                    <button
                        onClick={fetchBookings}
                        className="bg-[#FFFDF5] hover:bg-[#FEFCE8] border border-[#FED7AA] text-[#F97316] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Search and Filters Bar */}
                <div className="flex flex-col md:flex-row items-center gap-3 pt-2">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by booking #, customer name/email, worker name, ID..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="w-full pl-9 pr-4 py-2 text-xs border border-[#E7E0D8] rounded-xl focus:outline-none focus:border-[#F97316] bg-[#FFFDF5]"
                        />
                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        {STATUS_FILTERS.map((status) => {
                            const isSelected = selectedStatus === status;
                            return (
                                <button
                                    key={status}
                                    onClick={() => {
                                        setSelectedStatus(status);
                                        setPage(1);
                                    }}
                                    className={`text-[11px] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                                        isSelected
                                            ? 'bg-[#F97316] text-white shadow-xs'
                                            : 'bg-[#FFFDF5] border border-[#E7E0D8] text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'
                                    }`}
                                >
                                    {status.replace(/_/g, ' ')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white border border-[#FEF3C7] rounded-3xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-xs font-bold text-[#78716C] flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading platform bookings...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-xs text-red-600 font-bold bg-red-50/50">
                        {error}
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="p-12 text-center text-xs text-[#78716C] font-medium space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p>No bookings found matching current filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#FFFDF5] border-b border-[#FEF3C7] text-[#78716C] font-black uppercase text-[10px] tracking-wider">
                                    <th className="py-3.5 px-4">Booking # / ID</th>
                                    <th className="py-3.5 px-4">Customer</th>
                                    <th className="py-3.5 px-4">Worker</th>
                                    <th className="py-3.5 px-4">Service</th>
                                    <th className="py-3.5 px-4">Amount</th>
                                    <th className="py-3.5 px-4">Booking Status</th>
                                    <th className="py-3.5 px-4">Location Telemetry</th>
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#FEF3C7]">
                                {bookings.map((b, index) => {
                                    const rawStatus =
                                        b.bookingStatus ??
                                        b.status ??
                                        b.booking_status ??
                                        b.currentStatus ??
                                        '';
                                    const status = String(rawStatus).trim().toUpperCase();
                                    const bookingId = String(
                                        b._id ??
                                        b.id ??
                                        b.bookingId ??
                                        ''
                                    ).trim();
                                    const bId = bookingId || `booking-row-${index}`;
                                    const customer = b.customer || b.customerId;
                                    const worker = b.worker || b.workerId;
                                    const category = b.category || b.serviceCategoryId;
                                    const isTrackable =
                                        Boolean(bookingId) &&
                                        TRACKABLE_STATUSES.includes(status) &&
                                        !TERMINAL_STATUSES.includes(status);

                                    console.log('[BOOKING LIVE TRACK DEBUG]', {
                                        id: bookingId,
                                        rawStatus,
                                        normalizedStatus: status,
                                        isTrackable,
                                        latestLocation: b.latestLocation,
                                        workerLocation: b.workerLocation,
                                    });

                                    const amountStr = formatBookingAmount(b);
                                    const dateStr = formatBookingDateIST(b.scheduledStart || b.bookingDate || b.createdAt);

                                    return (
                                        <tr key={bId} className="hover:bg-[#FEFCE8]/50 transition-colors">
                                            {/* Booking Number */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-[#1C1917]">
                                                    #{b.bookingNumber || String(bId).substring(0, 8)}
                                                </div>
                                                <div className="font-mono text-[9px] text-[#78716C]">{bId}</div>
                                            </td>

                                            {/* Customer */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
                                                    <User className="w-3 h-3 text-[#F97316]" />
                                                    <span>{customer?.name || 'Customer'}</span>
                                                </div>
                                                <div className="text-[10px] text-[#78716C]">{customer?.email || customer?.phone || 'N/A'}</div>
                                            </td>

                                            {/* Worker */}
                                            <td className="py-3 px-4">
                                                {worker ? (
                                                    <div>
                                                        <div className="font-bold text-[#1C1917] flex items-center gap-1.5">
                                                            <Briefcase className="w-3 h-3 text-emerald-600" />
                                                            <span>{worker.name}</span>
                                                        </div>
                                                        <div className="text-[10px] text-[#78716C]">{worker.phone || worker.email || ''}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-[#A8A29E] italic">Unassigned</span>
                                                )}
                                            </td>

                                            {/* Service Category */}
                                            <td className="py-3 px-4 font-semibold text-[#44403C]">
                                                {category?.name || b.serviceCategoryName || 'General Service'}
                                            </td>

                                            {/* Amount */}
                                            <td className="py-3 px-4 font-black text-[#1C1917]">
                                                ₹{amountStr}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3 px-4">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                        status === 'COMPLETED'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : status === 'IN_PROGRESS' || status === 'WORKER_EN_ROUTE'
                                                            ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                                                            : status === 'CONFIRMED' || status === 'PAID'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : status === 'CANCELLED' || status === 'REJECTED'
                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}
                                                >
                                                    {status.replace(/_/g, ' ')}
                                                </span>
                                            </td>

                                            {/* Location Telemetry */}
                                            <td className="py-3 px-4">
                                                {b.latestLocation ? (
                                                    <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                                                        <span>{b.latestLocation.latitude.toFixed(3)}, {b.latestLocation.longitude.toFixed(3)}</span>
                                                    </div>
                                                ) : isTrackable ? (
                                                    <span className="text-[10px] text-amber-600 font-medium">Awaiting GPS</span>
                                                ) : (
                                                    <span className="text-[10px] text-[#A8A29E]">No Telemetry</span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="py-3 px-4 text-[11px] text-[#78716C]">
                                                {dateStr}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                {isTrackable && bookingId ? (
                                                    <div className="track-action-container">
                                                        <button
                                                            type="button"
                                                            className="live-tracking-btn"
                                                            onClick={() => {
                                                                console.log('[LIVE TRACK CLICK]', {
                                                                    bookingId,
                                                                    status,
                                                                    bookingNumber: b.bookingNumber,
                                                                });

                                                                navigate(`/admin/tracking/${bookingId}`);
                                                            }}
                                                        >
                                                            🧭 Live Track
                                                        </button>

                                                        {!b.latestLocation && !b.workerLocation && (
                                                            <div className="waiting-gps">
                                                                Waiting for worker GPS
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-[#A8A29E] italic">N/A</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Bar */}
                {!loading && totalPages > 1 && (
                    <div className="bg-[#FFFDF5] border-t border-[#FEF3C7] px-4 py-3 flex items-center justify-between text-xs text-[#78716C]">
                        <span>
                            Page <strong className="text-[#1C1917]">{page}</strong> of <strong className="text-[#1C1917]">{totalPages}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded-lg border border-[#E7E0D8] bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-1.5 rounded-lg border border-[#E7E0D8] bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminBookingsPanel;
