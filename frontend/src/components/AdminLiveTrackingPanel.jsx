import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
    Radio, RefreshCw, Navigation, MapPin, User, Briefcase,
    Compass, Clock, AlertCircle, ArrowUpRight, CheckCircle2
} from 'lucide-react';

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
};

const estimateEtaMinutes = (distanceKm) => {
    if (!distanceKm || distanceKm <= 0) return 1;
    const speedKmh = 25;
    const hours = distanceKm / speedKmh;
    return Math.max(1, Math.round(hours * 60));
};

export const AdminLiveTrackingPanel = () => {
    const navigate = useNavigate();
    const [activeBookings, setActiveBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState(new Date());

    const fetchLiveTracking = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError('');
        try {
            const res = await api.get('/v1/bookings/admin/live-tracking');
            if (res.data?.success) {
                setActiveBookings(res.data.activeBookings || []);
                setLastSyncTime(new Date());
            } else {
                setError(res.data?.message || 'Failed to fetch live tracking records.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Connection lost.');
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLiveTracking();
        const interval = setInterval(() => {
            fetchLiveTracking(true);
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchLiveTracking]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border border-[#FEF3C7] rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-black text-[#1C1917] flex items-center gap-2">
                        <Radio className="w-5 h-5 text-[#F97316] animate-pulse" />
                        <span>Live Field Service Tracking</span>
                    </h2>
                    <p className="text-xs text-[#78716C] mt-0.5">
                        Real-time GPS telemetry from active field workers ({activeBookings.length} active jobs). Auto-refreshes every 10s.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#78716C] font-mono">
                        Synced: {lastSyncTime.toLocaleTimeString()}
                    </span>
                    <button
                        onClick={() => fetchLiveTracking(false)}
                        className="bg-[#FFFDF5] hover:bg-[#FEFCE8] border border-[#FED7AA] text-[#F97316] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Sync Now</span>
                    </button>
                </div>
            </div>

            {/* Active Bookings Grid */}
            {loading && activeBookings.length === 0 ? (
                <div className="bg-white border border-[#FEF3C7] rounded-3xl p-12 text-center text-xs font-bold text-[#78716C] flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                    <span>Scanning platform field tracking signals...</span>
                </div>
            ) : error ? (
                <div className="bg-white border border-red-200 rounded-3xl p-8 text-center text-xs text-red-600 font-bold bg-red-50/50">
                    {error}
                </div>
            ) : activeBookings.length === 0 ? (
                <div className="bg-white border border-[#FEF3C7] rounded-3xl p-12 text-center text-xs text-[#78716C] font-medium space-y-2">
                    <Radio className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-[#1C1917]">No Active Field Jobs</p>
                    <p>There are currently no bookings in "Worker En Route" or "In Progress" status.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeBookings.map((b, idx) => {
                        const cardKey = String(b.bookingId || b._id || b.id || `tracking-card-${idx}`).trim();
                        const customerCoords =
                            b.addressSnapshot?.latitude && b.addressSnapshot?.longitude
                                ? { latitude: b.addressSnapshot.latitude, longitude: b.addressSnapshot.longitude }
                                : null;

                        const workerCoords = b.latestLocation
                            ? { latitude: b.latestLocation.latitude, longitude: b.latestLocation.longitude }
                            : null;

                        const distance =
                            workerCoords && customerCoords
                                ? calculateDistanceKm(
                                      workerCoords.latitude,
                                      workerCoords.longitude,
                                      customerCoords.latitude,
                                      customerCoords.longitude
                                  )
                                : null;

                        const eta = distance !== null ? estimateEtaMinutes(distance) : null;

                        return (
                            <div
                                key={cardKey}
                                className="bg-white border border-[#FEF3C7] rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition flex flex-col justify-between"
                            >
                                {/* Card Header */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="font-mono text-xs font-black text-[#F97316]">
                                            #{b.bookingNumber}
                                        </span>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                b.bookingStatus === 'IN_PROGRESS' || b.bookingStatus === 'WORKER_EN_ROUTE'
                                                    ? 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}
                                        >
                                            {b.bookingStatus?.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-sm text-[#1C1917]">
                                        {b.category?.name || 'Service Booking'}
                                    </h3>
                                </div>

                                {/* Radar / Telemetry Snapshot */}
                                <div className="bg-[#0F172A] rounded-2xl p-3.5 text-white space-y-2.5 border border-slate-800">
                                    <div className="flex items-center justify-between text-[10px]">
                                        <div className="flex items-center gap-1 text-slate-300">
                                            <Compass className="w-3.5 h-3.5 text-[#F97316]" />
                                            <span>Distance:</span>
                                            <strong className="text-white">{distance !== null ? `${distance} km` : 'Locating'}</strong>
                                        </div>
                                        <div className="flex items-center gap-1 text-slate-300">
                                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>ETA:</span>
                                            <strong className="text-emerald-400">{eta !== null ? `~${eta} min` : 'N/A'}</strong>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                                        <span>
                                            GPS:{' '}
                                            {b.latestLocation
                                                ? `${b.latestLocation.latitude.toFixed(3)}, ${b.latestLocation.longitude.toFixed(3)}`
                                                : 'Awaiting signal'}
                                        </span>
                                        <span>
                                            {b.latestLocation?.timestamp
                                                ? new Date(b.latestLocation.timestamp).toLocaleTimeString()
                                                : 'No Ping'}
                                        </span>
                                    </div>
                                </div>

                                {/* Parties Info */}
                                <div className="space-y-2 text-xs border-t border-[#FEF3C7] pt-3">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[#78716C] text-[10px] block">Customer</span>
                                            <span className="font-bold text-[#1C1917]">{b.customer?.name || 'Customer'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                        <div className="truncate">
                                            <span className="text-[#78716C] text-[10px] block">Assigned Worker</span>
                                            <span className="font-bold text-[#1C1917]">{b.worker?.name || 'Unassigned'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => navigate(`/admin/tracking/${b.bookingId}`)}
                                    className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
                                >
                                    <Navigation className="w-3.5 h-3.5" />
                                    <span>Open Live Tracking Map</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminLiveTrackingPanel;
