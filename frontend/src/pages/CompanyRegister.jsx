import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../config/api';
import { ShieldCheck, Building2, User, Wrench } from 'lucide-react';

export default function CompanyRegister() {
    const navigate = useNavigate();
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [description, setDescription] = useState('');
    const [gstNumber, setGstNumber] = useState('');
    const [website, setWebsite] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [authorizedPersonName, setAuthorizedPersonName] = useState('');
    const [authorizedPersonPhone, setAuthorizedPersonPhone] = useState('');
    const [panNumber, setPanNumber] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const response = await api.post('/company/register', {
                companyName,
                email,
                phone,
                address,
                city,
                state,
                pincode,
                businessType,
                description,
                gstNumber,
                website,
                password,
                confirmPassword,
                authorizedPersonName,
                authorizedPersonPhone,
                panNumber
            });
            console.log("COMPANY REGISTER SUCCESS:", response.data);
            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            console.error("COMPANY REGISTER FAILED:", err.response?.data || err.message);
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] flex flex-col lg:flex-row font-sans">
            {/* Left Brand Panel */}
            <div className="lg:w-1/3 auth-panel-bg p-8 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-[#FEF3C7]">
                <div>
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                            <span className="text-[#111827] text-xl font-black">H</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#111827]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                    </div>

                    <div className="max-w-md my-auto space-y-6">
                        <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight leading-tight">
                            Register as a <span className="text-highlight-gradient">Company / Business</span>
                        </h1>
                        <p className="text-[#4B5563] text-sm leading-relaxed">
                            Source, onboard, and manage bulk event staff, marshals, and local worker teams across Delhi/NCR.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3.5">
                                <ShieldCheck className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">Pre-Fund Escrow</h3>
                                    <p className="text-xs text-[#4B5563]">Pay bulk teams securely. Release payouts instantly upon work completion approval.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3.5">
                                <Building2 className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">Workforce Teams</h3>
                                    <p className="text-xs text-[#4B5563]">Organise workers into teams, track attendance logs, and manage shifting seamlessly.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-xs text-[#9CA3AF]">
                    © {new Date().getFullYear()} HyperLocal Marketplace Services Pvt. Ltd. All rights reserved.
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="lg:w-2/3 bg-[#FFFBEB] p-8 lg:p-16 flex items-center justify-center overflow-y-auto">
                <div className="w-full max-w-2xl bg-white border border-[#FEF3C7] rounded-3xl p-8 shadow-md">
                    <div className="mb-6">
                        <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">Create Company Account</h2>
                        <p className="text-xs text-[#4B5563] mt-1">Delhi/NCR Hyperlocal Part-time Job Marketplace</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl mb-4">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-4 rounded-xl mb-4">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Company Name</label>
                                <input 
                                    type="text" 
                                    value={companyName} 
                                    onChange={e => setCompanyName(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Official Email</label>
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Phone Number</label>
                                <input 
                                    type="tel" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Business Type</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Event Management, Logistics" 
                                    value={businessType} 
                                    onChange={e => setBusinessType(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Address</label>
                                <input 
                                    type="text" 
                                    value={address} 
                                    onChange={e => setAddress(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">City</label>
                                <input 
                                    type="text" 
                                    value={city} 
                                    onChange={e => setCity(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Pincode</label>
                                <input 
                                    type="text" 
                                    value={pincode} 
                                    onChange={e => setPincode(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">State</label>
                                <input 
                                    type="text" 
                                    value={state} 
                                    onChange={e => setState(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Authorized Person Name</label>
                                <input 
                                    type="text" 
                                    value={authorizedPersonName} 
                                    onChange={e => setAuthorizedPersonName(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Authorized Person Phone</label>
                                <input 
                                    type="tel" 
                                    value={authorizedPersonPhone} 
                                    onChange={e => setAuthorizedPersonPhone(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">PAN Card Number</label>
                                <input 
                                    type="text" 
                                    value={panNumber} 
                                    onChange={e => setPanNumber(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">GST Number (Optional)</label>
                                <input 
                                    type="text" 
                                    value={gstNumber} 
                                    onChange={e => setGstNumber(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Website (Optional)</label>
                                <input 
                                    type="url" 
                                    placeholder="https://example.com" 
                                    value={website} 
                                    onChange={e => setWebsite(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Company Description</label>
                            <textarea 
                                rows={2}
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Password</label>
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">Confirm Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="w-full btn-primary-gradient font-semibold py-3.5 rounded-xl cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? 'Registering Company...' : 'Register Company'}
                        </button>
                    </form>

                    <div className="text-center text-xs text-[#4B5563] mt-4">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#F97316] font-semibold hover:underline">
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
