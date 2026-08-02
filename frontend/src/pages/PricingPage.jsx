import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        tagline: 'Perfect for occasional use',
        monthlyPrice: 0,
        yearlyPrice: 0,
        highlight: false,
        cta: 'Get Started Free',
        features: [
            { text: 'Up to 3 bookings/month', included: true },
            { text: 'Access to all service categories', included: true },
            { text: 'Verified worker profiles', included: true },
            { text: 'In-app chat with worker', included: true },
            { text: 'Priority booking slots', included: false },
            { text: 'Dedicated account manager', included: false },
            { text: 'Advanced analytics dashboard', included: false },
            { text: 'Custom SLA agreements', included: false },
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        tagline: 'For power users & families',
        monthlyPrice: 299,
        yearlyPrice: 249,
        highlight: true,
        badge: 'Most Popular',
        cta: 'Start Pro — Free Trial',
        features: [
            { text: 'Unlimited bookings', included: true },
            { text: 'Access to all service categories', included: true },
            { text: 'Verified worker profiles', included: true },
            { text: 'In-app chat with worker', included: true },
            { text: 'Priority booking slots', included: true },
            { text: 'Dedicated account manager', included: false },
            { text: 'Advanced analytics dashboard', included: false },
            { text: 'Custom SLA agreements', included: false },
        ],
    },
    {
        id: 'business',
        name: 'Business',
        tagline: 'For offices & enterprises',
        monthlyPrice: 999,
        yearlyPrice: 799,
        highlight: false,
        badge: 'Best Value',
        cta: 'Contact Sales',
        features: [
            { text: 'Unlimited bookings', included: true },
            { text: 'Access to all service categories', included: true },
            { text: 'Verified worker profiles', included: true },
            { text: 'In-app chat with worker', included: true },
            { text: 'Priority booking slots', included: true },
            { text: 'Dedicated account manager', included: true },
            { text: 'Advanced analytics dashboard', included: true },
            { text: 'Custom SLA agreements', included: true },
        ],
    },
];

const COMMISSION_TIERS = [
    { range: '₹0 – ₹500', platform: '10%', worker: '90%', desc: 'Standard rate for all basic services' },
    { range: '₹500 – ₹2,000', platform: '8%', worker: '92%', desc: 'Reduced commission on mid-range bookings' },
    { range: '₹2,000 – ₹10,000', platform: '6%', worker: '94%', desc: 'Premium project rate' },
    { range: '₹10,000+', platform: '5%', worker: '95%', desc: 'Enterprise & bulk booking rate' },
];

const FAQS = [
    {
        q: 'Is the Basic plan really free forever?',
        a: 'Yes! The Basic plan has no monthly fee. You only pay the service amount + a small platform commission per booking.',
    },
    {
        q: 'How does the commission model work?',
        a: 'HyperLocal charges a platform fee ranging from 5%–10% on each booking amount. Workers receive the rest directly to their wallet, with weekly payout cycles.',
    },
    {
        q: 'Can I switch plans anytime?',
        a: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings. Billing is prorated.',
    },
    {
        q: 'Are payments secure?',
        a: 'Yes. All payments are processed via Razorpay with 256-bit SSL encryption. Funds are held in escrow and released only after job completion.',
    },
    {
        q: 'What is the refund policy?',
        a: 'If a worker cancels or fails to show up, you get a full refund within 24 hours. For service disputes, our support team mediates within 48 hours.',
    },
];

const FAQItem = ({ q, a }) => {
    const [open, setOpen] = useState(false);
    return (
        <div 
            className={`border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${open ? 'border-[#E87A1E] bg-[#FFF5EA]' : 'border-[#E7E0D8] bg-white hover:border-[#E87A1E]/50'}`} 
            onClick={() => setOpen(o => !o)}
        >
            <div className="flex items-center justify-between px-6 py-4 gap-4">
                <span className="text-[#1C1917] font-semibold text-sm">{q}</span>
                <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${open ? 'border-[#E87A1E] bg-[#E87A1E]/10 rotate-45' : 'border-[#E7E0D8]'}`}>
                    <svg className="w-3 h-3 text-[#78716C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14"/>
                    </svg>
                </span>
            </div>
            {open && (
                <div className="px-6 pb-5 text-[#78716C] text-sm leading-relaxed border-t border-[#E7E0D8] pt-4">
                    {a}
                </div>
            )}
        </div>
    );
};

export const PricingPage = () => {
    const navigate = useNavigate();
    const [yearly, setYearly] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] overflow-x-hidden font-sans">
            <SharedNavbar />

            {/* Header */}
            <section className="pt-32 pb-12 px-6 relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#E87A1E]/10 blur-[120px] rounded-full"/>
                </div>

                <div className="relative max-w-3xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-[#FFF5EA] border border-[#FDBA74] rounded-full px-4 py-1.5 text-xs font-semibold text-[#E87A1E] mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E87A1E] animate-pulse"/>
                        Transparent, no hidden fees
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4 text-[#1C1917]">
                        Simple, <span className="text-highlight-gradient">Fair Pricing</span>
                    </h1>
                    <p className="text-[#78716C] text-base md:text-lg mb-8">
                        Start for free. Scale when you need to. No contracts, cancel anytime.
                    </p>

                    {/* Billing toggle */}
                    <div className="inline-flex items-center gap-4 bg-white border border-[#E7E0D8] rounded-2xl p-1.5 shadow-sm">
                        <button onClick={() => setYearly(false)} className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${!yearly ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:text-[#1C1917]'}`}>
                            Monthly
                        </button>
                        <button onClick={() => setYearly(true)} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${yearly ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:text-[#1C1917]'}`}>
                            Yearly
                            <span className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#16A34A]/30">Save 20%</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Banner Slider */}
            <section className="max-w-6xl mx-auto px-6 mb-16">
                <HomeBannerCarousel onActionClick={() => navigate('/login')} />
            </section>

            {/* Pricing Cards */}
            <section className="pb-24 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                    {PLANS.map((plan) => (
                        <div 
                            key={plan.id} 
                            className={`relative flex flex-col rounded-3xl border p-8 transition-all duration-300 shadow-sm ${plan.highlight ? 'bg-white border-[#E87A1E]' : 'bg-white border-[#E7E0D8] hover:border-[#E87A1E]/50'}`}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold bg-[#E87A1E] text-white shadow-sm">
                                    {plan.badge}
                                </div>
                            )}

                            <div className="mb-6">
                                <h2 className="text-[#1C1917] font-black text-xl mb-1">{plan.name}</h2>
                                <p className="text-[#78716C] text-sm">{plan.tagline}</p>
                            </div>

                            <div className="mb-8">
                                {plan.monthlyPrice === 0 ? (
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-[#1C1917]">Free</span>
                                    </div>
                                ) : (
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[#78716C] text-lg">₹</span>
                                        <span className="text-5xl font-black text-[#1C1917]">
                                            {yearly ? plan.yearlyPrice : plan.monthlyPrice}
                                        </span>
                                        <span className="text-[#78716C] text-sm">/mo</span>
                                    </div>
                                )}
                                {yearly && plan.monthlyPrice !== 0 && (
                                    <p className="text-[#16A34A] text-xs mt-1 font-medium">
                                        ₹{((plan.monthlyPrice - plan.yearlyPrice) * 12).toLocaleString()} saved per year
                                    </p>
                                )}
                            </div>

                            <ul className="space-y-3 mb-8 flex-1">
                                {plan.features.map((f, i) => (
                                    <li key={i} className={`flex items-center gap-3 text-sm ${f.included ? 'text-[#1C1917]' : 'text-[#A8A29E]'}`}>
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${f.included ? 'bg-[#FFF5EA] border border-[#FDBA74]' : 'bg-[#FAF6F0] border border-[#E7E0D8]'}`}>
                                            {f.included ? (
                                                <svg className="w-3 h-3 text-[#E87A1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                                                </svg>
                                            ) : (
                                                <svg className="w-3 h-3 text-[#A8A29E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                                                </svg>
                                            )}
                                        </span>
                                        {f.text}
                                    </li>
                                ))}
                            </ul>

                            <button onClick={() => navigate('/login')} className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer ${plan.highlight ? 'btn-primary-gradient' : 'bg-[#FAF6F0] border border-[#E7E0D8] text-[#1C1917] hover:border-[#E87A1E]'}`}>
                                {plan.cta} →
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Commission Tiers */}
            <section className="py-20 px-6 bg-[#F4EFE6] border-y border-[#E7E0D8]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <p className="text-[#E87A1E] text-sm font-semibold uppercase tracking-wider mb-3">For Professionals</p>
                        <h2 className="text-4xl font-black text-[#1C1917] mb-3">Worker Commission Structure</h2>
                        <p className="text-[#78716C] max-w-xl mx-auto text-sm">The more you earn, the more you keep. Our tiered model rewards high-performing workers.</p>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-[#E7E0D8] bg-white shadow-sm">
                        <div className="grid grid-cols-4 bg-[#FAF6F0] border-b border-[#E7E0D8] px-6 py-3">
                            {['Booking Amount', 'Platform Fee', 'You Earn', 'Notes'].map(h => (
                                <span key={h} className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">{h}</span>
                            ))}
                        </div>
                        {COMMISSION_TIERS.map((row, i) => (
                            <div key={i} className={`grid grid-cols-4 items-center px-6 py-5 gap-4 transition-colors hover:bg-[#FFF5EA] ${i !== COMMISSION_TIERS.length - 1 ? 'border-b border-[#E7E0D8]' : ''}`}>
                                <span className="text-[#1C1917] font-bold text-sm">{row.range}</span>
                                <span className="text-[#DC2626] font-bold text-sm">{row.platform}</span>
                                <span className="text-[#16A34A] font-bold text-lg">{row.worker}</span>
                                <span className="text-[#78716C] text-xs leading-relaxed">{row.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-black text-[#1C1917] mb-3">Frequently Asked Questions</h2>
                        <p className="text-[#78716C] text-sm">Everything you need to know about our pricing.</p>
                    </div>
                    <div className="space-y-3">
                        {FAQS.map((faq, i) => <FAQItem key={i} q={faq.q} a={faq.a}/>)}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PricingPage;
