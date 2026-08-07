import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import { Sparkles, Wrench, Heart, UserCheck, Paintbrush, Search, ChevronRight } from 'lucide-react';

const CATEGORIES = [
    {
        id: 'home',
        name: 'Home & Cleaning',
        icon: Sparkles,
        tagline: 'Deep sanitation, dusting, and full home care by certified helpers',
        items: [
            { name: 'Deep Home Cleaning', price: '₹499/hr', duration: '3-4 hrs', popular: true },
            { name: 'Bathroom Sanitation', price: '₹349/hr', duration: '1-2 hrs' },
            { name: 'Kitchen & Appliance Wash', price: '₹399/hr', duration: '2 hrs', popular: true },
            { name: 'Sofa & Upholstery Shampooing', price: '₹299/hr', duration: '1-2 hrs' },
            { name: 'Disinfection Services', price: '₹199/hr', duration: '1 hr' }
        ]
    },
    {
        id: 'maintenance',
        name: 'Electric & Plumbing',
        icon: Wrench,
        tagline: 'Instant repairs and installation from licensed technicians',
        items: [
            { name: 'Leakage Detection & Fix', price: '₹249/hr', duration: '1 hr', popular: true },
            { name: 'Switchboard Repair & Wiring', price: '₹199/hr', duration: '1 hr' },
            { name: 'AC Service & Gas Charging', price: '₹599/hr', duration: '2 hrs', popular: true },
            { name: 'Geyser & Appliance Fitting', price: '₹299/hr', duration: '1 hr' },
            { name: 'Water Meter & Pump Setup', price: '₹399/hr', duration: '2 hrs' }
        ]
    },
    {
        id: 'wellness',
        name: 'Personal Wellness',
        icon: Heart,
        tagline: 'Relaxing spa therapies and salon grooming at the comfort of your home',
        items: [
            { name: 'Swedish Massage Therapy', price: '₹999/hr', duration: '1.5 hrs', popular: true },
            { name: 'Deep Tissue Relief', price: '₹1,199/hr', duration: '1.5 hrs' },
            { name: 'Home Facial & Skincare', price: '₹799/hr', duration: '1 hr' },
            { name: 'Premium Haircut & Styling', price: '₹399/hr', duration: '1 hr', popular: true },
            { name: 'Manicure & Pedicure Spa', price: '₹599/hr', duration: '1 hr' }
        ]
    },
    {
        id: 'care',
        name: 'Caregiving & Support',
        icon: UserCheck,
        tagline: 'Compassionate care for your seniors, babies, and beloved pets',
        items: [
            { name: 'Senior Care Assistance', price: '₹290/hr', duration: 'Flexible', popular: true },
            { name: 'Newborn Baby Sitting', price: '₹350/hr', duration: 'Flexible' },
            { name: 'Pet Sitting & Grooming', price: '₹190/hr', duration: '1-3 hrs', popular: true },
            { name: 'Physical Therapy Helper', price: '₹400/hr', duration: '1.5 hrs' },
            { name: 'Meal Prep & Dietary Helper', price: '₹250/hr', duration: 'Flexible' }
        ]
    },
    {
        id: 'decor',
        name: 'Painting & Decor',
        icon: Paintbrush,
        tagline: 'Express painting and wall decor consultations by top stylists',
        items: [
            { name: 'Express Wall Painting', price: '₹399/hr', duration: 'Flexible', popular: true },
            { name: 'Wallpaper Application', price: '₹299/hr', duration: '2 hrs' },
            { name: 'Accent Wall Design', price: '₹499/hr', duration: 'Flexible' },
            { name: 'Waterproofing & Sealant', price: '₹349/hr', duration: 'Flexible', popular: true }
        ]
    }
];

export const ServicesPage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCat, setSelectedCat] = useState('all');

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const filteredCategories = CATEGORIES.map(category => {
        const matchedItems = category.items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return { ...category, items: matchedItems };
    }).filter(category => (selectedCat === 'all' || category.id === selectedCat) &&
        (searchQuery === '' || category.items.length > 0));

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] overflow-x-hidden pb-24 font-sans">
            <SharedNavbar />

            {/* Hero Header */}
            <section className="relative pt-32 pb-12 px-6 overflow-hidden">
                <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#EAB308]/10 blur-[120px] rounded-full pointer-events-none"/>

                <div className="relative max-w-5xl mx-auto text-center z-10">
                    <div className="inline-flex items-center gap-2 bg-[#FEFCE8] border border-[#FEF08A] rounded-full px-4 py-1.5 text-xs font-semibold text-[#EAB308] mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308] animate-ping"/>
                        Discover 80+ Local Services
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight tracking-tight text-[#1C1917]">
                        Our Professional <span className="text-highlight-gradient">Service Catalog</span>
                    </h1>

                    <p className="text-[#78716C] text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-normal">
                        Compare services, get transparent flat rates, and book certified, background-verified professionals instantly.
                    </p>

                    {/* Interactive Search */}
                    <div className="max-w-2xl mx-auto bg-white border border-[#E7E0D8] rounded-2xl p-2.5 flex flex-col md:flex-row gap-2 shadow-sm">
                        <div className="flex-1 relative flex items-center">
                            <Search className="absolute left-4 text-[#A8A29E] w-5 h-5"/>
                            <input 
                                type="text" 
                                placeholder="Search electrician, deep cleaning, massage therapy..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)} 
                                className="w-full bg-transparent outline-none pl-11 pr-4 py-2 text-sm text-[#1C1917] placeholder-[#A8A29E] font-medium"
                            />
                        </div>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-xs font-semibold text-[#78716C] hover:text-[#1C1917] px-3 py-2 cursor-pointer transition-colors">
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Category Quick Pill Filters */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8 max-w-3xl mx-auto">
                        <button 
                            onClick={() => setSelectedCat('all')} 
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${selectedCat === 'all'
                                ? 'bg-[#EAB308] border-[#EAB308] text-white shadow-sm'
                                : 'bg-white border-[#E7E0D8] text-[#78716C] hover:border-[#EAB308] hover:text-[#1C1917]'}`}
                        >
                            All Categories
                        </button>
                        {CATEGORIES.map(cat => {
                            const IconComponent = cat.icon;
                            return (
                                <button 
                                    key={cat.id} 
                                    onClick={() => setSelectedCat(cat.id)} 
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${selectedCat === cat.id
                                        ? 'bg-[#EAB308] border-[#EAB308] text-white shadow-sm'
                                        : 'bg-white border-[#E7E0D8] text-[#78716C] hover:border-[#EAB308] hover:text-[#1C1917]'}`}
                                >
                                    <IconComponent className="w-3.5 h-3.5"/>
                                    <span>{cat.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Banner Slider Section */}
            <section className="max-w-6xl mx-auto px-6 mb-12">
                <HomeBannerCarousel onActionClick={() => navigate('/login')} />
            </section>

            {/* Main Grid content */}
            <section className="max-w-6xl mx-auto px-6">
                <div className="space-y-16">
                    {filteredCategories.length > 0 ? (
                        filteredCategories.map((category) => (
                            <div key={category.id} className="transition-all duration-700">
                                {/* Category Header */}
                                {(() => {
                                    const IconComponent = category.icon;
                                    return (
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-[#FEFCE8] border border-[#FEF08A] flex items-center justify-center text-[#EAB308]">
                                                <IconComponent className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-black text-[#1C1917]">{category.name}</h2>
                                                <p className="text-[#78716C] text-xs md:text-sm font-medium mt-0.5">{category.tagline}</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Subservice List grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {category.items.map((item) => (
                                        <div 
                                            key={item.name} 
                                            onClick={() => navigate('/login')} 
                                            className="group relative bg-white border border-[#E7E0D8] hover:border-[#EAB308]/50 rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden shadow-sm"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <h3 className="font-bold text-[#1C1917] text-base leading-tight group-hover:text-[#EAB308] transition-colors w-2/3">
                                                    {item.name}
                                                </h3>
                                                {item.popular && (
                                                    <span className="bg-[#FEFCE8] border border-[#FEF08A] text-[#EAB308] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                        ★ Popular
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#E7E0D8]">
                                                <div>
                                                    <div className="text-[10px] text-[#A8A29E] font-semibold uppercase tracking-wider">Avg Price</div>
                                                    <div className="text-[#EAB308] font-black text-base mt-0.5">{item.price}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-[#A8A29E] font-semibold uppercase tracking-wider">Duration</div>
                                                    <div className="text-[#78716C] text-xs font-semibold mt-1">{item.duration}</div>
                                                </div>
                                            </div>

                                            <div className="absolute top-4 right-4 text-[#EAB308] opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                <ChevronRight className="w-4 h-4"/>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 bg-white border border-[#E7E0D8] rounded-3xl p-10 max-w-md mx-auto flex flex-col items-center justify-center shadow-sm">
                            <Search className="w-10 h-10 text-[#A8A29E] mb-4"/>
                            <h3 className="text-[#1C1917] font-black text-lg mb-1">No services found</h3>
                            <p className="text-[#78716C] text-xs leading-relaxed max-w-xs mx-auto">
                                We couldn't find anything matching your search. Try checking the spelling or resetting filters.
                            </p>
                            <button onClick={() => { setSearchQuery(''); setSelectedCat('all'); }} className="mt-5 btn-primary-gradient text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer">
                                Reset Search Filters
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ServicesPage;
