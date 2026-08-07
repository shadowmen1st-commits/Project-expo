import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';

const BENEFITS = [
    {
        icon: '💰',
        title: 'Instant wallet payouts',
        desc: 'Deliver quality services, request completion, and cash out within 24 hours of task sign-off.',
    },
    {
        icon: '⏰',
        title: 'Choose your own hours',
        desc: 'Work full-time, part-time, or just weekends. Toggle your app status online/offline instantly.',
    },
    {
        icon: '📈',
        title: 'Set your hourly rates',
        desc: 'Set custom service pricing and get matched to jobs based on your standard asking rates.',
    },
    {
        icon: '🛡️',
        title: 'Insurance protection',
        desc: 'Stay protected during working hours with platform-sponsored accident and liability insurance.',
    }
];

const WORKER_REVIEWS = [
    {
        name: 'Suresh Kumar',
        city: 'Hyderabad',
        job: 'Electrician Specialist',
        quote: "I used to wait days for clients. Now, HyperLocal matches me with 3-4 local switchboard and wiring bookings daily. I earn around ₹48,000 every single month now, paid directly to my bank.",
        avatar: 'SK',
        stars: 5,
    },
    {
        name: 'Kamla Devi',
        city: 'Pune',
        job: 'Caregiver & Babysitter',
        quote: "The flexible schedules allow me to handle my family chores while earning. The platform holds booking fees securely in escrow, so I never have to bargain or chase clients for my money.",
        avatar: 'KD',
        stars: 5,
    }
];

export const ForWorkersPage = () => {
    const navigate = useNavigate();
    const [hours, setHours] = useState(30);
    const [rate, setRate] = useState(250);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const estimatedMonthly = Math.round(hours * rate * 4.3);

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] overflow-x-hidden pb-24 font-sans">
            <SharedNavbar />

            {/* Hero */}
            <section className="relative pt-32 pb-12 px-6 overflow-hidden">
                <div className="absolute top-[-100px] left-1/4 w-[600px] h-[300px] bg-[#EAB308]/10 blur-[120px] rounded-full pointer-events-none"/>

                <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
                    <div className="lg:col-span-7 text-left">
                        <div className="inline-flex items-center gap-2 bg-[#FEFCE8] border border-[#FEF08A] rounded-full px-4.5 py-1.5 text-xs font-semibold text-[#EAB308] mb-6">
                            💼 Earning Opportunity for Specialists
                        </div>

                        <h1 className="text-4xl md:text-6xl font-black mb-5 leading-tight tracking-tight text-[#1C1917]">
                            Turn Your Handyman Skills <span className="text-highlight-gradient">Into Real Income</span>
                        </h1>

                        <p className="text-[#78716C] text-base md:text-lg mb-8 leading-relaxed max-w-xl">
                            Join 8,000+ verified specialists earning steady income on their own terms. Register in minutes, declare your standard rates, and withdraw earnings directly to your bank account.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => navigate('/register')} className="btn-primary-gradient text-sm font-bold px-8 py-3.5 rounded-xl cursor-pointer">
                                Register as Professional
                            </button>
                            <button 
                                onClick={() => {
                                    const target = document.getElementById('calc');
                                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                                }} 
                                className="bg-white border border-[#E7E0D8] hover:border-[#EAB308] text-[#1C1917] text-sm font-semibold px-8 py-3.5 rounded-xl cursor-pointer shadow-sm"
                            >
                                Calculate Earnings
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                        {[
                            { val: '₹45K+', label: 'Average Earnings', desc: 'Per month standard payout' },
                            { val: '24hr', label: 'Payout Cycle', desc: 'Secure wallet withdrawals' },
                            { val: '8K+', label: 'Active Specialists', desc: 'In 120+ Indian cities' },
                            { val: 'Verified', label: 'Booking reviews', desc: 'Only after completed services' }
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 text-center transition-all hover:border-[#EAB308]/50 shadow-sm">
                                <div className="text-3xl font-black text-[#1C1917] mb-1.5">{stat.val}</div>
                                <div className="text-[#1C1917] text-xs font-semibold mb-0.5">{stat.label}</div>
                                <div className="text-[#78716C] text-[10px]">{stat.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Banner Slider */}
            <section className="max-w-6xl mx-auto px-6 mb-16">
                <HomeBannerCarousel onActionClick={() => navigate('/login')} />
            </section>

            {/* Interactive Earning Calculator */}
            <section id="calc" className="max-w-4xl mx-auto px-6 mt-8">
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 relative overflow-hidden shadow-sm">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl md:text-3xl font-black mb-2 text-[#1C1917]">How much can you earn?</h2>
                        <p className="text-[#78716C] text-xs md:text-sm">Drag slider scales to estimate your potential payouts on HyperLocal.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-2">
                                    <span>Weekly Commitment</span>
                                    <span className="text-[#EAB308] font-bold">{hours} Hours/week</span>
                                </div>
                                <input type="range" min="5" max="60" value={hours} onChange={e => setHours(Number(e.target.value))} className="w-full h-1.5 bg-[#FAF6F0] rounded-lg appearance-none cursor-pointer accent-[#EAB308]"/>
                                <div className="flex justify-between text-[10px] text-[#A8A29E] mt-1.5 font-medium">
                                    <span>5 hrs (Part-time)</span>
                                    <span>60 hrs (Full-time)</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-2">
                                    <span>Your Hourly Asking Rate</span>
                                    <span className="text-[#EAB308] font-bold">₹{rate}/hour</span>
                                </div>
                                <input type="range" min="150" max="800" step="25" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full h-1.5 bg-[#FAF6F0] rounded-lg appearance-none cursor-pointer accent-[#EAB308]"/>
                                <div className="flex justify-between text-[10px] text-[#A8A29E] mt-1.5 font-medium">
                                    <span>₹150/hr (Base)</span>
                                    <span>₹800/hr (Expert)</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-6 text-center shadow-inner relative overflow-hidden">
                            <span className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider block mb-1">Estimated Monthly Income</span>
                            <div className="text-4xl md:text-5xl font-black text-[#1C1917] mb-2 text-highlight-gradient">
                                ₹{estimatedMonthly.toLocaleString('en-IN')}
                            </div>
                            <p className="text-[#78716C] text-xs leading-relaxed mb-6">
                                Based on custom commit slot selection of {hours} hours/week at a rate of ₹{rate}/hr. Payouts computed on monthly average scales.
                            </p>
                            <button onClick={() => navigate('/register')} className="w-full btn-primary-gradient text-xs font-bold py-3 rounded-xl transition-all cursor-pointer">
                                Sign Up & Claim Skills →
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Benefits list */}
            <section className="max-w-6xl mx-auto px-6 mt-24">
                <div className="text-center mb-16">
                    <p className="text-[#EAB308] text-sm font-semibold uppercase tracking-wider mb-2">Designed for Specialists</p>
                    <h2 className="text-3xl md:text-4xl font-black text-[#1C1917]">Why Join HyperLocal?</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {BENEFITS.map((benefit) => (
                        <div key={benefit.title} className="bg-white border border-[#E7E0D8] hover:border-[#EAB308]/50 rounded-2xl p-6 text-left transition-all shadow-sm">
                            <span className="text-3xl mb-4 block">{benefit.icon}</span>
                            <h3 className="font-bold text-[#1C1917] text-base mb-2">{benefit.title}</h3>
                            <p className="text-[#78716C] text-xs leading-relaxed">{benefit.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Testimonials */}
            <section className="max-w-4xl mx-auto px-6 mt-24">
                <div className="text-center mb-12">
                    <p className="text-[#EAB308] text-sm font-semibold uppercase tracking-wider mb-2">Success Stories</p>
                    <h2 className="text-3xl font-black text-[#1C1917]">From Our Vetted Crew</h2>
                </div>

                <div className="space-y-6">
                    {WORKER_REVIEWS.map((review) => (
                        <div key={review.name} className="bg-white border border-[#E7E0D8] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start shadow-sm">
                            <div className="w-14 h-14 rounded-2xl logo-gradient flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                                {review.avatar}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    {Array.from({ length: review.stars }).map((_, si) => (
                                        <span key={si} className="text-[#D97706] text-xs">★</span>
                                    ))}
                                </div>
                                <p className="text-[#78716C] text-xs md:text-sm italic leading-relaxed mb-4">
                                    "{review.quote}"
                                </p>
                                <div>
                                    <h4 className="text-[#1C1917] font-bold text-sm">{review.name}</h4>
                                    <span className="text-[#A8A29E] text-[11px] font-medium">{review.job} · {review.city}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ForWorkersPage;
