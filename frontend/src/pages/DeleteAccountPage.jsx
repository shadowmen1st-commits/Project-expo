import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/api';
import SharedNavbar from '../components/SharedNavbar';
import SharedFooter from '../components/SharedFooter';
import { AlertTriangle, ShieldAlert, Trash2, CheckCircle2 } from 'lucide-react';

export const DeleteAccountPage = () => {
    const { user, login, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleDelete = async () => {
        if (!confirmDelete) {
            setError('Please check the confirmation box to proceed.');
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            await api.delete('/auth/delete-account');
            setSuccess(true);
            await logout();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete account. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    const handleAuthAndDelete = async (e) => {
        e.preventDefault();
        
        if (!confirmDelete) {
            setError('Please check the confirmation box to proceed.');
            return;
        }
        
        if (!email || !password) {
            setError('Please provide your email and password to verify ownership.');
            return;
        }

        setLoading(true);
        setError('');
        
        try {
            // Verify by logging in
            await login(email, password);
            // Once logged in, delete account
            await api.delete('/auth/delete-account');
            setSuccess(true);
            await logout();
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <div className="min-h-screen bg-[#FFFBEB]"></div>;

    return (
        <div className="min-h-screen bg-[#FFFBEB] text-[#111827] flex flex-col font-sans">
            <SharedNavbar />
            
            <main className="flex-grow pt-32 pb-24 px-6">
                <div className="max-w-3xl mx-auto bg-white border border-red-100 rounded-3xl p-8 md:p-12 shadow-sm">
                    
                    {success ? (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h1 className="text-3xl font-black text-[#111827] mb-4">Account Deleted Successfully</h1>
                            <p className="text-[#4B5563] mb-8">
                                Your SHADOWMEN account and associated personal data have been deleted. 
                                We're sorry to see you go!
                            </p>
                            <button onClick={() => navigate('/')} className="px-8 py-3 bg-[#F97316] text-white font-bold rounded-xl hover:bg-orange-600 transition-colors">
                                Return to Homepage
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-7 h-7" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-[#111827]">Delete Your SHADOWMEN Account</h1>
                                    <p className="text-sm text-[#4B5563] mt-1">This action is permanent and cannot be undone.</p>
                                </div>
                            </div>

                            <div className="prose prose-sm max-w-none text-[#4B5563] mb-10">
                                <p>
                                    This page is for SHADOWMEN users to request deletion of their account and associated personal data. 
                                    <strong> Account deletion is different from temporarily disabling or freezing an account.</strong>
                                </p>
                                
                                <h3 className="text-lg font-bold text-[#111827] mt-6 mb-3">What happens when you delete your account?</h3>
                                <ul className="space-y-2 list-disc pl-5">
                                    <li>Your profile, personal information (name, email, phone number), and login credentials will be permanently erased.</li>
                                    <li>You will immediately lose access to your dashboard, wallet, and history.</li>
                                    <li>Active bookings or pending services will be automatically cancelled.</li>
                                </ul>

                                <h3 className="text-lg font-bold text-[#111827] mt-6 mb-3">Data Retention Details</h3>
                                <p>
                                    While your personal identifiable information is deleted or anonymized immediately (processing time: within 24 hours), please note that certain financial and transaction records must legally be retained for compliance, tax, and security purposes, as outlined in our <Link to="/privacy-policy" className="text-[#F97316] hover:underline">Privacy Policy</Link>.
                                </p>

                                <h3 className="text-lg font-bold text-[#111827] mt-6 mb-3">Contact & Support</h3>
                                <p>
                                    If you need help or have questions before deleting, you can reach out to our official support line at <strong>7428151031</strong> or visit <a href="https://www.shadowmen.in" className="text-[#F97316] hover:underline">https://www.shadowmen.in</a>.
                                </p>
                            </div>

                            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-8">
                                <div className="flex items-start gap-3 mb-6">
                                    <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-red-900 text-sm">Verify Ownership to Proceed</h4>
                                        <p className="text-xs text-red-700 mt-1">To prevent unauthorized users from deleting your account, we require verification.</p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-white border border-red-200 text-red-600 text-sm p-4 rounded-xl mb-6 font-medium">
                                        {error}
                                    </div>
                                )}

                                {user ? (
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-xl p-4 border border-red-100 flex justify-between items-center">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Logged in as</p>
                                                <p className="font-semibold text-[#111827] mt-0.5">{user.email}</p>
                                            </div>
                                            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Verified</span>
                                        </div>

                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                checked={confirmDelete}
                                                onChange={(e) => setConfirmDelete(e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-red-900">
                                                I understand that deleting my account is permanent and cannot be undone. I wish to proceed.
                                            </span>
                                        </label>

                                        <button 
                                            onClick={handleDelete}
                                            disabled={loading}
                                            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                            {loading ? 'Processing...' : 'Request Account Deletion'}
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleAuthAndDelete} className="space-y-5">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-red-900 mb-2">
                                                Registered Email
                                            </label>
                                            <input 
                                                type="email" 
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all"
                                                placeholder="Enter your email"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-red-900 mb-2">
                                                Password
                                            </label>
                                            <input 
                                                type="password" 
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all"
                                                placeholder="Enter your password"
                                                required
                                            />
                                        </div>

                                        <label className="flex items-start gap-3 cursor-pointer pt-2">
                                            <input 
                                                type="checkbox" 
                                                className="mt-1 w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                checked={confirmDelete}
                                                onChange={(e) => setConfirmDelete(e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-red-900">
                                                I understand that deleting my account is permanent and cannot be undone. I wish to proceed.
                                            </span>
                                        </label>

                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 mt-2"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                            {loading ? 'Processing...' : 'Verify & Delete Account'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>
            
            <SharedFooter />
        </div>
    );
};

export default DeleteAccountPage;
