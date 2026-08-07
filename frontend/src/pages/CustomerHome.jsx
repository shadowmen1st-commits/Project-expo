import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    Search, Star, AlertCircle, ShoppingBag, X, Car, Home, Heart, Activity,
    Smile, Utensils, Leaf, Sparkles, Wrench, Zap, Sparkle, Clock, CheckCircle2,
    Calendar, ShieldAlert
} from 'lucide-react';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import CustomerReviewCard from '../components/CustomerReviewCard';
import Chat from '../components/chat/Chat';

const getCategoryIcon = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('driver')) return Car;
    if (n.includes('housekeeping')) return Home;
    if (n.includes('senior')) return Heart;
    if (n.includes('patient')) return Activity;
    if (n.includes('baby') || n.includes('child')) return Smile;
    if (n.includes('cook') || n.includes('food')) return Utensils;
    if (n.includes('garden') || n.includes('lawn')) return Leaf;
    if (n.includes('clean')) return Sparkles;
    if (n.includes('plumb')) return Wrench;
    if (n.includes('elect')) return Zap;
    return Sparkle;
};

export const CustomerHome = () => {
    const { user, logout } = useAuth();
    const [categories, setCategories] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [searchSkill, setSearchSkill] = useState('');
    const [maxDistance, setMaxDistance] = useState(15);
    const [maxPrice, setMaxPrice] = useState('');

    const sliderRef = useRef(null);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragScrollLeft = useRef(0);
    const didDrag = useRef(false);

    const onSliderMouseDown = useCallback((e) => {
        if (!sliderRef.current) return;
        isDragging.current = true;
        didDrag.current = false;
        dragStartX.current = e.pageX - sliderRef.current.offsetLeft;
        dragScrollLeft.current = sliderRef.current.scrollLeft;
        sliderRef.current.style.cursor = 'grabbing';
    }, []);

    const onSliderMouseMove = useCallback((e) => {
        if (!isDragging.current || !sliderRef.current) return;
        e.preventDefault();
        const x = e.pageX - sliderRef.current.offsetLeft;
        const walk = (x - dragStartX.current) * 1.4;
        if (Math.abs(walk) > 4) didDrag.current = true;
        sliderRef.current.scrollLeft = dragScrollLeft.current - walk;
    }, []);

    const onSliderMouseUp = useCallback(() => {
        isDragging.current = false;
        if (sliderRef.current) sliderRef.current.style.cursor = 'grab';
    }, []);

    const onSliderLeave = useCallback(() => {
        isDragging.current = false;
        if (sliderRef.current) sliderRef.current.style.cursor = 'grab';
    }, []);

    const guardClick = useCallback((fn) => {
        if (didDrag.current) {
            didDrag.current = false;
            return;
        }
        fn();
    }, []);

    const [bookings, setBookings] = useState([]);
    const [bookingTab, setBookingTab] = useState('ALL');
    const [walletBalance, setWalletBalance] = useState(0);
    const [lat] = useState(12.9716);
    const [lng] = useState(77.5946);

    const [selectedWorker, setSelectedWorker] = useState(null);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingTime, setBookingTime] = useState('');
    const [bookingDuration, setBookingDuration] = useState(2);
    const [pricingType] = useState('HOURLY');
    const [notes, setNotes] = useState('');
    // Category selected specifically for booking (from the chosen worker's categories)
    const [selectedBookingCategory, setSelectedBookingCategory] = useState('');

    // Availability & Server Quote State
    const [isCheckingSlot, setIsCheckingSlot] = useState(false);
    const [slotAvailable, setSlotAvailable] = useState(null);
    const [slotError, setSlotError] = useState('');
    const [activeQuote, setActiveQuote] = useState(null);
    const [quoteTimeLeft, setQuoteTimeLeft] = useState(0);
    const [createdBooking, setCreatedBooking] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [chatBooking,setChatBooking]=useState(null);

    useEffect(() => {
        fetchCategories();
        fetchBookings();
        fetchWallet();
    }, []);

    useEffect(() => {
        searchWorkersList();
    }, [selectedCategory, maxDistance, maxPrice]);

    // Quote expiration timer countdown effect
    useEffect(() => {
        if (!activeQuote || !activeQuote.expiresAt) return;
        const interval = setInterval(() => {
            const diff = Math.max(0, Math.floor((new Date(activeQuote.expiresAt).getTime() - Date.now()) / 1000));
            setQuoteTimeLeft(diff);
            if (diff === 0) {
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [activeQuote]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            if (res.data.success) {
                setCategories(res.data.categories);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchWallet = async () => {
        try {
            const res = await api.get('/wallet/details');
            if (res.data.success) {
                setWalletBalance(res.data.balances?.available || 0);
            }
        } catch (err) {
            console.error('Error fetching wallet balance:', err);
        }
    };

    const fetchBookings = async () => {
        try {
            const res = await api.get('/v1/bookings/customer');
            if (res.data.success) {
                setBookings(res.data.bookings || []);
            }
        } catch (err) {
            console.error('Error fetching bookings:', err);
        }
    };

    const searchWorkersList = async () => {
        setLoading(true);
        try {
            const params = {
                latitude: lat,
                longitude: lng,
                maxDistanceKm: maxDistance,
            };
            if (selectedCategory) params.categoryId = selectedCategory;
            if (searchSkill) params.skill = searchSkill;
            if (maxPrice) params.maxPrice = Number(maxPrice) * 100;

            const res = await api.get('/workers/search', { params });
            if (res.data.success) {
                setWorkers(res.data.data || []);
            }
        } catch (err) {
            console.error('Error searching workers:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBookingPrepare = (worker) => {
        setSelectedWorker(worker);
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        setBookingDate(tomorrow.toISOString().split('T')[0]);
        setBookingTime('09:00');
        setBookingDuration(2);
        setNotes('');
        setSlotAvailable(null);
        setSlotError('');
        setActiveQuote(null);
        setCreatedBooking(null);
        // Auto-select the worker's first category, falling back to global filter
        const workerCatIds = worker.serviceCategoryIds || [];
        const firstWorkerCat = workerCatIds[0];
        const firstWorkerCatId = typeof firstWorkerCat === 'object' ? firstWorkerCat?._id || firstWorkerCat?.toString() : firstWorkerCat;
        setSelectedBookingCategory(
            firstWorkerCatId ||
            (selectedCategory && workerCatIds.some(id => (id?._id || id)?.toString() === selectedCategory) ? selectedCategory : '') ||
            categories[0]?._id ||
            ''
        );
    };

    const handleCheckAvailability = async () => {
        if (!selectedWorker || !bookingDate || !bookingTime) return;
        if (!selectedBookingCategory) {
            setSlotError('Please select a service category for this booking.');
            return;
        }
        setIsCheckingSlot(true);
        setSlotError('');
        setSlotAvailable(null);
        setActiveQuote(null);

        try {
            const start = new Date(`${bookingDate}T${bookingTime}:00`);
            const end = new Date(start.getTime() + bookingDuration * 60 * 60 * 1000);

            // 1. Check availability
            const availRes = await api.post('/v1/bookings/availability/check', {
                workerId: selectedWorker.workerId,
                serviceCategoryId: selectedBookingCategory,
                scheduledStart: start.toISOString(),
                scheduledEnd: end.toISOString(),
                pricingType,
            });

            if (availRes.data.success && availRes.data.available) {
                setSlotAvailable(true);

                // 2. Fetch Authoritative Server-Side Price Quote
                const quoteRes = await api.post('/v1/pricing/quote', {
                    workerId: selectedWorker.workerId,
                    serviceCategoryId: selectedBookingCategory,
                    scheduledStart: start.toISOString(),
                    scheduledEnd: end.toISOString(),
                    pricingType,
                });

                if (quoteRes.data.success) {
                    setActiveQuote(quoteRes.data);
                    const diff = Math.max(0, Math.floor((new Date(quoteRes.data.expiresAt).getTime() - Date.now()) / 1000));
                    setQuoteTimeLeft(diff);
                }
            }
        } catch (err) {
            setSlotAvailable(false);
            setSlotError(err.response?.data?.message || 'Selected time slot or pricing quote unavailable.');
        } finally {
            setIsCheckingSlot(false);
        }
    };

    const handleCreateBooking = async () => {
        if (!selectedWorker || !activeQuote) return;
        if (quoteTimeLeft <= 0) {
            setError('Price quote has expired. Please recalculate quote.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const start = new Date(`${bookingDate}T${bookingTime}:00`);
            const end = new Date(start.getTime() + bookingDuration * 60 * 60 * 1000);

            const res = await api.post('/v1/bookings', {
                quoteId: activeQuote.quoteId,
                workerId: selectedWorker.workerId,
                serviceCategoryId: selectedBookingCategory,
                serviceAddress: '123 Tech Park Road, Bengaluru',
                scheduledStart: start.toISOString(),
                scheduledEnd: end.toISOString(),
                pricingType,
                customerNotes: notes,
            });

            if (res.data.success) {
                setCreatedBooking(res.data.booking);
                setSuccess(res.data.message || 'Booking created successfully. Payment setup pending.');
                fetchBookings();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create booking.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        try {
            const res = await api.post(`/v1/bookings/${bookingId}/cancel`, {
                reason: 'Cancelled by customer',
            });
            if (res.data.success) {
                setSuccess('Booking cancelled successfully.');
                fetchBookings();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel booking.');
        }
    };

    const handleConfirmCompletion = async (bookingId) => {
        try {
            const res = await api.post(`/v1/bookings/${bookingId}/confirm-completion`);
            if (res.data.success) {
                setSuccess('Job completion confirmed!');
                fetchBookings();
                fetchWallet();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to confirm completion.');
        }
    };

    const filteredBookings = bookings.filter((b) => {
        if (bookingTab === 'PAYMENT_PENDING') return b.bookingStatus === 'PAYMENT_PENDING';
        if (bookingTab === 'UPCOMING') return ['ACCEPTED', 'CONFIRMED', 'PAID'].includes(b.bookingStatus);
        if (bookingTab === 'ACTIVE') return ['WORKER_EN_ROUTE', 'STARTED'].includes(b.bookingStatus);
        if (bookingTab === 'COMPLETION_REQUESTED') return b.bookingStatus === 'COMPLETION_REQUESTED';
        if (bookingTab === 'COMPLETED') return b.bookingStatus === 'COMPLETED';
        if (bookingTab === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(b.bookingStatus);
        return true;
    });

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] font-sans">
            {/* Top Navigation */}
            <nav className="border-b border-[#FEF3C7] bg-[#FFFBEB]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl logo-gradient flex items-center justify-center font-black text-white text-base shadow-sm">
                        H
                    </div>
                    <span className="font-extrabold text-[#111827] text-xl tracking-tight">HyperLocal<span className="text-[#F97316]">.</span></span>
                    <span className="bg-[#FFEDD5] text-[#F97316] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#FED7AA] shadow-sm">
                        Customer
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-[10px] text-[#4B5563] font-semibold uppercase">Wallet Balance</div>
                        <div className="text-sm font-extrabold text-[#F97316]">₹{(walletBalance / 100).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#111827]">{user?.name}</span>
                        <button
                            onClick={logout}
                            className="bg-white hover:bg-[#FEF9C3] text-[#374151] border border-[#FEF3C7] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <UserCategoryBanner />

            {/* Dashboard Container */}
            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    <div>
                        <h1 className="text-2xl font-extrabold text-[#111827] tracking-tight">Find Local Professionals</h1>
                        <p className="text-[#4B5563] text-sm mt-1">Discover verified providers matching your exact needs and schedule.</p>
                    </div>

                    <HomeBannerCarousel onActionClick={(categoryName) => {
                        const match = categories.find(c => c.name.toLowerCase().includes(categoryName.toLowerCase()));
                        if (match) setSelectedCategory(match._id);
                    }}/>

                    {success && (
                        <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] text-sm p-4 rounded-xl flex items-center justify-between">
                            <span>{success}</span>
                            <button onClick={() => setSuccess('')} className="text-[#16A34A] hover:opacity-80"><X className="w-4 h-4"/></button>
                        </div>
                    )}

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-sm p-4 rounded-xl flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="text-[#DC2626] hover:opacity-80"><X className="w-4 h-4"/></button>
                        </div>
                    )}

                    {/* Service Categories Slider */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#374151] uppercase tracking-wider">Service Categories</span>
                        </div>

                        <div className="relative">
                            <div
                                ref={sliderRef}
                                onMouseDown={onSliderMouseDown}
                                onMouseMove={onSliderMouseMove}
                                onMouseUp={onSliderMouseUp}
                                onMouseLeave={onSliderLeave}
                                className="flex items-center gap-2.5 overflow-x-auto pb-2 select-none"
                            >
                                <button
                                    onClick={() => guardClick(() => setSelectedCategory(''))}
                                    className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-4 rounded-full text-xs font-semibold border cursor-pointer transition-all ${!selectedCategory ? 'bg-gradient-to-r from-[#FACC15] to-[#F97316] border-transparent text-[#111827] shadow-md font-bold' : 'bg-white border-[#FEF3C7] text-[#4B5563] hover:border-[#FCD34D] hover:bg-[#FEF9C3]/20'}`}
                                >
                                    All Services
                                </button>
                                {categories.map((cat) => {
                                    const IconComponent = getCategoryIcon(cat.name);
                                    const isActive = selectedCategory === cat._id;
                                    return (
                                        <button
                                            key={cat._id}
                                            onClick={() => guardClick(() => setSelectedCategory(cat._id))}
                                            className={`flex-shrink-0 flex items-center gap-2 py-2 px-4 rounded-full text-xs font-semibold border cursor-pointer transition-all ${isActive ? 'bg-gradient-to-r from-[#FACC15] to-[#F97316] border-transparent text-[#111827] shadow-md font-bold' : 'bg-white border-[#FEF3C7] text-[#4B5563] hover:border-[#FCD34D] hover:bg-[#FEF9C3]/20'}`}
                                        >
                                            <IconComponent className="w-3.5 h-3.5"/>
                                            {cat.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white border border-[#FEF3C7] rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-md shadow-orange-50/50">
                        <div>
                            <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-2">Distance Radius</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min={1} max={50} value={maxDistance} onChange={(e) => setMaxDistance(Number(e.target.value))} className="w-full h-1.5 bg-[#FFFBEB] rounded-lg appearance-none cursor-pointer accent-[#F97316]"/>
                                <span className="text-xs font-bold text-[#F97316] flex-shrink-0">{maxDistance} km</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-2">Search Skill</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A8A29E]"/>
                                <input type="text" placeholder="e.g. Laundry" value={searchSkill} onChange={(e) => setSearchSkill(e.target.value)} onBlur={searchWorkersList} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 text-[#111827] transition-all py-2 pl-9 pr-3 text-xs outline-none"/>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-2">Max Rate (₹/hr)</label>
                            <input type="number" placeholder="500" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 text-[#111827] transition-all py-2 px-3 text-xs outline-none"/>
                        </div>
                    </div>

                    {/* Workers Grid */}
                    <div className="space-y-4">
                        <span className="text-xs font-semibold text-[#374151] uppercase tracking-wider block">Available Verified Workers</span>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2].map((n) => <div key={n} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 h-40 animate-pulse"/>)}
                            </div>
                        ) : workers.length === 0 ? (
                            <div className="bg-white border border-[#E7E0D8] rounded-2xl p-8 text-center space-y-2 shadow-sm">
                                <AlertCircle className="w-8 h-8 text-[#A8A29E] mx-auto"/>
                                <h3 className="text-[#1C1917] font-bold text-sm">No Workers Found</h3>
                                <p className="text-[#78716C] text-xs">Try adjusting your distance radius or search skills.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {workers.map((worker) => (
                                    <div key={worker.workerId} className="bg-white border border-[#FEF3C7] hover:border-[#F97316]/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md hover:shadow-orange-100/40 hover:-translate-y-0.5 duration-300">
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-[#FFEDD5] border border-[#FED7AA] flex items-center justify-center font-bold text-[#F97316] text-sm">
                                                        {worker.name ? worker.name[0] : 'W'}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="font-bold text-[#111827] text-sm">{worker.name}</h3>
                                                            {worker.verificationBadge && (
                                                                <span className="bg-[#F0FDF4] text-[#16A34A] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-[#86EFAC] shadow-sm">
                                                                    Verified
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-[#4B5563]">Exp: {worker.experienceYears} Yrs</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-[#EA580C] text-xs font-bold bg-[#FEF9C3] px-2 py-0.5 rounded-full border border-[#FCD34D] shadow-sm">
                                                    <Star className="w-3.5 h-3.5 fill-current"/>
                                                    {worker.averageRating > 0 ? worker.averageRating.toFixed(1) : 'N/A'}
                                                </div>
                                            </div>
                                            <p className="text-[#78716C] text-xs line-clamp-2 mb-4 leading-relaxed">{worker.bio}</p>
                                        </div>

                                        <div className="pt-3 border-t border-[#FEF3C7] flex items-center justify-between mt-auto">
                                            <div>
                                                <span className="block text-[9px] text-[#9CA3AF] font-semibold uppercase">Hourly Rate</span>
                                                <span className="text-sm font-extrabold text-[#F97316]">₹{(worker.hourlyRate / 100).toFixed(0)} <span className="text-[10px] font-normal text-[#4B5563]">/hr</span></span>
                                            </div>
                                            <button onClick={() => handleBookingPrepare(worker)} className="btn-primary-gradient font-bold text-xs py-2 px-4 rounded-xl cursor-pointer">
                                                Book Worker
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Booking History & Modal */}
                <div className="space-y-8">
                    {/* Booking History Card */}
                    <div className="bg-white border border-[#FEF3C7] rounded-3xl p-6 space-y-4 shadow-md shadow-orange-50/50">
                        <div className="flex items-center justify-between border-b border-[#FEF3C7] pb-3">
                            <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-[#F97316]"/>
                                My Bookings
                            </h2>
                            <span className="bg-[#FFEDD5] text-[#F97316] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#FED7AA]">
                                {bookings.length} Total
                            </span>
                        </div>

                        {/* Booking Category Tabs */}
                        <div className="flex flex-wrap gap-1 border-b border-[#FEF3C7] pb-2 text-[10px] font-bold">
                            {['ALL', 'PAYMENT_PENDING', 'UPCOMING', 'ACTIVE', 'COMPLETION_REQUESTED', 'COMPLETED', 'CANCELLED'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setBookingTab(tab)}
                                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${bookingTab === tab ? 'bg-[#F97316] text-white shadow-sm' : 'text-[#4B5563] hover:bg-[#FFFBEB]'}`}
                                >
                                    {tab.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {filteredBookings.length === 0 ? (
                            <div className="text-center py-6 text-xs text-[#4B5563]">
                                No bookings found in this category.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {filteredBookings.map((b) => (
                                    <div key={b.id} className="bg-[#FFFDF5] border border-[#FEF3C7] rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-mono text-[#4B5563] font-semibold">{b.bookingNumber}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${b.bookingStatus === 'COMPLETED' ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]' : ['CANCELLED', 'REJECTED'].includes(b.bookingStatus) ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]' : ['PENDING', 'REQUESTED', 'PAYMENT_PENDING'].includes(b.bookingStatus) ? 'bg-[#FEF9C3] border-[#FCD34D] text-[#CA8A04]' : 'bg-[#FFEDD5] border-[#FED7AA] text-[#F97316]'}`}>
                                                {b.bookingStatus}
                                            </span>
                                        </div>

                                        <div className="text-xs space-y-0.5">
                                            <div className="font-bold text-[#111827]">Worker: {b.worker?.name || 'Assigned Professional'}</div>
                                            <div className="text-[#4B5563] text-[10px]">{b.category?.name || 'Service'}</div>
                                            <div className="text-[#9CA3AF] text-[10px]">Start: {new Date(b.scheduledStart).toLocaleString()}</div>
                                            <div className="text-[#F97316] font-bold text-[11px] pt-1">Total: ₹{(b.totalAmount / 100).toFixed(2)}</div>
                                        </div>

                                        {b.bookingStatus === 'PAYMENT_PENDING' && (
                                            <div className="space-y-2">
                                                <div className="bg-[#FEF9C3] border border-[#FCD34D] p-2 rounded-xl text-[10px] text-[#CA8A04] flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 flex-shrink-0"/>
                                                    <span>Booking created. Secure payment setup is pending.</span>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        setError('');
                                                        setSuccess('');
                                                        try {
                                                            // 1. Get payment order from backend
                                                            const randKey = `idemp-${b.id}-${Date.now()}`;
                                                            const res = await api.post('/v1/payments/orders', 
                                                                { bookingId: b.id },
                                                                { headers: { 'Idempotency-Key': randKey } }
                                                            );
                                                            if (!res.data.success) {
                                                                throw new Error(res.data.message || 'Failed to create payment order');
                                                            }
                                                            const orderData = res.data.data;
                                                            
                                                            // 2. Load Razorpay script if not present
                                                            if (!window.Razorpay) {
                                                                await new Promise((resolve, reject) => {
                                                                    const script = document.createElement('script');
                                                                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                                                                    script.async = true;
                                                                    script.onload = resolve;
                                                                    script.onerror = reject;
                                                                    document.body.appendChild(script);
                                                                });
                                                            }

                                                            // 3. Open Razorpay options
                                                            const options = {
                                                                key: orderData.publicKeyId,
                                                                amount: orderData.amount,
                                                                currency: orderData.currency,
                                                                name: 'HyperLocal Service',
                                                                description: `Payment for booking ${orderData.bookingNumber}`,
                                                                order_id: orderData.razorpayOrderId,
                                                                handler: async function (response) {
                                                                    setLoading(true);
                                                                    try {
                                                                        const verifyRes = await api.post('/v1/payments/verify', {
                                                                            internalPaymentOrderId: orderData.internalPaymentOrderId,
                                                                            razorpay_order_id: response.razorpay_order_id,
                                                                            razorpay_payment_id: response.razorpay_payment_id,
                                                                            razorpay_signature: response.razorpay_signature
                                                                        });
                                                                        if (verifyRes.data.success) {
                                                                            setSuccess('Payment verified successfully! Refreshing status...');
                                                                            fetchBookings();
                                                                        }
                                                                    } catch (err) {
                                                                        setError(err.response?.data?.message || 'Payment verification failed.');
                                                                    } finally {
                                                                        setLoading(false);
                                                                    }
                                                                },
                                                                modal: {
                                                                    ondismiss: function () {
                                                                        setError('Payment checkout cancelled.');
                                                                    }
                                                                },
                                                                theme: { color: '#F97316' }
                                                            };
                                                            const rzp = new window.Razorpay(options);
                                                            rzp.open();
                                                        } catch (err) {
                                                            setError(err.response?.data?.message || err.message || 'Payment initiation failed.');
                                                        }
                                                    }}
                                                    disabled={loading}
                                                    className="w-full btn-primary-gradient font-bold text-[10px] py-1.5 rounded-lg cursor-pointer"
                                                >
                                                    {loading ? 'Processing...' : 'Pay Now'}
                                                </button>
                                            </div>
                                        )}

                                        {b.paymentStatus === 'PAID' && (
                                            <div className="bg-[#F0FDF4] border border-[#86EFAC] p-2 rounded-xl text-[10px] text-[#16A34A] flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0"/>
                                                <span>Payment verified. Pending worker acceptance.</span>
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-1 border-t border-[#E7E0D8]">
                                            {['ACCEPTED','CONFIRMED','WORKER_EN_ROUTE','STARTED','COMPLETION_REQUESTED','COMPLETED','DISPUTED'].includes(b.bookingStatus)&&<button onClick={()=>setChatBooking(b)} className="w-full bg-white border border-[#F97316] text-[#F97316] hover:bg-[#FFEDD5] font-bold text-[10px] py-1.5 rounded-lg">Chat</button>}
                                            {['PAYMENT_PENDING', 'REQUESTED', 'PAID', 'ACCEPTED', 'CONFIRMED'].includes(b.bookingStatus) && (
                                                <button onClick={() => handleCancelBooking(b.id)} className="w-full bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 font-bold text-[10px] py-1.5 rounded-lg cursor-pointer">
                                                    Cancel Booking
                                                </button>
                                            )}
                                            {b.bookingStatus === 'COMPLETION_REQUESTED' && (
                                                <button onClick={() => handleConfirmCompletion(b.id)} className="w-full btn-primary-gradient font-bold text-[10px] py-1.5 rounded-lg cursor-pointer">
                                                    Confirm Job Completion
                                                </button>
                                            )}
                                        </div>
                                        {b.bookingStatus === 'COMPLETED' && <CustomerReviewCard bookingId={b.id}/>} 
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Booking Modal */}
                    {selectedWorker && (
                        <div className="bg-white border border-[#FEF3C7] rounded-3xl p-6 space-y-4 shadow-md shadow-orange-50/50">
                            <div className="flex items-center justify-between border-b border-[#FEF3C7] pb-3">
                                <h3 className="font-bold text-[#111827] text-sm">Booking: {selectedWorker.name}</h3>
                                <button onClick={() => setSelectedWorker(null)} className="text-[#4B5563] hover:text-[#111827] cursor-pointer"><X className="w-4 h-4"/></button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Select Date</label>
                                    <input type="date" value={bookingDate} onChange={(e) => { setBookingDate(e.target.value); setSlotAvailable(null); }} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl py-2 px-3 text-[#111827] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all text-xs outline-none"/>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Start Time</label>
                                        <input type="time" value={bookingTime} onChange={(e) => { setBookingTime(e.target.value); setSlotAvailable(null); }} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl py-2 px-3 text-[#111827] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all text-xs outline-none"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Duration (Hrs)</label>
                                        <input type="number" min={1} max={12} value={bookingDuration} onChange={(e) => { setBookingDuration(Number(e.target.value)); setSlotAvailable(null); }} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl py-2 px-3 text-[#111827] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all text-xs outline-none"/>
                                    </div>
                                </div>

                                {/* Service Category Selector — all categories, worker's own highlighted first */}
                                <div>
                                    <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Service Type</label>
                                    {categories.length === 0 ? (
                                        <p className="text-[10px] text-[#A8A29E] mt-1">Loading categories…</p>
                                    ) : (() => {
                                        const workerCatIds = new Set(
                                            (selectedWorker.serviceCategoryIds || []).map(id =>
                                                typeof id === 'object' ? (id?._id || id)?.toString() : id?.toString()
                                            ).filter(Boolean)
                                        );
                                        const workerCats  = categories.filter(c => workerCatIds.has(c._id?.toString()));
                                        const otherCats   = categories.filter(c => !workerCatIds.has(c._id?.toString()));
                                        return (
                                            <select
                                                value={selectedBookingCategory}
                                                onChange={(e) => {
                                                    setSelectedBookingCategory(e.target.value);
                                                    setSlotAvailable(null);
                                                    setActiveQuote(null);
                                                }}
                                                className="w-full bg-[#FFFDF5] border border-[#FEF3C7] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all rounded-xl py-2 px-3 text-[#111827] text-xs outline-none cursor-pointer"
                                            >
                                                <option value="">-- Select Service --</option>

                                                {/* Worker's speciality categories first */}
                                                {workerCats.length > 0 && (
                                                    <optgroup label="⭐ Worker's Speciality">
                                                        {workerCats.map(cat => (
                                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {/* All other categories */}
                                                {otherCats.length > 0 && (
                                                    <optgroup label="All Other Services">
                                                        {otherCats.map(cat => (
                                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Special Notes</label>
                                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Provide special instructions..." className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl py-2 px-3 text-[#111827] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all text-xs outline-none resize-none"/>
                                </div>

                                {/* Slot Check Status Messages */}
                                {slotError && (
                                    <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-3 rounded-xl flex items-start gap-2">
                                        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                        <span>{slotError}</span>
                                    </div>
                                )}

                                {slotAvailable && activeQuote && (
                                    <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 p-3.5 rounded-xl text-xs text-[#16A34A] space-y-2">
                                        <div className="flex items-center justify-between font-bold">
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-4 h-4"/>
                                                <span>Time Slot Available</span>
                                            </div>
                                            <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${quoteTimeLeft > 60 ? 'bg-[#FFEDD5] text-[#F97316] border-[#FED7AA]' : 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30'}`}>
                                                <Clock className="w-3 h-3"/>
                                                <span>Quote expires in {Math.floor(quoteTimeLeft / 60)}m {quoteTimeLeft % 60}s</span>
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-[#44403C] space-y-1 pt-1.5 border-t border-[#16A34A]/20">
                                            <div className="flex justify-between">
                                                <span>Base Service Amount:</span>
                                                <span>₹{activeQuote.breakdown.baseAmountRupees.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Platform Fee:</span>
                                                <span>₹{activeQuote.breakdown.platformFeeRupees.toFixed(2)}</span>
                                            </div>
                                            {activeQuote.breakdown.taxAmountRupees > 0 && (
                                                <div className="flex justify-between">
                                                    <span>GST Tax (18%):</span>
                                                    <span>₹{activeQuote.breakdown.taxAmountRupees.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {activeQuote.breakdown.discountAmountRupees > 0 && (
                                                <div className="flex justify-between text-[#16A34A]">
                                                    <span>Discount:</span>
                                                    <span>-₹{activeQuote.breakdown.discountAmountRupees.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-extrabold text-[#F97316] text-xs pt-1 border-t border-[#FEF3C7]">
                                                <span>Total Payable:</span>
                                                <span>₹{activeQuote.breakdown.totalAmountRupees.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {createdBooking ? (
                                    <div className="bg-[#FFEDD5] border border-[#FED7AA] p-4 rounded-2xl text-center space-y-2">
                                        <Clock className="w-6 h-6 text-[#F97316] mx-auto"/>
                                        <h4 className="font-bold text-xs text-[#111827]">Booking Created!</h4>
                                        <p className="text-[10px] text-[#4B5563]">Booking number <span className="font-mono font-bold text-[#1C1917]">{createdBooking.bookingNumber}</span> generated in <span className="font-bold text-[#EAB308]">PAYMENT_PENDING</span> state.</p>
                                        <div className="text-[10px] font-semibold text-[#F97316] pt-1">Secure payment setup is pending.</div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleCheckAvailability}
                                            disabled={isCheckingSlot}
                                            className="w-full bg-white border border-[#F97316] hover:bg-[#FFEDD5] text-[#F97316] font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
                                        >
                                            {isCheckingSlot ? 'Checking Slot Availability...' : 'Check Availability & Price Preview'}
                                        </button>

                                        {slotAvailable && (
                                            <button
                                                onClick={handleCreateBooking}
                                                disabled={loading}
                                                className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                            >
                                                {loading ? 'Creating Booking...' : 'Confirm & Create Booking'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {chatBooking&&<div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="w-full max-w-xl h-[70vh]"><Chat bookingId={chatBooking.id} participantName={chatBooking.worker?.name||'Assigned Worker'} onClose={()=>setChatBooking(null)}/></div></div>}
        </div>
    );
};

export default CustomerHome;
