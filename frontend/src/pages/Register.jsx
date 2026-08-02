import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, User, Wrench, ShieldCheck } from 'lucide-react';
import SocialAuthButtons from '../components/SocialAuthButtons';

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !email || !phone || !password || !confirmPassword) {
            setError('Please fill in all required fields.');
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
        setLoading(true);
        try {
            await registerUser({ name, email, phone, password, role });
            setSuccess('Account created successfully! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] flex flex-col lg:flex-row font-sans">
            {/* Left Brand Panel */}
            <div className="lg:w-1/2 auth-panel-bg p-8 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-[#E7E0D8]">
                <div>
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                            <span className="text-white text-xl font-black">H</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#1C1917]">
                            HyperLocal<span className="text-[#E87A1E]">.</span>
                        </span>
                    </div>

                    <div className="max-w-md my-auto">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#1C1917] tracking-tight leading-tight mb-4">
                            Create your <span className="text-highlight-gradient">HyperLocal</span> account
                        </h1>
                        <p className="text-[#57534E] text-base leading-relaxed mb-8">
                            Book reliable local services or start your journey as a verified professional.
                        </p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3.5">
                                <ShieldCheck className="w-5 h-5 text-[#E87A1E] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#1C1917]">For Customers</h3>
                                    <p className="text-xs text-[#78716C]">Instant access to 80+ home service categories with escrow payment protection.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3.5">
                                <Wrench className="w-5 h-5 text-[#E87A1E] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#1C1917]">For Professionals</h3>
                                    <p className="text-xs text-[#78716C]">Set your custom rates, manage bookings, and withdraw earnings directly to your bank.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-xs text-[#A8A29E]">
                    © {new Date().getFullYear()} HyperLocal Marketplace Services Pvt. Ltd. All rights reserved.
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="lg:w-1/2 bg-[#FAF6F0] p-8 lg:p-16 flex items-center justify-center overflow-y-auto">
                <div className="w-full max-w-md space-y-6 bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-extrabold text-[#1C1917] tracking-tight">Create Account</h2>
                        <p className="text-sm text-[#78716C] mt-1">Join HyperLocal to book or offer local services.</p>
                    </div>

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-4 rounded-xl">
                            <span className="font-bold">Error:</span> {error}
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
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-2">
                                I am registering as
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setRole('CUSTOMER')} 
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${role === 'CUSTOMER' ? 'bg-[#FFF5EA] border-[#E87A1E] text-[#E87A1E] font-bold' : 'bg-white border-[#E7E0D8] text-[#78716C] hover:border-[#DCD4C8]'}`}
                                >
                                    <User className="w-4 h-4 text-[#E87A1E]" />
                                    <span className="text-xs">Customer</span>
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setRole('WORKER')} 
                                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${role === 'WORKER' ? 'bg-[#FFF5EA] border-[#E87A1E] text-[#E87A1E] font-bold' : 'bg-white border-[#E7E0D8] text-[#78716C] hover:border-[#DCD4C8]'}`}
                                >
                                    <Wrench className="w-4 h-4 text-[#E87A1E]" />
                                    <span className="text-xs">Professional Worker</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                                Full Name
                            </label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="Rahul Sharma" 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm" 
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                                Email Address
                            </label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                placeholder="name@example.com" 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm" 
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                                Mobile Phone Number
                            </label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#78716C]">+91</span>
                                <input 
                                    type="tel" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                    placeholder="9876543210" 
                                    maxLength={10}
                                    className="w-full input-field-style rounded-xl pl-12 pr-4 py-2.5 text-sm" 
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input 
                                    type={showPass ? 'text' : 'password'} 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="Min. 8 characters" 
                                    className="w-full input-field-style rounded-xl pl-4 pr-11 py-2.5 text-sm" 
                                    required
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPass(p => !p)} 
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                                Confirm Password
                            </label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                placeholder="Re-enter password" 
                                className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm" 
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

                    <div className="text-center text-xs text-[#78716C]">
                        Already have an account?{' '}
                        <Link to="/login" className="text-[#E87A1E] font-semibold hover:underline">
                            Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
