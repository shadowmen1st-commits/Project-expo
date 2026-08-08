import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, Clock, Award } from 'lucide-react';
import SocialAuthButtons from '../components/SocialAuthButtons';

export const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please fill in all required fields.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const u = await login(email, password);
            if (u) {
                if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
                    navigate('/admin');
                } else if (u.role === 'WORKER') {
                    navigate('/worker');
                } else if (u.role === 'COMPANY') {
                    navigate('/company');
                } else {
                    navigate('/dashboard');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const quickLogin = (e, p) => {
        setEmail(e);
        setPassword(p);
        setError('');
    };

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] flex flex-col lg:flex-row font-sans">
            {/* Left Brand Panel */}
            <div className="lg:w-1/2 auth-panel-bg p-8 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-[#FEF3C7]">
                <div>
                    {/* HyperLocal Logo */}
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                            <span className="text-[#111827] text-xl font-black">H</span>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#111827]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                    </div>

                    {/* Main Brand Messaging */}
                    <div className="max-w-md my-auto">
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight leading-tight mb-4">
                            Book trusted local help with <span className="text-highlight-gradient">confidence.</span>
                        </h1>
                        <p className="text-[#4B5563] text-base leading-relaxed mb-8">
                            Manage bookings, connect with verified professionals, and track your services from one secure account.
                        </p>

                        {/* Practical Trust Points */}
                        <div className="space-y-4">
                            <div className="flex items-start gap-3.5">
                                <ShieldCheck className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">Identity Verified Professionals</h3>
                                    <p className="text-xs text-[#4B5563]">Government ID checked and background screened for safety.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3.5">
                                <Award className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">Transparent Pricing</h3>
                                    <p className="text-xs text-[#4B5563]">Clear flat-rates upfront without hidden platform charges.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3.5">
                                <Clock className="w-5 h-5 text-[#16A34A] flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-semibold text-[#111827]">Booking Updates & Support</h3>
                                    <p className="text-xs text-[#4B5563]">Real-time status updates and dedicated support assistance.</p>
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
            <div className="lg:w-1/2 bg-[#FFFBEB] p-8 lg:p-16 flex items-center justify-center">
                <div className="w-full max-w-md space-y-8 bg-white border border-[#FEF3C7] rounded-3xl p-8 shadow-md shadow-orange-50/40">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight">Welcome back</h2>
                        <p className="text-sm text-[#4B5563] mt-2">Sign in to manage your account and bookings.</p>
                    </div>

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-4 rounded-xl flex items-start gap-2.5">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#374151] mb-2">
                                Email Address
                            </label>
                            <input 
                                type="email" 
                                name="email"
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                placeholder="name@example.com" 
                                className="w-full input-field-style rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all" 
                                required
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-[#374151]">
                                    Password
                                </label>
                            </div>
                            <div className="relative">
                                <input 
                                    type={showPass ? 'text' : 'password'} 
                                    name="password"
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="••••••••" 
                                    className="w-full input-field-style rounded-xl pl-4 pr-11 py-3 text-sm focus:ring-2 focus:ring-[#FACC15]/25 focus:border-[#F97316] transition-all" 
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
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="w-full btn-primary-gradient font-semibold py-3.5 rounded-xl cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <SocialAuthButtons mode="login" onError={setError}/>

                    {/* Developer Quick Login Panel */}
                    {import.meta.env.DEV && (
                        <div className="pt-4 border-t border-[#FEF3C7] space-y-3">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5563] text-center">
                                Developer Quick Login
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => quickLogin('admin@hyperlocal.com', 'admin123')} 
                                    className="bg-[#FFFDF5] border border-[#FEF3C7] hover:border-[#F97316] text-[#111827] hover:text-[#F97316] text-xs py-2 px-2 rounded-lg cursor-pointer text-center font-medium transition-all"
                                >
                                    Admin
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => quickLogin('customer@hyperlocal.com', 'customer123')} 
                                    className="bg-[#FFFDF5] border border-[#FEF3C7] hover:border-[#F97316] text-[#111827] hover:text-[#F97316] text-xs py-2 px-2 rounded-lg cursor-pointer text-center font-medium transition-all"
                                >
                                    Customer
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => quickLogin('worker@hyperlocal.com', 'worker123')} 
                                    className="bg-[#FFFDF5] border border-[#FEF3C7] hover:border-[#F97316] text-[#111827] hover:text-[#F97316] text-xs py-2 px-2 rounded-lg cursor-pointer text-center font-medium transition-all"
                                >
                                    Worker
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-center text-xs text-[#4B5563]">
                        Don't have an account yet?{' '}
                        <Link to="/register" className="text-[#F97316] font-semibold hover:underline">
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
