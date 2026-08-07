import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isApp } from '../utils/platform';

export const SharedNavbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const appActive = isApp();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { label: 'Services', path: '/services' },
        { label: 'How It Works', path: '/how-it-works' },
        { label: 'For Workers', path: '/for-workers' },
        { label: 'Pricing', path: '/pricing' }
    ];

    if (appActive) {
        const isHome = location.pathname === '/';
        return (
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFFBEB]/95 backdrop-blur-xl border-b border-[#FEF3C7] shadow-sm py-3">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    {isHome ? (
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl logo-gradient flex items-center justify-center shadow-sm">
                                <span className="text-gray-900 text-sm font-black">H</span>
                            </div>
                            <span className="text-[#111827] font-bold text-lg tracking-tight">HyperLocal<span className="text-[#F97316]">.</span></span>
                        </div>
                    ) : (
                        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#F97316] font-semibold text-sm cursor-pointer outline-none">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                            </svg>
                            Back
                        </button>
                    )}
                    <div className="text-[10px] bg-[#FFEDD5] border border-[#FEF3C7] text-[#F97316] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                        App Mode
                    </div>
                </div>
            </nav>
        );
    }

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-[#FFFBEB]/95 backdrop-blur-xl border-b border-[#FEF3C7] shadow-sm py-3'
                : 'bg-[#FFFBEB]/80 backdrop-blur-md border-b border-transparent py-5'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    {/* Logo */}
                    <button onClick={() => { navigate('/'); setMobileMenuOpen(false); }} className="flex items-center gap-2.5 cursor-pointer outline-none">
                        <div className="w-8 h-8 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                            <span className="text-gray-900 text-sm font-black">H</span>
                        </div>
                        <span className="text-[#111827] font-bold text-lg tracking-tight">HyperLocal<span className="text-[#F97316]">.</span></span>
                    </button>

                    {/* Desktop Nav links */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map(link => {
                            const isActive = location.pathname === link.path;
                            return (
                                <button 
                                    key={link.label} 
                                    onClick={() => navigate(link.path)} 
                                    className={`text-sm font-medium transition-all relative py-1 cursor-pointer outline-none ${isActive ? 'text-[#F97316] font-semibold' : 'text-[#4B5563] hover:text-[#111827]'}`}
                                >
                                    {link.label}
                                    {isActive && (<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F97316] rounded-full"/>)}
                                </button>
                            );
                        })}
                    </div>

                    {/* Desktop CTA */}
                    <div className="hidden md:flex items-center gap-3">
                        <button onClick={() => navigate('/login')} className="text-[#4B5563] hover:text-[#111827] text-sm font-medium transition-colors px-3 py-1.5 cursor-pointer outline-none">
                            Sign In
                        </button>
                        <button onClick={() => navigate('/register')} className="btn-primary-gradient text-sm font-semibold px-5 py-2.5 rounded-xl outline-none cursor-pointer">
                            Get Started
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <button onClick={() => setMobileMenuOpen(prev => !prev)} className="md:hidden text-[#4B5563] hover:text-[#111827] focus:outline-none p-1.5 cursor-pointer">
                        {mobileMenuOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7"/>
                            </svg>
                        )}
                    </button>
                </div>
            </nav>

            {/* Mobile menu overlay */}
            <div className={`fixed inset-0 z-40 bg-[#FFFBEB]/98 backdrop-blur-2xl transition-all duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
                <div className="flex flex-col justify-center h-full px-8 space-y-8 text-center">
                    {navLinks.map((link) => {
                        const isActive = location.pathname === link.path;
                        return (
                            <button 
                                key={link.label} 
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    navigate(link.path);
                                }} 
                                className={`text-2xl font-bold transition-all cursor-pointer outline-none ${isActive ? 'text-[#F97316] translate-x-2' : 'text-[#4B5563] hover:text-[#111827]'}`}
                            >
                                {link.label}
                            </button>
                        );
                    })}

                    <div className="pt-8 border-t border-[#FEF3C7] flex flex-col gap-4">
                        <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} className="text-[#111827] hover:text-[#F97316] text-lg font-semibold py-3 border border-[#FEF3C7] rounded-2xl bg-white cursor-pointer outline-none">
                            Sign In
                        </button>
                        <button onClick={() => { setMobileMenuOpen(false); navigate('/register'); }} className="btn-primary-gradient text-lg font-bold py-3.5 rounded-2xl cursor-pointer outline-none">
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SharedNavbar;
