import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import cleanerBanner from '../assets/cleaner_banner.png';
import caretakerBanner from '../assets/caretaker_banner.png';
import technicianBanner from '../assets/technician_banner.png';

const BANNERS = [
    {
        image: cleanerBanner,
        tag: "Cleaning • Safai Wala",
        title: "Professional Home Cleaning",
        desc: "Get flat 25% off on complete home cleaning, kitchen dusting, & bathroom sanitization. Verified professionals.",
        code: "CLEAN25",
        categoryName: "Cleaning",
        buttonText: "Book Cleaning Now",
    },
    {
        image: caretakerBanner,
        tag: "Caretaker • Senior & Baby Care",
        title: "Reliable In-Home Caregivers",
        desc: "Experienced, vetted caretakers & nannies for children and seniors. Safe and compassionate care you can trust.",
        code: "CARE50",
        categoryName: "Senior Care",
        buttonText: "Hire Caregiver",
    },
    {
        image: technicianBanner,
        tag: "Technician • Electrician & Plumber",
        title: "Verified Handyman Experts",
        desc: "From complex wiring issues to stubborn pipe leakages. Get top-rated local technicians at your door in 30 mins.",
        code: "REPAIR15",
        categoryName: "Plumbing",
        buttonText: "Book Technician",
    }
];

export const HomeBannerCarousel = ({ onActionClick }) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [copiedCode, setCopiedCode] = useState(null);
    const autoplayTimer = useRef(null);

    const startAutoplay = () => {
        stopAutoplay();
        autoplayTimer.current = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % BANNERS.length);
        }, 5000);
    };

    const stopAutoplay = () => {
        if (autoplayTimer.current) {
            clearInterval(autoplayTimer.current);
            autoplayTimer.current = null;
        }
    };

    useEffect(() => {
        if (!isHovered) {
            startAutoplay();
        } else {
            stopAutoplay();
        }
        return () => stopAutoplay();
    }, [isHovered]);

    const handlePrev = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? BANNERS.length - 1 : prev - 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % BANNERS.length);
    };

    const handleDotClick = (index, e) => {
        e.stopPropagation();
        setCurrentIndex(index);
    };

    const handleCopyCode = (code, e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        });
    };

    const handleCTA = (categoryName) => {
        if (onActionClick) {
            onActionClick(categoryName);
        } else {
            navigate('/login');
        }
    };

    return (
        <div 
            className="relative w-full rounded-3xl overflow-hidden border border-[#E7E0D8] bg-[#FFFFFF] h-[280px] md:h-[320px] transition-all duration-500 shadow-md group/carousel hover:border-[#EAB308]/40" 
            onMouseEnter={() => setIsHovered(true)} 
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Slides Container */}
            {BANNERS.map((banner, index) => {
                const isSelected = index === currentIndex;
                return (
                    <div 
                        key={index} 
                        className={`absolute inset-0 w-full h-full transition-all duration-700 ease-in-out flex items-center justify-between ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-98 pointer-events-none'}`}
                    >
                        {/* Background Image on Right Side */}
                        <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-3/5 h-full z-0 overflow-hidden">
                            <img src={banner.image} alt={banner.title} className="w-full h-full object-cover object-center select-none"/>
                            {/* Warm Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-r from-[#FFFFFF] via-[#FFFFFF]/90 to-transparent z-10"/>
                        </div>

                        {/* Left Content Area */}
                        <div className="relative z-20 w-full md:w-3/5 pl-6 pr-4 md:pl-12 py-6 flex flex-col justify-center h-full select-none">
                            {/* Category Pill Tag */}
                            <div className="flex items-center mb-3">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider border bg-[#FEFCE8] text-[#EAB308] border-[#FEF08A]">
                                    {banner.tag}
                                </span>
                            </div>

                            {/* Title */}
                            <h2 className="text-[#1C1917] text-xl md:text-3xl font-extrabold tracking-tight leading-tight">
                                {banner.title}
                            </h2>

                            {/* Description */}
                            <p className="text-[#57534E] text-xs md:text-sm mt-2 max-w-sm md:max-w-md leading-relaxed line-clamp-2 md:line-clamp-none">
                                {banner.desc}
                            </p>

                            {/* Promo Coupon and CTA Button Container */}
                            <div className="mt-4 md:mt-6 flex flex-wrap items-center gap-3">
                                {/* CTA Button */}
                                <button 
                                    onClick={() => handleCTA(banner.categoryName)} 
                                    className="btn-primary-gradient font-bold text-xs md:text-sm px-5 py-2.5 rounded-xl cursor-pointer"
                                >
                                    {banner.buttonText}
                                </button>

                                {/* Promo Code Box */}
                                <div 
                                    onClick={(e) => handleCopyCode(banner.code, e)} 
                                    className="flex items-center gap-2 bg-[#FFFBF7] border border-[#E7E0D8] hover:border-[#EAB308]/40 transition-all rounded-xl px-3 py-2 cursor-pointer group/code" 
                                    title="Click to copy coupon code"
                                >
                                    <span className="text-[10px] md:text-xs text-[#78716C] uppercase tracking-wide">Code:</span>
                                    <span className="text-[11px] md:text-xs font-mono font-bold text-[#EAB308] tracking-wider bg-[#FEFCE8] px-1.5 py-0.5 rounded border border-[#FEF08A]">
                                        {banner.code}
                                    </span>
                                    <span className="text-[9px] md:text-[10px] text-[#EAB308] font-semibold uppercase tracking-wider ml-1">
                                        {copiedCode === banner.code ? 'Copied!' : 'Copy'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Slide Navigation Arrows */}
            <button 
                onClick={handlePrev} 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-[#E7E0D8] text-[#1C1917] flex items-center justify-center cursor-pointer transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 z-30 focus:outline-none shadow-md" 
                aria-label="Previous Slide"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <button 
                onClick={handleNext} 
                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white border border-[#E7E0D8] text-[#1C1917] flex items-center justify-center cursor-pointer transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 z-30 focus:outline-none shadow-md" 
                aria-label="Next Slide"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                </svg>
            </button>

            {/* Navigation Dot Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                {BANNERS.map((_, index) => (
                    <button 
                        key={index} 
                        onClick={(e) => handleDotClick(index, e)} 
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${index === currentIndex ? 'w-6 bg-[#EAB308]' : 'w-2 bg-[#E7E0D8] hover:bg-[#A8A29E]'}`} 
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default HomeBannerCarousel;
