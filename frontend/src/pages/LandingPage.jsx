import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SharedNavbar from '../components/SharedNavbar';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import { Sparkles, Wrench, Zap, Heart, Leaf, Paintbrush, Bath, PawPrint, ChevronRight, Search, Calendar, CreditCard, Star } from 'lucide-react';

function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([entry]) => { 
            if (entry.isIntersecting) {
                setVisible(true);
                obs.disconnect();
            } 
        }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, visible };
}

const SERVICES = [
    { icon: Sparkles, name: 'Home Cleaning', desc: 'Deep clean, regular upkeep & more' },
    { icon: Wrench, name: 'Plumbing', desc: 'Leaks, installations & pipe work' },
    { icon: Zap, name: 'Electrician', desc: 'Wiring, fittings & switchboards' },
    { icon: Heart, name: 'Massage Therapy', desc: 'Relaxation & therapeutic care' },
    { icon: Leaf, name: 'Gardening', desc: 'Lawn care, pruning & landscaping' },
    { icon: Paintbrush, name: 'Painting', desc: 'Interior & exterior painting' },
    { icon: Bath, name: 'Bathroom Work', desc: 'Renovation & sanitary fitting' },
    { icon: PawPrint, name: 'Pet Care', desc: 'Walking, grooming & sitting' },
];

const STEPS = [
    { n: '01', icon: Search, title: 'Search & Browse', desc: 'Find verified professionals near you by service, rating, or price — all in real time.' },
    { n: '02', icon: Calendar, title: 'Book Instantly', desc: 'Select a time slot, review transparent pricing, and confirm your booking in under a minute.' },
    { n: '03', icon: CreditCard, title: 'Secure Payment', desc: 'Pay safely via Razorpay. Funds held in escrow until the job is marked complete.' },
    { n: '04', icon: Star, title: 'Rate & Review', desc: 'Share your experience to help our community maintain quality standards.' },
];

const STATS = [
    { value: '50K+', label: 'Happy Customers' },
    { value: '8K+', label: 'Verified Workers' },
    { value: '120+', label: 'Cities Covered' },
    { value: '4.8★', label: 'Average Rating' },
];

const TESTIMONIALS = [
    {
        name: 'Priya Sharma', city: 'Bangalore', role: 'Customer',
        avatar: 'PS',
        text: 'Booked a deep cleaning session and the professional arrived exactly on time. The quality was exceptional — my flat looked brand new!',
        rating: 5,
    },
    {
        name: 'Rahul Mehta', city: 'Mumbai', role: 'Customer',
        avatar: 'RM',
        text: 'The electrician fixed my switchboard issue in 30 minutes flat. Transparent pricing, no hidden charges. Will definitely use again.',
        rating: 5,
    },
    {
        name: 'Ananya Iyer', city: 'Chennai', role: 'Worker',
        avatar: 'AI',
        text: 'As a caregiver, this platform gave me steady work and fair pay. The wallet system is transparent and payouts arrive on time every time.',
        rating: 5,
    },
];

const ServicesSection = ({ navigate }) => {
    const { ref, visible } = useInView();
    return (
        <section id="services" className="py-24 px-6" ref={ref}>
            <div className="max-w-7xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <p className="text-[#E87A1E] text-sm font-semibold uppercase tracking-wider mb-3">What We Offer</p>
                    <h2 className="text-4xl md:text-5xl font-black text-[#1C1917] mb-4">80+ Services, One Platform</h2>
                    <p className="text-[#78716C] max-w-xl mx-auto font-normal">From urgent repairs to regular upkeep — find the right expert for every need.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {SERVICES.map((s) => {
                        const IconComponent = s.icon;
                        return (
                            <button 
                                key={s.name} 
                                onClick={() => navigate('/services')} 
                                className="group relative bg-white border border-[#E7E0D8] hover:border-[#E87A1E]/50 rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-1 cursor-pointer outline-none shadow-sm"
                            >
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-[#E7E0D8] bg-[#FFF5EA] text-[#E87A1E]">
                                    <IconComponent className="w-5 h-5"/>
                                </div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <h3 className="text-[#1C1917] font-bold text-sm md:text-base group-hover:text-[#E87A1E] transition-colors">{s.name}</h3>
                                    <ChevronRight className="w-4 h-4 text-[#E87A1E] opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"/>
                                </div>
                                <p className="text-[#78716C] text-xs leading-relaxed">{s.desc}</p>
                            </button>
                        );
                    })}
                </div>
                <div className="text-center mt-12">
                    <button onClick={() => navigate('/services')} className="inline-flex items-center gap-2 text-[#E87A1E] hover:text-[#1C1917] text-sm font-semibold transition-colors cursor-pointer border border-[#E7E0D8] hover:border-[#E87A1E] rounded-xl px-6 py-2.5 bg-white shadow-sm">
                        View All 80+ Services →
                    </button>
                </div>
            </div>
        </section>
    );
};

const HowItWorksSection = () => {
    const { ref, visible } = useInView();
    return (
        <section id="how-it-works" className="py-24 px-6 bg-[#F4EFE6] border-y border-[#E7E0D8]" ref={ref}>
            <div className="max-w-6xl mx-auto">
                <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <p className="text-[#E87A1E] text-sm font-semibold uppercase tracking-wider mb-3">Simple Process</p>
                    <h2 className="text-4xl md:text-5xl font-black text-[#1C1917] mb-4">Book in 4 Easy Steps</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                    {STEPS.map((step) => {
                        const IconComponent = step.icon;
                        return (
                            <div key={step.n} className="relative bg-white border border-[#E7E0D8] hover:border-[#E87A1E]/50 rounded-2xl p-6 text-center group transition-all duration-300 shadow-sm">
                                <span className="absolute top-4 right-5 text-4xl font-extrabold text-[#E7E0D8] select-none">
                                    {step.n}
                                </span>
                                <div className="w-14 h-14 rounded-2xl bg-[#FFF5EA] text-[#E87A1E] border border-[#FDBA74] flex items-center justify-center mx-auto mb-5">
                                    <IconComponent className="w-6 h-6"/>
                                </div>
                                <h3 className="text-[#1C1917] font-bold mb-2 group-hover:text-[#E87A1E] transition-colors">{step.title}</h3>
                                <p className="text-[#78716C] text-xs leading-relaxed">{step.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

const WorkersSection = ({ navigate }) => {
    return (
        <section id="for-workers" className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-10 md:p-16 grid md:grid-cols-2 gap-12 items-center shadow-sm">
                    <div>
                        <p className="text-[#E87A1E] text-sm font-semibold uppercase tracking-wider mb-4">For Professionals</p>
                        <h2 className="text-4xl font-black text-[#1C1917] mb-5 leading-tight">
                            Turn Your Skills Into a <span className="text-[#E87A1E]">Thriving Career</span>
                        </h2>
                        <p className="text-[#78716C] mb-8 leading-relaxed">Join 8,000+ verified workers earning steady income on their own schedule. Get paid weekly, track every rupee in your transparent wallet, and build your reputation with customer reviews.</p>
                        <button onClick={() => navigate('/how-it-works')} className="btn-primary-gradient px-8 py-3.5 rounded-xl font-bold transition-all cursor-pointer">
                            Learn More About Process →
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { val: '₹45K', label: 'Avg Monthly Earning' },
                            { val: '24hr', label: 'Fast Payout Cycle' },
                            { val: '8K+', label: 'Active Professionals' },
                            { val: 'Verified', label: 'Completed-booking Reviews' },
                        ].map((s) => (
                            <div key={s.label} className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-5 text-center">
                                <div className="text-3xl font-black text-[#1C1917] mb-1">{s.val}</div>
                                <div className="text-[#78716C] text-xs">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTestimonial, setActiveTestimonial] = useState(0);

    useEffect(() => {
        if (user) {
            if (user.role === 'CUSTOMER') navigate('/dashboard');
            else if (user.role === 'WORKER') navigate('/worker');
            else navigate('/admin');
        }
    }, [user, navigate]);

    useEffect(() => {
        const t = setInterval(() => setActiveTestimonial(p => (p + 1) % TESTIMONIALS.length), 4000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] overflow-x-hidden font-sans">
            <SharedNavbar />
            
            <div className="pt-[76px]">
                <UserCategoryBanner />
            </div>

            {/* HERO */}
            <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-16 pb-12">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E87A1E]/10 rounded-full blur-[120px] pointer-events-none"/>

                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-[#FFF5EA] border border-[#FDBA74] rounded-full px-4 py-1.5 text-xs font-semibold text-[#E87A1E] mb-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E87A1E] animate-pulse"/>
                        Trusted by 50,000+ customers across India
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black leading-[1.08] tracking-tight mb-6 text-[#1C1917]">
                        Professional Services, <br />
                        <span className="text-highlight-gradient">At Your Doorstep</span>
                    </h1>

                    <p className="text-[#57534E] text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
                        Book verified, background-checked professionals for 80+ home services.
                        Transparent pricing, secure payments, and real-time tracking — all in one place.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl mx-auto mb-12">
                        <div className="flex-1 flex items-center gap-3 bg-white border border-[#E7E0D8] rounded-2xl px-4 py-3 focus-within:border-[#E87A1E] shadow-sm">
                            <Search className="w-4 h-4 text-[#A8A29E] flex-shrink-0"/>
                            <input 
                                readOnly 
                                onClick={() => navigate('/login')} 
                                placeholder="What service do you need?" 
                                className="bg-transparent text-[#1C1917] text-sm flex-1 outline-none placeholder-[#A8A29E] cursor-pointer"
                            />
                        </div>
                        <button onClick={() => navigate('/login')} className="btn-primary-gradient font-bold px-8 py-3 rounded-2xl cursor-pointer">
                            Book Now
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#78716C]">
                        {['✓ Background Verified Workers', '✓ Secure Escrow Payments', '✓ Real-time Tracking', '✓ 30-day Service Guarantee'].map(t => (
                            <span key={t}>{t}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* PROMOTIONAL BANNER CAROUSEL */}
            <section className="max-w-6xl mx-auto px-6 py-4">
                <HomeBannerCarousel />
            </section>

            {/* STATS BAND */}
            <section className="border-y border-[#E7E0D8] bg-[#F4EFE6] py-10">
                <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {STATS.map((s) => (
                        <div key={s.label} className="text-center">
                            <div className="text-3xl md:text-4xl font-black text-highlight-gradient mb-1">{s.value}</div>
                            <div className="text-[#78716C] text-sm font-medium">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SERVICES */}
            <ServicesSection navigate={navigate}/>

            {/* HOW IT WORKS */}
            <HowItWorksSection />

            {/* FOR WORKERS */}
            <WorkersSection navigate={navigate}/>

            {/* TESTIMONIALS */}
            <section className="py-24 px-6 bg-[#F4EFE6] border-y border-[#E7E0D8]">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-[#E87A1E] text-sm font-semibold uppercase tracking-wider mb-3">Reviews</p>
                        <h2 className="text-4xl font-black text-[#1C1917]">What People Say</h2>
                    </div>

                    <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 md:p-10 shadow-sm">
                        <div className="flex items-center gap-1 mb-5">
                            {Array.from({ length: TESTIMONIALS[activeTestimonial].rating }).map((_, j) => (
                                <span key={j} className="text-[#D97706] text-lg">★</span>
                            ))}
                        </div>
                        <p className="text-[#1C1917] text-lg md:text-xl leading-relaxed mb-8 italic">
                            "{TESTIMONIALS[activeTestimonial].text}"
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full logo-gradient flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                {TESTIMONIALS[activeTestimonial].avatar}
                            </div>
                            <div>
                                <div className="text-[#1C1917] font-semibold">{TESTIMONIALS[activeTestimonial].name}</div>
                                <div className="text-[#78716C] text-sm">{TESTIMONIALS[activeTestimonial].role} · {TESTIMONIALS[activeTestimonial].city}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
