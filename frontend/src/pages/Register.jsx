import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, User, Wrench, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import SocialAuthButtons from '../components/SocialAuthButtons';

// Mirror of backend Zod password rules
const passwordRules = [
    { id: 'len',    label: 'At least 8 characters',  test: (p) => p.length >= 8 },
    { id: 'letter', label: 'Contains a letter (A-Z)', test: (p) => /[A-Za-z]/.test(p) },
    { id: 'number', label: 'Contains a number (0-9)', test: (p) => /\d/.test(p) },
];

export const Register = () => {
    const { registerUser } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [role, setRole] = useState('CUSTOMER');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);
    const [conflictField, setConflictField] = useState('');
    const submitInFlight = useRef(false);
    const phoneInputRef = useRef(null);
    const emailInputRef = useRef(null);

    const checks = useMemo(() => passwordRules.map(r => ({ ...r, pass: r.test(password) })), [password]);
    const allChecksPassed = checks.every(c => c.pass);
    const passedCount = checks.filter(c => c.pass).length;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitInFlight.current) return;
        if (!name || !email || !phone || !password || !confirmPassword) {
            setError('Please fill in all required fields.');
            return;
        }
        if (!allChecksPassed) {
            setPasswordTouched(true);
            const failedRule = checks.find(c => !c.pass);
            setError(`Password issue: ${failedRule?.label}.`);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (phone.length !== 10 || !/^\d+$/.test(phone)) {
            setError('Phone number must be exactly 10 digits.');
            return;
        }
        setError('');
        setConflictField('');
        submitInFlight.current = true;
        setLoading(true);
        try {
            await registerUser({ name, email, phone, password, role });
            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            const field = err.response?.data?.field;
            setConflictField(field || '');
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
            if (field === 'phone') phoneInputRef.current?.focus();
            if (field === 'email') emailInputRef.current?.focus();
        } finally {
            submitInFlight.current = false;
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] flex flex-col lg:flex-row font-sans">
            {/* Left Brand Panel */}
            <div className="lg:w-1/2 auth-panel-bg p-8 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-[#FEF3C7]">
                <div>
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                            <span className="text-[#111827] text-xl font-black">H</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#111827]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                    </div>

                    <div className="max-w-md my-auto">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight leading-tight mb-4">
                            Create your <span className="text-highlight-gradient">HyperLocal</span> account
                        </h1>
                        <p className="text-[#4B5563] text-base leading-relaxed mb-8">
                            Book reliable local services or start your journey as a verified professional.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3.5">
                                <ShieldCheck className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">For Customers</h3>
                                    <p className="text-xs text-[#4B5563]">Instant access to 80+ home service categories with escrow payment protection.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3.5">
                                <Wrench className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">For Professionals</h3>
                                    <p className="text-xs text-[#4B5563]">Set your custom rates, manage bookings, and withdraw earnings directly to your bank.</p>
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
            <div className="lg:w-1/2 bg-[#FFFBEB] p-8 lg:p-16 flex items-center justify-center overflow-y-auto">
                <div className="w-full max-w-md space-y-6 bg-white border border-[#FEF3C7] rounded-3xl p-8 shadow-md shadow-orange-50/40">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight">Create Account</h2>
                        <p className="text-sm text-[#4B5563] mt-1">Join HyperLocal to book or offer local services.</p>
                    </div>

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-4 rounded-xl">
                            <span className="font-bold">Error:</span> {error}
                            {conflictField && <Link to="/login" className="block mt-2 font-bold underline">Sign in to the existing account</Link>}
                        </div>
                    )}

                    {success && (
                        <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] text-xs p-4 rounded-xl">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Account Role Selector */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-2">
                                I am registering as
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setRole('CUSTOMER')} 
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${role === 'CUSTOMER' ? 'bg-[#FFEDD5] border-[#F97316] text-[#F97316] font-bold' : 'bg-white border-[#FEF3C7] text-[#4B5563] hover:border-[#FCD34D]'}`}
                                >
                                    <User className="w-4 h-4 text-[#F97316]" />
                                    <span className="text-xs">Customer</span>
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setRole('WORKER')} 
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${role === 'WORKER' ? 'bg-[#FFEDD5] border-[#F97316] text-[#F97316] font-bold' : 'bg-white border-[#FEF3C7] text-[#4B5563] hover:border-[#FCD34D]'}`}
                                >
                                    <Wrench className="w-4 h-4 text-[#F97316]" />
                                    <span className="text-xs">Professional Worker</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">
                                Full Name
                            </label>
                            <input 
                                type="text" 
                                name="name"
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="Rahul Sharma" 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">
                                Email Address
                            </label>
                            <input 
                                ref={emailInputRef}
                                type="email" 
                                name="email"
                                value={email} 
                                onChange={e => { setEmail(e.target.value); if (conflictField === 'email') { setConflictField(''); setError(''); } }}
                                placeholder="name@example.com" 
                                className={`w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all ${conflictField === 'email' ? 'border-[#DC2626]' : ''}`}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">
                                Mobile Phone Number
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4B5563]">+91</span>
                                <input 
                                    ref={phoneInputRef}
                                    type="tel" 
                                    name="phone"
                                    value={phone} 
                                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); if (conflictField === 'phone') { setConflictField(''); setError(''); } }}
                                    placeholder="9876543210" 
                                    maxLength={10}
                                    className={`w-full input-field-style rounded-xl pl-12 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all ${conflictField === 'phone' ? 'border-[#DC2626]' : ''}`}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    name="password"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setPasswordTouched(true); setError(''); }}
                                    onBlur={() => setPasswordTouched(true)}
                                    placeholder="Min. 8 chars, 1 letter, 1 number"
                                    className={`w-full input-field-style rounded-xl pl-4 pr-11 py-2.5 text-sm transition-colors focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] ${
                                        passwordTouched && !allChecksPassed
                                            ? 'border-[#DC2626] focus:border-[#DC2626]'
                                            : passwordTouched && allChecksPassed
                                                ? 'border-[#16A34A] focus:border-[#16A34A]'
                                                : ''
                                    }`}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#111827] cursor-pointer"
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Real-time password rule checklist */}
                            {(passwordTouched && password.length > 0) && (
                                <div className="mt-2 space-y-1.5">
                                    {/* Strength bar */}
                                    <div className="flex gap-1">
                                        {[0, 1, 2].map(i => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                    i < passedCount
                                                        ? passedCount === 1 ? 'bg-[#DC2626]'
                                                            : passedCount === 2 ? 'bg-[#F59E0B]'
                                                                : 'bg-[#16A34A]'
                                                        : 'bg-[#FEF3C7]'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    {/* Individual rule indicators */}
                                    {checks.map(c => (
                                        <div key={c.id} className="flex items-center gap-1.5">
                                            {c.pass
                                                ? <CheckCircle2 className="w-3 h-3 text-[#16A34A] flex-shrink-0"/>
                                                : <XCircle className="w-3 h-3 text-[#DC2626] flex-shrink-0"/>}
                                            <span className={`text-[10px] ${c.pass ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-1.5">
                                Confirm Password
                            </label>
                            <input 
                                type="password" 
                                name="confirmPassword"
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                placeholder="Re-enter password" 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all" 
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="w-full btn-primary-gradient font-semibold py-3.5 rounded-xl cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? 'Creating account...' : `Register as ${role === 'CUSTOMER' ? 'Customer' : 'Worker'}`}
                        </button>
                    </form>

                    <SocialAuthButtons mode="signup" role={role} onError={setError}/>

                    <div className="text-center text-xs text-[#4B5563]">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#F97316] font-semibold hover:underline">
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
