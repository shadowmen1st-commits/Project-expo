import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    Search, Star, AlertCircle, ShoppingBag, X, Car, Home, Heart, Activity,
    Smile, Utensils, Leaf, Sparkles, Wrench, Zap, Sparkle, Clock, CheckCircle2,
    Calendar, ShieldAlert, User, Eye
} from 'lucide-react';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import CustomerReviewCard from '../components/CustomerReviewCard';
import Chat from '../components/chat/Chat';
import UserProfileModal from '../components/UserProfileModal';
import { WorkerAvatar } from '../components/WorkerAvatar';
import ProfileAvatar from '../components/ProfileAvatar';

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
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoriesError, setCategoriesError] = useState('');
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
    const [selectedBookingCategory, setSelectedBookingCategory] = useState('');
    // Service Address fields & Booking Step
    const [houseNumber, setHouseNumber] = useState('Flat 402, Sunshine Apts');
    const [street, setStreet] = useState('123 Tech Park Road');
    const [locality, setLocality] = useState('Whitefield');
    const [city, setCity] = useState('Bengaluru');
    const [stateName, setStateName] = useState('Karnataka');
    const [pincode, setPincode] = useState('560066');
    const [addressType, setAddressType] = useState('HOME');
    const [addressInstructions, setAddressInstructions] = useState('');
    const [bookingStep, setBookingStep] = useState(1); // 1 = Details & Address, 2 = Review & Confirm

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
    const [chatBooking, setChatBooking] = useState(null);
    const [viewingProfileWorker, setViewingProfileWorker] = useState(null);

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
        setCategoriesLoading(true);
        setCategoriesError('');
        try {
            const res = await api.get('/categories');
            if (res.data.success) {
                setCategories(res.data.categories || []);
            } else {
                setCategoriesError('Unable to load services.');
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
            setCategoriesError('Unable to load services.');
        } finally {
            setCategoriesLoading(false);
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
        setHouseNumber('Flat 402, Sunshine Apts');
        setStreet('123 Tech Park Road');
        setLocality('Whitefield');
        setCity('Bengaluru');
        setStateName('Karnataka');
        setPincode('560066');
        setAddressType('HOME');
        setAddressInstructions('');
        setBookingStep(1);
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
        let catToUse = selectedBookingCategory;
        if (!catToUse) {
            const workerCatIds = selectedWorker.serviceCategoryIds || [];
            const firstWorkerCat = workerCatIds[0];
            catToUse = (typeof firstWorkerCat === 'object' ? firstWorkerCat?._id || firstWorkerCat?.toString() : firstWorkerCat) || categories[0]?._id || '';
            if (catToUse) {
                setSelectedBookingCategory(catToUse);
            }
        }
        if (!catToUse) {
            setSlotError('Please select a service category for this booking.');
            return;
        }
        if (!houseNumber || !street || !city || !stateName || !pincode) {
            setSlotError('Please fill in all required address fields.');
            return;
        }
        if (!/^\d{6}$/.test(pincode)) {
            setSlotError('PIN code must be exactly 6 digits.');
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
                    setBookingStep(2); // Advance to Booking Review Step
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
        if (!/^\d{6}$/.test(pincode)) {
            setError('PIN code must be exactly 6 digits.');
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
                addressSnapshot: {
                    houseNumber,
                    street,
                    locality,
                    landmark: locality,
                    city,
                    state: stateName,
                    pincode,
                    addressType,
                    instructions: addressInstructions,
                },
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
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] font-sans w-full overflow-x-hidden">
            {/* Top Navigation */}
            <nav className="border-b border-[#FEF3C7] bg-[#FFFBEB]/95 backdrop-blur-md sticky top-0 z-45 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl logo-gradient flex items-center justify-center font-black text-white text-base shadow-sm">
                            H
                        </div>
                        <span className="font-extrabold text-[#111827] text-xl tracking-tight">HyperLocal<span className="text-[#F97316]">.</span></span>
                        <span className="bg-[#FFEDD5] text-[#F97316] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#FED7AA] shadow-sm">
                            Customer
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t border-[#FEF3C7] sm:border-0 pt-2.5 sm:pt-0">
                    <div className="text-left sm:text-right">
                        <div className="text-[10px] text-[#4B5563] font-semibold uppercase">Wallet Balance</div>
                        <div className="text-sm font-extrabold text-[#F97316]">₹{(walletBalance / 100).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ProfileAvatar user={user} size="sm" />
                        <span className="text-xs sm:text-sm font-semibold text-[#111827] max-w-[80px] sm:max-w-[150px] truncate">{user?.name}</span>
                        <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className="bg-[#FFFDF5] hover:bg-[#FFEDD5] text-[#F97316] border border-[#FED7AA] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                        >
                            <User className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Profile & Settings</span>
                        </button>
                        <button
                            onClick={logout}
                            className="bg-white hover:bg-[#FEF9C3] text-[#374151] border border-[#FEF3C7] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-sm whitespace-nowrap"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            <UserCategoryBanner />

            {/* Dashboard Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer group"
                                                    onClick={() => setViewingProfileWorker(worker)}
                                                >
                                                    <WorkerAvatar worker={worker} size="lg" showBadge />
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="font-bold text-[#111827] text-sm group-hover:text-[#F97316] transition-colors">{worker.name}</h3>
                                                            {(worker.verificationBadge || worker.verificationStatus === 'APPROVED') && (
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
                                            <p className="text-[#78716C] text-xs line-clamp-2 mb-4 leading-relaxed">{worker.bio || 'Verified professional service provider.'}</p>
                                        </div>

                                        <div className="pt-3 border-t border-[#FEF3C7] flex items-center justify-between mt-auto">
                                            <div>
                                                <span className="block text-[9px] text-[#9CA3AF] font-semibold uppercase">Hourly Rate</span>
                                                <span className="text-sm font-extrabold text-[#F97316]">₹{((worker.hourlyRate || 0) / 100).toFixed(0)} <span className="text-[10px] font-normal text-[#4B5563]">/hr</span></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setViewingProfileWorker(worker)}
                                                    className="px-3 py-1.5 border border-[#FED7AA] bg-[#FFFDF5] hover:bg-[#FFEDD5] text-[#F97316] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Profile</span>
                                                </button>
                                                <button onClick={() => handleBookingPrepare(worker)} className="btn-primary-gradient font-bold text-xs py-2 px-4 rounded-xl cursor-pointer shadow-sm">
                                                    Book Worker
                                                </button>
                                            </div>
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

                                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-[#FEF3C7]">
                                            <WorkerAvatar worker={b.worker} size="md" showBadge />
                                            <div className="text-xs space-y-0.5">
                                                <div className="font-bold text-[#111827] flex items-center gap-1.5">
                                                    <span>{b.worker?.name || 'Assigned Professional'}</span>
                                                </div>
                                                <div className="text-[#4B5563] text-[10px]">{b.category?.name || 'Service'}</div>
                                                <div className="text-[#9CA3AF] text-[10px]">Start: {new Date(b.scheduledStart).toLocaleString()}</div>
                                                <div className="text-[#F97316] font-bold text-[11px]">Total: ₹{(b.totalAmount / 100).toFixed(2)}</div>
                                            </div>
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
                        <div className="fixed inset-0 lg:relative z-50 lg:z-0 bg-black/50 lg:bg-transparent flex items-end sm:items-center lg:items-stretch justify-center lg:justify-start p-4 lg:p-0">
                            <div className="bg-white border border-[#FEF3C7] rounded-3xl p-6 space-y-4 shadow-xl lg:shadow-md shadow-orange-50/50 w-full max-w-lg lg:max-w-none max-h-[90vh] lg:max-h-none overflow-y-auto lg:overflow-visible animate-in fade-in slide-in-from-bottom-4 lg:animate-none duration-300">
                                <div className="flex items-center justify-between border-b border-[#FEF3C7] pb-3">
                                    <div className="flex items-center gap-3">
                                        <WorkerAvatar worker={selectedWorker} size="md" showBadge />
                                        <div>
                                            <h3 className="font-bold text-[#111827] text-sm">{selectedWorker.name}</h3>
                                            <span className="text-[10px] text-[#78716C]">Step {bookingStep} of 2: {bookingStep === 1 ? 'Service Details & Address' : 'Review & Confirm'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => { setSelectedWorker(null); setBookingStep(1); }} className="text-[#4B5563] hover:text-[#111827] cursor-pointer"><X className="w-4 h-4"/></button>
                                </div>

                            {bookingStep === 1 ? (
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

                                    {/* Service Category Selector */}
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Service Type</label>
                                        {categoriesLoading ? (
                                            <p className="text-[10px] text-[#A8A29E] mt-1">Loading categories...</p>
                                        ) : categoriesError ? (
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-[10px] text-[#DC2626]">{categoriesError}</p>
                                                <button onClick={fetchCategories} className="text-[10px] text-[#F97316] hover:underline font-semibold cursor-pointer">Retry</button>
                                            </div>
                                        ) : (() => {
                                            const combinedCategories = [...categories];
                                            if (selectedWorker?.serviceCategoryIds?.length > 0) {
                                                selectedWorker.serviceCategoryIds.forEach(cat => {
                                                    if (typeof cat === 'object' && cat?._id && cat?.name) {
                                                        if (!combinedCategories.some(c => (c._id || c)?.toString() === (cat._id || cat)?.toString())) {
                                                            combinedCategories.push(cat);
                                                        }
                                                    }
                                                });
                                            }
                                            if (combinedCategories.length === 0) {
                                                return <p className="text-[10px] text-[#78716C] mt-1">No services are currently available.</p>;
                                            }

                                            const workerCatIds = new Set(
                                                (selectedWorker?.serviceCategoryIds || []).map(id =>
                                                    typeof id === 'object' ? (id?._id || id)?.toString() : id?.toString()
                                                ).filter(Boolean)
                                            );
                                            const workerCats  = combinedCategories.filter(c => workerCatIds.has((c._id || c)?.toString()));
                                            const otherCats   = combinedCategories.filter(c => !workerCatIds.has((c._id || c)?.toString()));
                                            const defaultCat  = workerCats[0]?._id || otherCats[0]?._id || '';

                                            return (
                                                <select
                                                    value={selectedBookingCategory || defaultCat}
                                                    onChange={(e) => {
                                                        setSelectedBookingCategory(e.target.value);
                                                        setSlotAvailable(null);
                                                        setActiveQuote(null);
                                                    }}
                                                    className="w-full bg-[#FFFDF5] border border-[#FEF3C7] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all rounded-xl py-2 px-3 text-[#111827] text-xs outline-none cursor-pointer"
                                                >
                                                    {!selectedBookingCategory && !defaultCat && <option value="">-- Select Service --</option>}
                                                    {workerCats.length > 0 && (
                                                        <optgroup label="⭐ Worker's Speciality">
                                                            {workerCats.map(cat => (
                                                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    )}
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

                                    {/* Service Address Form */}
                                    <div className="pt-2 border-t border-[#FEF3C7] space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-[#374151] uppercase tracking-wider">Service Delivery Address</span>
                                            <div className="flex gap-1 text-[9px] font-bold">
                                                {['HOME', 'OFFICE', 'OTHER'].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => setAddressType(type)}
                                                        className={`px-2 py-0.5 rounded-full border cursor-pointer ${addressType === type ? 'bg-[#F97316] text-white border-[#F97316]' : 'bg-white text-[#78716C] border-[#FEF3C7]'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[9px] text-[#4B5563] font-semibold mb-0.5">Flat / House No. *</label>
                                                <input type="text" placeholder="e.g. Flat 402, B Block" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-lg p-2 text-[#111827] text-xs outline-none focus:border-[#F97316]"/>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] text-[#4B5563] font-semibold mb-0.5">Street / Locality *</label>
                                                <input type="text" placeholder="e.g. 123 Tech Park Road" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-lg p-2 text-[#111827] text-xs outline-none focus:border-[#F97316]"/>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="block text-[9px] text-[#4B5563] font-semibold mb-0.5">Area / Landmark</label>
                                                <input type="text" placeholder="e.g. Near Metro" value={locality} onChange={(e) => setLocality(e.target.value)} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-lg p-2 text-[#111827] text-xs outline-none focus:border-[#F97316]"/>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] text-[#4B5563] font-semibold mb-0.5">City *</label>
                                                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-lg p-2 text-[#111827] text-xs outline-none focus:border-[#F97316]"/>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] text-[#4B5563] font-semibold mb-0.5">PIN Code (6 digits) *</label>
                                                <input type="text" maxLength={6} placeholder="560066" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`w-full bg-[#FFFDF5] border rounded-lg p-2 text-[#111827] text-xs outline-none focus:border-[#F97316] ${pincode && !/^\d{6}$/.test(pincode) ? 'border-[#DC2626] text-[#DC2626]' : 'border-[#FEF3C7]'}`}/>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#374151] uppercase tracking-wider mb-1">Special Delivery / Job Notes</label>
                                        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Provide special instructions or entry details..." className="w-full bg-[#FFFDF5] border border-[#FEF3C7] rounded-xl py-2 px-3 text-[#111827] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 transition-all text-xs outline-none resize-none"/>
                                    </div>

                                    {slotError && (
                                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-3 rounded-xl flex items-start gap-2">
                                            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                                            <span>{slotError}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCheckAvailability}
                                        disabled={isCheckingSlot}
                                        className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
                                    >
                                        {isCheckingSlot ? 'Checking Availability...' : 'Check Availability & Review Quote'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Step 2: Booking Review */}
                                    <div className="bg-[#FFFDF5] border border-[#FEF3C7] rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b border-[#FEF3C7] pb-2">
                                            <div className="flex items-center gap-3">
                                                <WorkerAvatar worker={selectedWorker} size="md" showBadge />
                                                <div>
                                                    <h4 className="font-bold text-xs text-[#111827]">{selectedWorker.name}</h4>
                                                    <span className="text-[10px] text-[#78716C]">{categories.find(c => c._id === selectedBookingCategory)?.name || 'Service'}</span>
                                                </div>
                                            </div>
                                            <span className="bg-[#F0FDF4] border border-[#86EFAC] text-[#16A34A] text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                ★ {selectedWorker.averageRating > 0 ? selectedWorker.averageRating.toFixed(1) : 'Approved'}
                                            </span>
                                        </div>

                                        <div className="text-[11px] text-[#374151] space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-[#78716C]">Scheduled Time:</span>
                                                <span className="font-semibold">{bookingDate} at {bookingTime} ({bookingDuration} hrs)</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[#78716C]">Address ({addressType}):</span>
                                                <span className="font-semibold text-right max-w-[200px] truncate">{houseNumber}, {street}, {city} - {pincode}</span>
                                            </div>
                                        </div>

                                        {activeQuote && (
                                            <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 p-3 rounded-xl text-xs space-y-1.5">
                                                <div className="flex items-center justify-between font-bold text-[#16A34A]">
                                                    <span>Guaranteed Price Quote</span>
                                                    <span className="text-[10px] text-[#F97316]">Expires in {Math.floor(quoteTimeLeft / 60)}m {quoteTimeLeft % 60}s</span>
                                                </div>
                                                <div className="text-[11px] text-[#44403C] space-y-1 pt-1 border-t border-[#16A34A]/20">
                                                    <div className="flex justify-between">
                                                        <span>Base Amount:</span>
                                                        <span>₹{activeQuote.breakdown.baseAmountRupees.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Platform Fee:</span>
                                                        <span>₹{activeQuote.breakdown.platformFeeRupees.toFixed(2)}</span>
                                                    </div>
                                                    {activeQuote.breakdown.taxAmountRupees > 0 && (
                                                        <div className="flex justify-between">
                                                            <span>GST (18%):</span>
                                                            <span>₹{activeQuote.breakdown.taxAmountRupees.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between font-extrabold text-[#F97316] text-xs pt-1 border-t border-[#FEF3C7]">
                                                        <span>Total Payable:</span>
                                                        <span>₹{activeQuote.breakdown.totalAmountRupees.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {createdBooking ? (
                                        <div className="bg-[#FFEDD5] border border-[#FED7AA] p-4 rounded-2xl text-center space-y-2">
                                            <Clock className="w-6 h-6 text-[#F97316] mx-auto"/>
                                            <h4 className="font-bold text-xs text-[#111827]">Booking Confirmed!</h4>
                                            <p className="text-[10px] text-[#4B5563]">Booking number <span className="font-mono font-bold text-[#1C1917]">{createdBooking.bookingNumber}</span> created.</p>
                                            <div className="text-[10px] font-semibold text-[#F97316] pt-1">Proceed to My Bookings to complete payment.</div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setBookingStep(1)}
                                                className="w-1/2 bg-white border border-[#E7E0D8] text-[#44403C] hover:bg-[#FEFCE8] font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                            >
                                                Edit Details
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCreateBooking}
                                                disabled={loading}
                                                className="w-1/2 btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                            >
                                                {loading ? 'Creating Booking...' : 'Confirm & Create Booking'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </div>
            {/* Worker Profile Detail Modal */}
            {viewingProfileWorker && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white border border-[#FEF3C7] rounded-3xl p-6 space-y-5 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between border-b border-[#FEF3C7] pb-3">
                            <h3 className="font-bold text-[#111827] text-base">Worker Profile</h3>
                            <button
                                onClick={() => setViewingProfileWorker(null)}
                                className="text-[#4B5563] hover:text-[#111827] cursor-pointer p-1 rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Profile Header */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left bg-[#FFFDF5] border border-[#FEF3C7] p-4 rounded-2xl">
                            <WorkerAvatar worker={viewingProfileWorker} size="2xl" showBadge />
                            <div className="space-y-1">
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <h2 className="text-lg font-extrabold text-[#111827]">{viewingProfileWorker.name}</h2>
                                    {(viewingProfileWorker.verificationBadge || viewingProfileWorker.verificationStatus === 'APPROVED') && (
                                        <span className="bg-[#F0FDF4] text-[#16A34A] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-[#86EFAC]">
                                            ✓ Verified
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-[#6B7280]">
                                    <span className="flex items-center gap-1 font-bold text-[#EA580C]">
                                        <Star className="w-3.5 h-3.5 fill-current" />
                                        {viewingProfileWorker.averageRating > 0 ? viewingProfileWorker.averageRating.toFixed(1) : 'New'}
                                    </span>
                                    <span>•</span>
                                    <span>{viewingProfileWorker.experienceYears || 0} Years Experience</span>
                                </div>
                                <p className="text-xs text-[#F97316] font-bold">
                                    ₹{((viewingProfileWorker.hourlyRate || 0) / 100).toFixed(0)} <span className="font-normal text-[#6B7280]">/ hour</span>
                                </p>
                            </div>
                        </div>

                        {/* Bio / Description */}
                        {viewingProfileWorker.bio && (
                            <div>
                                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider mb-1">About Worker</h4>
                                <p className="text-xs text-[#4B5563] leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    {viewingProfileWorker.bio}
                                </p>
                            </div>
                        )}

                        {/* Skills */}
                        {viewingProfileWorker.skills && viewingProfileWorker.skills.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider mb-2">Skills & Specializations</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {viewingProfileWorker.skills.map((s, i) => (
                                        <span key={i} className="text-xs bg-[#FFEDD5] text-[#F97316] font-semibold px-2.5 py-1 rounded-xl border border-[#FED7AA]">
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Languages */}
                        {viewingProfileWorker.languages && viewingProfileWorker.languages.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-[#374151] uppercase tracking-wider mb-1">Languages Spoken</h4>
                                <p className="text-xs text-[#4B5563]">{viewingProfileWorker.languages.join(', ')}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-3 border-t border-[#FEF3C7] flex items-center justify-end gap-3">
                            <button
                                onClick={() => setViewingProfileWorker(null)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    const target = viewingProfileWorker;
                                    setViewingProfileWorker(null);
                                    handleBookingPrepare(target);
                                }}
                                className="btn-primary-gradient font-bold text-xs py-2 px-5 rounded-xl cursor-pointer shadow-md"
                            >
                                Book This Worker
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {chatBooking && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-xl h-[70vh]">
                        <Chat
                            bookingId={chatBooking.id}
                            worker={chatBooking.worker}
                            participantName={chatBooking.worker?.name || 'Assigned Worker'}
                            onClose={() => setChatBooking(null)}
                        />
                    </div>
                </div>
            )}
            <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        </div>
    );
};

export default CustomerHome;
