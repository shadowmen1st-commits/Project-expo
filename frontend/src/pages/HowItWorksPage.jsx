import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import { Search, Calendar, Shield, Star, ClipboardCheck, Zap, Briefcase, Check, ShieldCheck, User, Wrench, Sparkles } from 'lucide-react';

const CUSTOMER_STEPS = [
    {
        n: '01',
        badge: 'Search & Match',
        title: 'Find the Best Local Expert',
        desc: 'Browse our highly vetted catalog or search specifically for the fix you need. Apply filters based on reviews, locations, and pricing.',
        icon: Search,
        points: ['Browse 80+ categories', 'Filter by ratings or price', 'Check real-time availability']
    },
    {
        n: '02',
        badge: 'Instant Booking',
        title: 'Lock In Your Schedule',
        desc: 'Select a time slot that matches your comfort. Add details, descriptions, or upload media of the task at hand so professionals come prepared.',
        icon: Calendar,
        points: ['Secure instant confirmations', 'Attach photos/video notes', 'Modify slots up to 24h prior']
    },
    {
        n: '03',
        badge: 'Platform Escrow',
        title: 'Pay Safely, Release on Completion',
        desc: 'Add funds securely using Razorpay. Your money is held in a secure platform escrow vault. The worker only gets paid once you mark the job finished.',
        icon: Shield,
        points: ['Escrow fund protection', 'Supports UPI, Cards, Netbanking', 'Fully refundable on cancellation']
    },
    {
        n: '04',
        badge: 'Quality Loop',
        title: 'Rate and Help the Circle',
        desc: 'After checking the completed work, rate your specialist. High-performing specialists get ranked higher, keeping the service standard top-notch.',
        icon: Star,
        points: ['Verify with complete ratings', 'Support clean community loop', 'Earn discount coupons']
    }
];

const WORKER_STEPS = [
    {
        n: '01',
        badge: 'Onboard & Verify',
        title: 'Setup Your Professional Profile',
        desc: 'Complete onboarding by registering. Upload government identity proof, certificates, and list your skills to get background verification.',
        icon: ClipboardCheck,
        points: ['Aadhaar/PAN background checks', 'Skill listing and certification', 'Upload past portfolio work']
    },
    {
        n: '02',
        badge: 'Get Leads',
        title: 'Receive Smart Service Alerts',
        desc: 'Get matched to nearby bookings. Choose matching slots, review custom requirements, and accept service requests that fit your location.',
        icon: Zap,
        points: ['Smart alert notification', 'Set your custom availability calendar', 'Reject or accept leads instantly']
    },
    {
        n: '03',
        badge: 'Deliver Quality',
        title: 'Complete Work & Cash Out',
        desc: 'Arrive on-site, complete the job according to standards. Mark the job completed in your app to trigger escrow payout authorization.',
        icon: Briefcase,
        points: ['Transparent wallet payout', 'Secure digital check-in/out', 'Weekly automatic payout cycles']
    }
];

export const HowItWorksPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('customer');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const currentSteps = activeTab === 'customer' ? CUSTOMER_STEPS : WORKER_STEPS;

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] overflow-x-hidden pb-24 font-sans">
            <SharedNavbar />

            {/* Header */}
            <section className="relative pt-32 pb-12 px-6 overflow-hidden text-center">
                <div className="absolute top-[-120px] left-1/3 w-[600px] h-[300px] bg-[#E87A1E]/10 blur-[120px] rounded-full pointer-events-none"/>

                <div className="relative max-w-4xl mx-auto z-10">
                    <div className="inline-flex items-center gap-2 bg-[#FFF5EA] border border-[#FDBA74] rounded-full px-4 py-1.5 text-xs font-semibold text-[#E87A1E] mb-6">
                        <Sparkles className="w-3.5 h-3.5"/> Simple, Secure, Transparent
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight text-[#1C1917]">
                        How <span className="text-highlight-gradient">HyperLocal Works</span>
                    </h1>

                    <p className="text-[#78716C] text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                        Whether you want to book a trusted professional or register your services to earn, we have designed the perfect flow.
                    </p>

                    {/* Toggle pill selector */}
                    <div className="inline-flex bg-white border border-[#E7E0D8] rounded-2xl p-1.5 shadow-sm">
                        <button 
                            onClick={() => setActiveTab('customer')} 
                            className={`px-6 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 outline-none border ${activeTab === 'customer'
                                ? 'bg-[#E87A1E] border-[#E87A1E] text-white shadow-sm'
                                : 'border-transparent text-[#78716C] hover:text-[#1C1917]'}`}
                        >
                            <User className="w-4 h-4"/> Booking a Service
                        </button>
                        <button 
                            onClick={() => setActiveTab('worker')} 
                            className={`px-6 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2.5 outline-none border ${activeTab === 'worker'
                                ? 'bg-[#E87A1E] border-[#E87A1E] text-white shadow-sm'
                                : 'border-transparent text-[#78716C] hover:text-[#1C1917]'}`}
                        >
                            <Wrench className="w-4 h-4"/> Earning as a Professional
                        </button>
                    </div>
                </div>
            </section>

            {/* Banner Slider */}
            <section className="max-w-6xl mx-auto px-6 mb-16">
                <HomeBannerCarousel onActionClick={() => navigate('/login')} />
            </section>

            {/* Interactive Timeline */}
            <section className="max-w-4xl mx-auto px-6 relative mt-8">
                <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-[#E7E0D8] -translate-x-1/2"/>

                <div className="space-y-12 md:space-y-16">
                    {currentSteps.map((step, idx) => {
                        const isEven = idx % 2 === 0;
                        const IconComponent = step.icon;
                        return (
                            <div key={step.n} className="relative flex flex-col md:flex-row items-center gap-8 md:gap-16">
                                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border border-[#FDBA74] bg-[#FFF5EA] items-center justify-center font-black text-xs text-[#E87A1E] z-10 shadow-sm">
                                    {step.n}
                                </div>

                                <div className={`w-full md:w-1/2 flex justify-end ${isEven ? 'md:order-1' : 'md:order-2 md:justify-start'}`}>
                                    <div className="w-full max-w-md bg-white border border-[#E7E0D8] hover:border-[#E87A1E]/50 rounded-3xl p-6 md:p-8 transition-all shadow-sm">
                                        <div className="inline-flex bg-[#FFF5EA] border border-[#FDBA74] text-[#E87A1E] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg mb-4">
                                            {step.badge}
                                        </div>

                                        <h2 className="text-xl md:text-2xl font-black mb-3 text-[#1C1917] leading-tight">
                                            {step.title}
                                        </h2>

                                        <p className="text-[#78716C] text-xs md:text-sm leading-relaxed mb-6 font-normal">
                                            {step.desc}
                                        </p>

                                        <ul className="space-y-2.5">
                                            {step.points.map((p, pi) => (
                                                <li key={pi} className="flex items-center gap-2.5 text-xs text-[#1C1917]">
                                                    <Check className="text-[#16A34A] w-3.5 h-3.5 flex-shrink-0"/>
                                                    <span>{p}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className={`w-full md:w-1/2 flex items-center justify-center ${isEven ? 'md:order-2 md:justify-start' : 'md:order-1 md:justify-end'}`}>
                                    <div className="w-24 h-24 md:w-36 md:h-36 bg-[#F4EFE6] border border-[#E7E0D8] rounded-3xl flex items-center justify-center text-[#E87A1E]">
                                        <IconComponent className="w-10 h-10 md:w-14 md:h-14"/>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Guarantee Protection */}
            <section className="max-w-5xl mx-auto px-6 mt-24">
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 flex flex-col md:flex-row items-center gap-6 md:gap-10 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFF5EA] border border-[#FDBA74] flex items-center justify-center text-[#E87A1E] flex-shrink-0">
                        <ShieldCheck className="w-8 h-8"/>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg md:text-xl font-bold text-[#1C1917] mb-1.5">Escrow Refund Guarantee Protection</h3>
                        <p className="text-[#78716C] text-xs md:text-sm leading-relaxed">
                            We process all transactions using standard Razorpay gateway APIs. Funds remain in platform-secured escrow accounts and are only transferred to workers upon job sign-off. Instant 100% refund on cancellations.
                        </p>
                    </div>
                    <button onClick={() => navigate('/register')} className="btn-primary-gradient text-xs font-bold px-6.5 py-3.5 rounded-xl cursor-pointer flex-shrink-0">
                        Join Now
                    </button>
                </div>
            </section>
        </div>
    );
};

export default HowItWorksPage;
