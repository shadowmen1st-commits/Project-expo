import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../utils/api';
import {
    ArrowLeft, Navigation, MapPin, Phone, ShieldCheck, Clock,
    AlertCircle, CheckCircle2, RefreshCw, User, Car, Zap,
    Send, Radio, Compass, Wifi, WifiOff
} from 'lucide-react';
import { WorkerAvatar } from '../components/WorkerAvatar';

// Calculate distance between two coordinates in Kilometers (Haversine formula)
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Earth radius in km
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

// Estimate travel duration in minutes (assume average city speed of ~25 km/h)
const estimateEtaMinutes = (distanceKm) => {
    if (!distanceKm || distanceKm <= 0) return 1;
    const speedKmh = 25;
    const hours = distanceKm / speedKmh;
    return Math.max(1, Math.round(hours * 60));
};

export const LiveTrackingPage = () => {
    const { id: bookingId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [booking, setBooking] = useState(null);
    const [workerLocation, setWorkerLocation] = useState(null);
    const [customerCoords, setCustomerCoords] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [errorCode, setErrorCode] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [lastPingTime, setLastPingTime] = useState(null);
    const [isSharingGps, setIsSharingGps] = useState(false);
    const [gpsError, setGpsError] = useState('');

    const socketRef = useRef(null);
    const pollingTimerRef = useRef(null);
    const watchPositionIdRef = useRef(null);

    // ── 1. Fetch initial booking & tracking data ──────────────────────
    const fetchTrackingData = useCallback(async (isSilent = false) => {
        if (!bookingId) return;
        if (!isSilent) setLoading(true);
        setError('');
        setErrorCode(null);

        try {
            const res = await api.get(`/v1/bookings/${bookingId}/tracking`);
            if (res.data?.success) {
                const b = res.data.booking;
                setBooking(b);

                // Set initial worker location if available
                if (res.data.latestLocation) {
                    setWorkerLocation(res.data.latestLocation);
                    setLastPingTime(new Date(res.data.latestLocation.timestamp || Date.now()));
                }

                // Resolve customer destination coordinates
                const addr = res.data.addressSnapshot;
                if (addr?.latitude && addr?.longitude) {
                    setCustomerCoords({ latitude: addr.latitude, longitude: addr.longitude });
                } else {
                    // Fallback default coordinates if not provided in address snapshot (Bangalore default center)
                    setCustomerCoords({ latitude: 12.9716, longitude: 77.5946 });
                }
            } else {
                setError(res.data?.message || 'Failed to load tracking data.');
            }
        } catch (err) {
            const status = err.response?.status;
            setErrorCode(status);
            if (status === 404) {
                setError('Tracking information is not available yet.');
            } else if (status === 401 || status === 403) {
                setError('You are not authorized to view live tracking for this booking.');
            } else {
                setError(err.response?.data?.message || 'Connection lost. Retrying...');
            }
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [bookingId]);

    // ── 2. Poll for latest worker location (8-second fallback) ────────
    const pollWorkerLocation = useCallback(async () => {
        if (!bookingId) return;
        try {
            const res = await api.get(`/v1/bookings/${bookingId}/location`);
            if (res.data?.success && res.data.location) {
                setWorkerLocation(res.data.location);
                setLastPingTime(new Date(res.data.location.timestamp || Date.now()));
            }
        } catch (err) {
            // Polling silently catches network hiccups
        }
    }, [bookingId]);

    // ── 3. Worker: Share Live GPS Position ─────────────────────────────
    const startSharingGps = () => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser.');
            return;
        }
        setIsSharingGps(true);
        setGpsError('');

        watchPositionIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude, heading, speed, accuracy } = position.coords;
                const locData = {
                    latitude,
                    longitude,
                    heading: heading || 0,
                    speed: speed || 0,
                    accuracy: accuracy || 0,
                };
                setWorkerLocation({ ...locData, timestamp: new Date() });
                setLastPingTime(new Date());

                // 1. Post to REST API
                try {
                    await api.post(`/v1/bookings/${bookingId}/location`, locData);
                } catch (e) {
                    // non-blocking
                }

                // 2. Emit over socket for instant zero-latency broadcast
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('location:update', {
                        bookingId,
                        ...locData,
                    });
                }
            },
            (err) => {
                console.warn('Geolocation watch error:', err);
                setGpsError(err.message || 'Unable to retrieve your location.');
                setIsSharingGps(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000,
            }
        );
    };

    const stopSharingGps = () => {
        if (watchPositionIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchPositionIdRef.current);
            watchPositionIdRef.current = null;
        }
        setIsSharingGps(false);
    };

    // ── 4. Lifecycle: Socket.IO connection & 8-second polling setup ───
    useEffect(() => {
        fetchTrackingData();

        // Setup Socket.IO
        const socketUrl = API_BASE_URL ? API_BASE_URL.replace('/api', '') : 'http://localhost:5000';
        const token = localStorage.getItem('accessToken');

        const socket = io(socketUrl, {
            auth: { token },
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setSocketConnected(true);
            socket.emit('join_tracking', { bookingId }, (ack) => {
                console.log('[TRACKING:SOCKET_JOINED]', ack);
            });
        });

        socket.on('disconnect', () => {
            setSocketConnected(false);
        });

        socket.on('location:updated', (payload) => {
            if (payload && String(payload.bookingId) === String(bookingId)) {
                setWorkerLocation({
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    heading: payload.heading || 0,
                    speed: payload.speed || 0,
                    accuracy: payload.accuracy || 0,
                    timestamp: payload.timestamp || new Date(),
                });
                setLastPingTime(new Date(payload.timestamp || Date.now()));
            }
        });

        // Setup 8-second polling fallback (only runs when socket is disconnected)
        pollingTimerRef.current = setInterval(() => {
            if (!socketRef.current?.connected) {
                pollWorkerLocation();
            }
        }, 8000);

        return () => {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            if (watchPositionIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchPositionIdRef.current);
            }
            if (socket) {
                socket.off('location:updated');
                socket.emit('leave_tracking', { bookingId });
                socket.disconnect();
            }
        };
    }, [bookingId, fetchTrackingData, pollWorkerLocation]);

    // Computed metrics
    const distanceKm =
        workerLocation && customerCoords
            ? calculateDistanceKm(
                  workerLocation.latitude,
                  workerLocation.longitude,
                  customerCoords.latitude,
                  customerCoords.longitude
              )
            : null;

    const etaMinutes = distanceKm !== null ? estimateEtaMinutes(distanceKm) : null;

    const isWorker =
        user &&
        booking &&
        (user.id === booking.workerId?.id ||
            user.id === booking.workerId?._id ||
            user.id === booking.workerId);

    // ── Render States ────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFDF5] flex flex-col items-center justify-center p-4">
                <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-xs font-bold text-[#44403C] tracking-wide animate-pulse">
                    Connecting to live GPS tracking...
                </p>
            </div>
        );
    }

    if (error && !booking) {
        return (
            <div className="min-h-screen bg-[#FFFDF5] flex items-center justify-center p-6 text-[#111827]">
                <div className="max-w-md w-full bg-white border border-[#FEF3C7] rounded-3xl p-6 shadow-xl text-center space-y-4">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-base font-bold text-[#1C1917]">
                        {errorCode === 404
                            ? 'Tracking Not Ready'
                            : errorCode === 403
                            ? 'Access Restricted'
                            : 'Connection Error'}
                    </h2>
                    <p className="text-xs text-[#78716C] leading-relaxed">{error}</p>
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-1/2 bg-white border border-[#E7E0D8] text-[#44403C] hover:bg-[#FEFCE8] font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={() => fetchTrackingData()}
                            className="w-1/2 btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const workerObj = booking?.worker || booking?.workerId;
    const status = booking?.bookingStatus || 'PAID';

    return (
        <div className="min-h-screen bg-[#FFFDF5] text-[#111827] flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white border-b border-[#FEF3C7] px-4 py-3 sticky top-0 z-40 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-8 h-8 rounded-xl bg-[#FFFDF5] border border-[#FEF3C7] flex items-center justify-center text-[#44403C] hover:bg-[#FEFCE8] transition cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xs font-black text-[#1C1917] tracking-tight">Live Tracking</h1>
                            <span className="font-mono text-[10px] text-[#78716C]">#{booking?.bookingNumber}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                            {socketConnected ? (
                                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                                    <Wifi className="w-3 h-3" /> Live Socket
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                    <WifiOff className="w-3 h-3" /> Polling Mode (8s)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]">
                        {status.replace(/_/g, ' ')}
                    </span>
                </div>
            </header>

            {/* Main Content: Map Container & Tracking Panel */}
            <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Visual Live GPS Radar / Route Visualizer */}
                <div className="lg:col-span-2 bg-slate-950 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between relative overflow-hidden shadow-2xl min-h-[380px]">
                    {/* Radar Grid Background */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.1)_0,transparent_70%)] pointer-events-none"></div>
                    <div
                        className="absolute inset-0 opacity-15 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(#F97316 1px, transparent 1px)',
                            backgroundSize: '24px 24px',
                        }}
                    ></div>

                    {/* Top Status Overlay */}
                    <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-3.5 py-2 flex items-center gap-2.5">
                            <Compass className="w-4 h-4 text-[#F97316]" style={{ transform: `rotate(${workerLocation?.heading || 0}deg)` }} />
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distance</div>
                                <div className="text-sm font-black text-white">
                                    {distanceKm !== null ? `${distanceKm} km` : 'Locating GPS...'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-3.5 py-2 flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated ETA</div>
                                <div className="text-sm font-black text-emerald-400">
                                    {etaMinutes !== null ? `~${etaMinutes} min` : 'Calculating...'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-3.5 py-2 flex items-center gap-2.5">
                            <Navigation className="w-4 h-4 text-sky-400" />
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Speed</div>
                                <div className="text-sm font-black text-sky-400">
                                    {workerLocation?.speed ? (workerLocation.speed * 3.6).toFixed(1) : '0'} km/h
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Temporary Signal Unavailable Notice */}
                    {!workerLocation && (
                        <div className="relative z-10 bg-amber-500/20 border border-amber-500/40 rounded-2xl p-3 my-2 text-xs text-amber-200 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span>Waiting for professional location...</span>
                        </div>
                    )}

                    {/* Interactive Simulated Route Track */}
                    <div className="relative z-10 my-auto py-8 flex flex-col items-center justify-center">
                        <div className="relative w-full max-w-md h-32 flex items-center justify-between px-6">
                            {/* Connection Track Line */}
                            <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.5)]"></div>

                            {/* Worker Marker */}
                            <div className="relative flex flex-col items-center z-10 group">
                                <div 
                                    className="w-12 h-12 rounded-2xl bg-[#F97316] text-white flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.8)] border-2 border-white transition-transform duration-300"
                                    style={{ transform: `rotate(${workerLocation?.heading || 0}deg)` }}
                                >
                                    <Car className="w-6 h-6" />
                                </div>
                                <span className="mt-2 text-[10px] font-black text-orange-400 bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-800">
                                    Worker ({workerObj?.name?.split(' ')[0] || 'Partner'})
                                </span>
                                {workerLocation ? (
                                    <span className="text-[8px] text-slate-500 font-mono mt-0.5">
                                        {workerLocation.latitude.toFixed(4)}, {workerLocation.longitude.toFixed(4)}
                                    </span>
                                ) : (
                                    <span className="text-[8px] text-amber-400/80 font-mono mt-0.5">
                                        Awaiting GPS
                                    </span>
                                )}
                            </div>

                            {/* Center Live Pulsing Signal */}
                            <div className="relative flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-amber-400/20 animate-ping absolute"></div>
                                <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
                            </div>

                            {/* Customer Destination Marker */}
                            <div className="relative flex flex-col items-center z-10">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.8)] border-2 border-white">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <span className="mt-2 text-[10px] font-black text-emerald-400 bg-slate-900/90 px-2 py-0.5 rounded-full border border-slate-800">
                                    Destination
                                </span>
                                {customerCoords && (
                                    <span className="text-[8px] text-slate-500 font-mono mt-0.5">
                                        {customerCoords.latitude.toFixed(4)}, {customerCoords.longitude.toFixed(4)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Metadata & Last Ping Bar */}
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-3">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Destination: {booking?.serviceAddress || 'Customer Service Location'}</span>
                        </div>
                        <div>
                            Last GPS Ping:{' '}
                            <span className="font-mono text-slate-200">
                                {lastPingTime ? lastPingTime.toLocaleTimeString() : 'Awaiting signal'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Info & Actions Sidebar */}
                <div className="space-y-4 flex flex-col">
                    {/* Worker Profile Card */}
                    <div className="bg-white border border-[#FEF3C7] rounded-3xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-3.5">
                            <WorkerAvatar worker={workerObj} size="lg" showBadge />
                            <div className="space-y-0.5">
                                <h3 className="font-black text-sm text-[#111827]">{workerObj?.name || 'Assigned Partner'}</h3>
                                <div className="text-xs text-[#F97316] font-bold">{booking?.category?.name || 'Verified Professional'}</div>
                                <div className="flex items-center gap-1 text-[10px] text-[#78716C]">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Background Verified</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#FEF3C7] text-xs">
                            <div className="bg-[#FFFDF5] border border-[#FEF3C7] p-2.5 rounded-2xl">
                                <div className="text-[10px] text-[#78716C] font-semibold uppercase">Payment</div>
                                <div className="font-black text-emerald-600 mt-0.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>PAID</span>
                                </div>
                            </div>
                            <div className="bg-[#FFFDF5] border border-[#FEF3C7] p-2.5 rounded-2xl">
                                <div className="text-[10px] text-[#78716C] font-semibold uppercase">Scheduled</div>
                                <div className="font-bold text-[#1C1917] mt-0.5 text-[11px] truncate">
                                    {booking?.scheduledStart ? new Date(booking.scheduledStart).toLocaleDateString() : 'Today'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Worker GPS Sharing Control (Only visible if logged-in user is the assigned worker) */}
                    {isWorker && (
                        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-[#F97316]" />
                                    <span>Worker GPS Controls</span>
                                </h4>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isSharingGps ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {isSharingGps ? 'Broadcasting GPS' : 'GPS Idle'}
                                </span>
                            </div>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                                Share your browser GPS so the customer can track your live location on their screen in real-time.
                            </p>
                            {gpsError && (
                                <p className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                                    {gpsError}
                                </p>
                            )}
                            <button
                                onClick={isSharingGps ? stopSharingGps : startSharingGps}
                                className={`w-full py-2.5 rounded-xl font-black text-xs cursor-pointer transition shadow-sm ${isSharingGps ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary-gradient'}`}
                            >
                                {isSharingGps ? 'Stop Sharing GPS' : 'Start Live GPS Sharing'}
                            </button>
                        </div>
                    )}

                    {/* Service & Address Details */}
                    <div className="bg-white border border-[#FEF3C7] rounded-3xl p-5 shadow-sm space-y-3 text-xs flex-1">
                        <h4 className="font-bold text-xs text-[#1C1917] uppercase tracking-wider">Service Address</h4>
                        <div className="bg-[#FFFDF5] border border-[#FEF3C7] p-3 rounded-2xl flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
                            <div className="space-y-0.5 text-xs text-[#44403C]">
                                <p className="font-bold text-[#1C1917]">{booking?.serviceAddress || 'Customer Address'}</p>
                                {booking?.addressSnapshot?.instructions && (
                                    <p className="text-[10px] text-[#78716C] italic">
                                        Note: {booking.addressSnapshot.instructions}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-[#FFFDF5] hover:bg-[#FEFCE8] text-[#44403C] border border-[#E7E0D8] font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LiveTrackingPage;
