import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import SharedNavbar from '../components/SharedNavbar';
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Calendar,
    MapPin,
    Shield,
    ShieldCheck,
    CreditCard,
    User,
    Compass,
    FileText,
    HelpCircle,
    ChevronRight,
    Sparkles,
    AlertCircle
} from 'lucide-react';
import { WorkerAvatar } from '../components/WorkerAvatar';

export const BookingDetailsPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchBooking = async () => {
            if (!id) return;
            setLoading(true);
            setError('');
            try {
                const res = await api.get(`/bookings/${id}`);
                if (res.data?.success && res.data?.booking) {
                    setBooking(res.data.booking);
                } else if (res.data?.booking) {
                    setBooking(res.data.booking);
                } else {
                    setError('Unable to load booking details.');
                }
            } catch (err) {
                console.error('Error fetching booking details:', err);
                const msg = err.response?.data?.message || 'Failed to retrieve booking information.';
                setError(msg);
            } finally {
                setLoading(false);
            }
        };

        fetchBooking();
    }, [id]);

    const formatISTDate = (dateStr, timeStr) => {
        if (!dateStr) return 'Scheduled Date';
        try {
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            return `${formattedDate}${timeStr ? ` at ${timeStr}` : ''}`;
        } catch {
            return `${dateStr} ${timeStr || ''}`;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFDF9] text-[#1C1917] font-sans flex flex-col">
                <SharedNavbar />
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-semibold text-[#78716C]">Loading booking details...</p>
                </div>
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-[#FFFDF9] text-[#1C1917] font-sans flex flex-col">
                <SharedNavbar />
                <div className="flex-1 max-w-lg mx-auto w-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-red-100">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-[#1C1917] mb-2">Booking Not Found</h2>
                    <p className="text-sm text-[#78716C] mb-6">{error || 'The requested booking could not be retrieved.'}</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const workerName = booking.worker?.name || (typeof booking.workerId === 'object' ? booking.workerId?.name : 'Verified Professional');
    const categoryName = booking.category?.name || (typeof booking.serviceCategoryId === 'object' ? booking.serviceCategoryId?.name : 'Professional Service');
    const totalRupees = booking.totalAmount ? (booking.totalAmount > 1000 ? (booking.totalAmount / 100).toFixed(0) : booking.totalAmount) : '749';
    const baseRupees = booking.baseAmount ? (booking.baseAmount > 1000 ? (booking.baseAmount / 100).toFixed(0) : booking.baseAmount) : '700';
    const platformRupees = booking.platformFee ? (booking.platformFee > 1000 ? (booking.platformFee / 100).toFixed(0) : booking.platformFee) : '49';
    const durationHours = booking.durationMinutes ? Math.round(booking.durationMinutes / 60) : 2;

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] font-sans pb-20">
            <SharedNavbar />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28">
                {/* Top Navigation & Status Banner */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[#78716C] hover:text-[#1C1917] bg-white border border-[#E7E0D8] px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>

                    <Link
                        to={`/booking/${id}/tracking`}
                        className="inline-flex items-center gap-2 text-xs font-bold text-white bg-[#F97316] hover:bg-orange-600 px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                        <Compass className="w-4 h-4" />
                        Live GPS Tracking
                    </Link>
                </div>

                {/* Primary Card */}
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 sm:p-8 shadow-sm mb-6 relative overflow-hidden">
                    {/* Background Decorative Gradient */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E7E0D8]">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1.5">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-[#A8A29E]">
                                    Booking Reference
                                </span>
                                <span className="font-mono text-sm font-black text-[#1C1917] bg-[#FEFCE8] border border-[#FEF08A] px-2.5 py-0.5 rounded-lg">
                                    #{booking.bookingNumber || id}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-[#1C1917]">
                                {categoryName}
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Payment Status Badge */}
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {booking.paymentStatus || 'PAID'}
                            </span>

                            {/* Booking Status Badge */}
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                {booking.bookingStatus || 'CONFIRMED'}
                            </span>

                            {/* Escrow Status Badge */}
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                ESCROW PROTECTED
                            </span>
                        </div>
                    </div>

                    {/* Schedule & Timing Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-[#E7E0D8]">
                        <div className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E7E0D8]/60">
                            <Calendar className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
                            <div>
                                <div className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-wider">Scheduled Date</div>
                                <div className="text-sm font-black text-[#1C1917] mt-0.5">
                                    {formatISTDate(booking.bookingDate, booking.bookingTime)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E7E0D8]/60">
                            <Clock className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
                            <div>
                                <div className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-wider">Service Duration</div>
                                <div className="text-sm font-black text-[#1C1917] mt-0.5">
                                    {durationHours} {durationHours === 1 ? 'Hour' : 'Hours'}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E7E0D8]/60">
                            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-[11px] font-bold text-[#A8A29E] uppercase tracking-wider">Total Paid</div>
                                <div className="text-sm font-black text-emerald-700 mt-0.5">
                                    ₹{totalRupees}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Professional & Location Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        {/* Assigned Professional */}
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">
                                Assigned Professional
                            </div>
                            <div className="flex items-center gap-4 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E7E0D8]/60">
                                <WorkerAvatar
                                    name={workerName}
                                    profileImage={booking.worker?.profileImage}
                                    className="w-12 h-12 rounded-xl"
                                />
                                <div>
                                    <div className="text-base font-black text-[#1C1917]">{workerName}</div>
                                    <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-0.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Verified Expert Technician
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Service Location */}
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">
                                Service Address
                            </div>
                            <div className="flex items-start gap-3 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E7E0D8]/60 h-[calc(100%-24px)]">
                                <MapPin className="w-5 h-5 text-[#F97316] shrink-0 mt-0.5" />
                                <div className="text-xs sm:text-sm font-medium text-[#44403C] leading-relaxed">
                                    {booking.serviceAddress ||
                                        (booking.addressSnapshot
                                            ? `${booking.addressSnapshot.houseNumber || ''}, ${booking.addressSnapshot.street || ''}, ${booking.addressSnapshot.city || ''} - ${booking.addressSnapshot.pincode || ''}`
                                            : 'Service Location Address Provided')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial Summary & Escrow Protection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Price Breakdown */}
                    <div className="md:col-span-2 bg-white border border-[#E7E0D8] rounded-3xl p-6 shadow-sm">
                        <h2 className="text-base font-black text-[#1C1917] mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#F97316]" />
                            Payment Receipt Breakdown
                        </h2>
                        <div className="space-y-3 text-xs sm:text-sm">
                            <div className="flex justify-between py-1.5 border-b border-[#F5F1EB] text-[#78716C]">
                                <span>Base Service Rate ({durationHours} hrs)</span>
                                <span className="font-bold text-[#1C1917]">₹{baseRupees}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-[#F5F1EB] text-[#78716C]">
                                <span>Platform Convenience Fee</span>
                                <span className="font-bold text-[#1C1917]">₹{platformRupees}</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-[#F5F1EB] text-[#78716C]">
                                <span>Taxes & GST</span>
                                <span className="font-bold text-[#1C1917]">₹0</span>
                            </div>
                            <div className="flex justify-between pt-2 text-sm sm:text-base font-black text-[#1C1917]">
                                <span>Total Amount Paid</span>
                                <span className="text-emerald-600">₹{totalRupees}</span>
                            </div>
                        </div>
                    </div>

                    {/* Escrow Guarantee Info */}
                    <div className="bg-gradient-to-br from-[#FEFCE8] to-[#FFFBEB] border border-[#FEF08A] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center text-[#F97316] mb-3">
                                <Shield className="w-5 h-5 text-[#F97316]" />
                            </div>
                            <h2 className="text-sm font-black text-[#1C1917] mb-1.5">JobNest Escrow Vault</h2>
                            <p className="text-xs text-[#78716C] leading-relaxed">
                                Your payment is safely held in escrow. Funds will only be released to the technician after you inspect and approve the completed job.
                            </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-[#FEF08A]/60 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            100% Satisfaction Guarantee
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingDetailsPage;
