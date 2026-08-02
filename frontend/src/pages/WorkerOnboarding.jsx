import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Upload, FileText, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';

export const WorkerOnboarding = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [selectedCats, setSelectedCats] = useState([]);
    const [skills, setSkills] = useState('');
    const [exp] = useState(1);
    const [bio, setBio] = useState('');
    const [languages, setLanguages] = useState('English, Hindi');
    const [hourlyRate, setHourlyRate] = useState(300);
    const [dailyRate, setDailyRate] = useState(2000);
    const [minBooking, setMinBooking] = useState(2);
    const [radius, setRadius] = useState(10);
    const [dob, setDob] = useState('');

    const [aadhaarNum, setAadhaarNum] = useState('');
    const [panNum, setPanNum] = useState('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            if (res.data.success) {
                setCategories(res.data.categories);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCatToggle = (catId) => {
        if (selectedCats.includes(catId)) {
            setSelectedCats(selectedCats.filter((id) => id !== catId));
        } else {
            setSelectedCats([...selectedCats, catId]);
        }
    };

    const handleOnboardingSubmit = async (e) => {
        e.preventDefault();
        if (selectedCats.length === 0) {
            setError('Please select at least one service category.');
            return;
        }
        if (!dob) {
            setError('Date of Birth is required.');
            return;
        }

        const dobDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            age--;
        }
        if (age < 18) {
            setError('Workers must be at least 18 years old to join.');
            return;
        }
        if (!aadhaarNum || !panNum) {
            setError('Please fill in both Aadhaar and PAN details.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const payload = {
                serviceCategoryIds: selectedCats,
                skills: skills.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
                experienceYears: Number(exp),
                bio,
                languages: languages.split(',').map((l) => l.trim()).filter((l) => l.length > 0),
                hourlyRate: Number(hourlyRate) * 100,
                dailyRate: Number(dailyRate) * 100,
                minimumBookingDuration: Number(minBooking),
                serviceRadiusKm: Number(radius),
                latitude: 12.9716,
                longitude: 77.5946,
                dob,
                documents: [
                    {
                        documentType: 'AADHAAR',
                        documentNumber: aadhaarNum,
                        frontFile: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
                        backFile: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
                    },
                    {
                        documentType: 'PAN',
                        documentNumber: panNum,
                        frontFile: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=400',
                    },
                ],
            };
            const res = await api.post('/workers/onboarding', payload);
            if (res.data.success) {
                navigate('/worker');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Onboarding submission failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] py-12 px-4 relative overflow-hidden flex flex-col justify-center items-center font-sans">
            <div className="w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-extrabold text-[#1C1917]">Worker Onboarding Wizard</h1>
                    <p className="text-[#78716C] text-sm mt-1">Complete your registration to start receiving local booking orders.</p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <React.Fragment key={s}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-colors ${step === s
                                ? 'bg-[#E87A1E] border-[#E87A1E] text-white shadow-sm'
                                : step > s
                                    ? 'bg-[#16A34A] border-[#16A34A] text-white'
                                    : 'bg-white border-[#E7E0D8] text-[#A8A29E]'}`}>
                                {step > s ? <Check className="w-3.5 h-3.5"/> : s}
                            </div>
                            {s < 3 && <div className={`h-[1px] w-12 ${step > s ? 'bg-[#16A34A]' : 'bg-[#E7E0D8]'}`}/>}
                        </React.Fragment>
                    ))}
                </div>

                {/* Form panel */}
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm relative">
                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-3 rounded-xl mb-6">
                            {error}
                        </div>
                    )}

                    {/* STEP 1: Categories & Bio */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-base font-bold text-[#1C1917] mb-2">1. Select Your Service Category</h2>
                                <p className="text-[#78716C] text-xs mb-3">Choose the categories that match your skills. You can select multiple.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {categories.map((cat) => (
                                        <button 
                                            key={cat._id} 
                                            type="button" 
                                            onClick={() => handleCatToggle(cat._id)} 
                                            className={`p-3 rounded-xl text-xs font-semibold border transition-all text-left cursor-pointer ${selectedCats.includes(cat._id)
                                                ? 'bg-[#FFF5EA] border-[#E87A1E] text-[#E87A1E] font-bold'
                                                : 'bg-[#FAF6F0] border-[#E7E0D8] text-[#78716C] hover:border-[#DCD4C8]'}`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Skills (Comma Separated)</label>
                                    <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Cooking, Housekeeping, Baby Care" className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Professional Bio</label>
                                    <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell clients about your experience, dedication, and background..." className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none resize-none" required/>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 border-t border-[#E7E0D8]">
                                <button type="button" onClick={() => setStep(2)} className="btn-primary-gradient text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer transition-colors flex items-center gap-1">
                                    Next Step
                                    <ArrowRight className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Rates & Details */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-base font-bold text-[#1C1917] mb-2">2. Set Rates & Settings</h2>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Hourly Rate (INR)</label>
                                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Daily Rate (INR)</label>
                                    <input type="number" value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Date of Birth (18+)</label>
                                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Service Radius (km)</label>
                                    <input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Min Hours Per Booking</label>
                                    <input type="number" value={minBooking} onChange={(e) => setMinBooking(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Languages</label>
                                    <input type="text" value={languages} onChange={(e) => setLanguages(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-sm outline-none"/>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-[#E7E0D8]">
                                <button type="button" onClick={() => setStep(1)} className="bg-[#FAF6F0] hover:bg-[#FFF5EA] text-[#44403C] text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer border border-[#E7E0D8] flex items-center gap-1">
                                    <ArrowLeft className="w-3.5 h-3.5"/>
                                    Back
                                </button>
                                <button type="button" onClick={() => setStep(3)} className="btn-primary-gradient text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer flex items-center gap-1">
                                    Next Step
                                    <ArrowRight className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Identification & Upload */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-base font-bold text-[#1C1917] mb-2">3. KYC Document Verification</h2>
                            <p className="text-[#78716C] text-xs mb-4">Provide document details for verification. These documents are encrypted at rest.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">Aadhaar Card Number</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]"/>
                                        <input type="text" value={aadhaarNum} onChange={(e) => setAadhaarNum(e.target.value)} placeholder="12-digit Aadhaar Number" maxLength={12} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 pl-10 pr-4 text-[#1C1917] text-sm outline-none"/>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#44403C] uppercase tracking-wider mb-2">PAN Card Number</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]"/>
                                        <input type="text" value={panNum} onChange={(e) => setPanNum(e.target.value)} placeholder="10-character PAN Code" maxLength={10} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 pl-10 pr-4 text-[#1C1917] text-sm outline-none"/>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border-2 border-dashed border-[#E7E0D8] bg-[#FAF6F0] rounded-2xl p-4 text-center cursor-pointer hover:border-[#E87A1E] transition-colors">
                                        <Upload className="w-5 h-5 text-[#E87A1E] mx-auto mb-2"/>
                                        <span className="block text-[10px] text-[#1C1917] font-bold">Aadhaar Image</span>
                                        <span className="text-[9px] text-[#78716C] mt-1">aadhaar_front.jpg (mocked)</span>
                                    </div>
                                    <div className="border-2 border-dashed border-[#E7E0D8] bg-[#FAF6F0] rounded-2xl p-4 text-center cursor-pointer hover:border-[#E87A1E] transition-colors">
                                        <Upload className="w-5 h-5 text-[#E87A1E] mx-auto mb-2"/>
                                        <span className="block text-[10px] text-[#1C1917] font-bold">PAN Card Image</span>
                                        <span className="text-[9px] text-[#78716C] mt-1">pan_card.jpg (mocked)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4 border-t border-[#E7E0D8]">
                                <button type="button" onClick={() => setStep(2)} className="bg-[#FAF6F0] hover:bg-[#FFF5EA] text-[#44403C] text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer border border-[#E7E0D8] flex items-center gap-1">
                                    <ArrowLeft className="w-3.5 h-3.5"/>
                                    Back
                                </button>
                                <button type="button" onClick={handleOnboardingSubmit} disabled={loading} className="btn-primary-gradient text-white text-xs font-bold py-2.5 px-6 rounded-xl cursor-pointer transition-all flex items-center gap-2">
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                                            Submitting Docs...
                                        </>
                                    ) : ('Submit Verification Details')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkerOnboarding;
