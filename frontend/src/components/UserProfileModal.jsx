import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
    X, User, Phone, Mail, Lock, Eye, EyeOff, CheckCircle2,
    AlertCircle, Globe, Bell, ShieldCheck, Camera, Sparkles, KeyRound, Settings
} from 'lucide-react';

export const UserProfileModal = ({ isOpen, onClose }) => {
    const { user, updateUser, restoreSession } = useAuth();
    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'preferences'

    // Profile state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [preferredLanguage, setPreferredLanguage] = useState('en');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPass, setShowCurrentPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // Preferences state
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(true);
    const [inAppAlerts, setInAppAlerts] = useState(true);
    const [prefSaved, setPrefSaved] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhone(user.phone || '');
            setProfileImage(user.profileImage || '');
            setPreferredLanguage(user.preferredLanguage || 'en');
        }
    }, [user, isOpen]);

    if (!isOpen || !user) return null;

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileSuccess('');
        setProfileError('');
        try {
            const res = await api.put('/auth/profile', {
                name,
                phone: phone.trim() || undefined,
                profileImage,
                preferredLanguage
            });
            if (res.data.success) {
                updateUser(res.data.user);
                setProfileSuccess('Profile updated successfully!');
                setTimeout(() => setProfileSuccess(''), 4000);
            }
        } catch (err) {
            setProfileError(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordSuccess('');
        setPasswordError('');

        if (newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters long.');
            setPasswordLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New password and confirm password do not match.');
            setPasswordLoading(false);
            return;
        }

        try {
            const res = await api.put('/auth/change-password', {
                currentPassword,
                newPassword
            });
            if (res.data.success) {
                setPasswordSuccess('Password changed successfully!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setPasswordSuccess(''), 5000);
            }
        } catch (err) {
            setPasswordError(err.response?.data?.message || 'Failed to change password. Verify your current password.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handlePreferencesSave = (e) => {
        e.preventDefault();
        setPrefSaved(true);
        setTimeout(() => setPrefSaved(false), 3000);
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'ADMIN':
            case 'SUPER_ADMIN':
                return { label: 'Admin', color: 'bg-purple-100 text-purple-700 border-purple-300' };
            case 'WORKER':
                return { label: 'Worker / Service Pro', color: 'bg-amber-100 text-amber-800 border-amber-300' };
            case 'COMPANY':
                return { label: 'Company Partner', color: 'bg-blue-100 text-blue-800 border-blue-300' };
            default:
                return { label: 'Customer', color: 'bg-orange-100 text-orange-700 border-orange-300' };
        }
    };

    const roleBadge = getRoleBadge(user.role);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#FEF3C7] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-[#FFFDF5] to-[#FFF7ED] border-b border-[#FEF3C7] p-6 relative flex items-start justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EAB308] text-white flex items-center justify-center font-black text-xl shadow-md overflow-hidden relative group">
                            {profileImage ? (
                                <img src={profileImage} alt={user.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : null}
                            <span className={profileImage ? 'hidden' : 'block'}>
                                {user.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'U'}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-extrabold text-[#111827]">{user.name}</h2>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${roleBadge.color}`}>
                                    {roleBadge.label}
                                </span>
                            </div>
                            <p className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
                                <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                {user.email}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-[#9CA3AF] hover:text-[#111827] p-1.5 rounded-full hover:bg-white/80 transition-all cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Bar */}
                <div className="flex border-b border-[#FEF3C7] bg-[#FFFDF5] px-6 text-xs font-bold flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'profile'
                                ? 'border-[#F97316] text-[#F97316]'
                                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                        }`}
                    >
                        <User className="w-4 h-4" />
                        Profile Info
                    </button>

                    <button
                        onClick={() => setActiveTab('security')}
                        className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'security'
                                ? 'border-[#F97316] text-[#F97316]'
                                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                        }`}
                    >
                        <KeyRound className="w-4 h-4" />
                        Change Password
                    </button>

                    <button
                        onClick={() => setActiveTab('preferences')}
                        className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'preferences'
                                ? 'border-[#F97316] text-[#F97316]'
                                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
                        }`}
                    >
                        <Settings className="w-4 h-4" />
                        Preferences
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    
                    {/* ── PROFILE TAB ── */}
                    {activeTab === 'profile' && (
                        <form onSubmit={handleProfileSubmit} className="space-y-4">
                            {profileSuccess && (
                                <div className="bg-[#F0FDF4] border border-[#86EFAC] p-3 rounded-xl text-xs text-[#16A34A] flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                    <span>{profileSuccess}</span>
                                </div>
                            )}

                            {profileError && (
                                <div className="bg-[#FEF2F2] border border-[#FCA5A5] p-3 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{profileError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Email Address (Read Only)
                                </label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type="email"
                                        value={user.email}
                                        disabled
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Phone Number
                                </label>
                                <div className="relative">
                                    <Phone className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        placeholder="e.g. +91 9876543210"
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Profile Image URL
                                </label>
                                <div className="relative">
                                    <Camera className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type="url"
                                        value={profileImage}
                                        placeholder="https://example.com/photo.jpg"
                                        onChange={(e) => setProfileImage(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Preferred Language
                                </label>
                                <div className="relative">
                                    <Globe className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <select
                                        value={preferredLanguage}
                                        onChange={(e) => setPreferredLanguage(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827] cursor-pointer"
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">Hindi (हिंदी)</option>
                                        <option value="kn">Kannada (ಕನ್ನಡ)</option>
                                        <option value="ta">Tamil (தமிழ்)</option>
                                        <option value="te">Telugu (తెలుగు)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={profileLoading}
                                    className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/20"
                                >
                                    {profileLoading ? 'Saving Profile...' : 'Save Profile Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── SECURITY TAB (PASSWORD CHANGE) ── */}
                    {activeTab === 'security' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            {passwordSuccess && (
                                <div className="bg-[#F0FDF4] border border-[#86EFAC] p-3 rounded-xl text-xs text-[#16A34A] flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                    <span>{passwordSuccess}</span>
                                </div>
                            )}

                            {passwordError && (
                                <div className="bg-[#FEF2F2] border border-[#FCA5A5] p-3 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{passwordError}</span>
                                </div>
                            )}

                            <div className="bg-[#FFFDF5] border border-[#FEF3C7] p-3 rounded-xl text-[11px] text-[#78716C] flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#F97316] flex-shrink-0 mt-0.5" />
                                <span>Ensure your password is at least 6 characters long and combines letters & numbers for maximum account security.</span>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type={showCurrentPass ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        placeholder="Enter current password"
                                        className="w-full pl-9 pr-10 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                                        className="absolute right-3 top-2.5 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                                    >
                                        {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        placeholder="Enter new password (min. 6 chars)"
                                        className="w-full pl-9 pr-10 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPass(!showNewPass)}
                                        className="absolute right-3 top-2.5 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                                    >
                                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[#374151] uppercase tracking-wider mb-1">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
                                    <input
                                        type={showConfirmPass ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="Re-enter new password"
                                        className="w-full pl-9 pr-10 py-2 text-xs border border-[#FEF3C7] rounded-xl bg-[#FFFDF5] focus:border-[#F97316] focus:ring-2 focus:ring-[#FACC15]/35 outline-none transition-all text-[#111827]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                                        className="absolute right-3 top-2.5 text-[#9CA3AF] hover:text-[#111827] cursor-pointer"
                                    >
                                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={passwordLoading}
                                    className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/20"
                                >
                                    {passwordLoading ? 'Updating Password...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── PREFERENCES TAB ── */}
                    {activeTab === 'preferences' && (
                        <form onSubmit={handlePreferencesSave} className="space-y-4">
                            {prefSaved && (
                                <div className="bg-[#F0FDF4] border border-[#86EFAC] p-3 rounded-xl text-xs text-[#16A34A] flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                    <span>Notification preferences saved!</span>
                                </div>
                            )}

                            <div className="space-y-3 border-b border-[#FEF3C7] pb-4">
                                <h3 className="text-xs font-bold text-[#111827] uppercase tracking-wider">Notifications & Alerts</h3>
                                
                                <label className="flex items-center justify-between bg-[#FFFDF5] border border-[#FEF3C7] p-3 rounded-xl cursor-pointer">
                                    <div className="flex items-center gap-2.5">
                                        <Bell className="w-4 h-4 text-[#F97316]" />
                                        <div>
                                            <span className="block text-xs font-bold text-[#111827]">Email Notifications</span>
                                            <span className="block text-[10px] text-[#78716C]">Receive booking updates & receipts via email</span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={emailAlerts}
                                        onChange={(e) => setEmailAlerts(e.target.checked)}
                                        className="w-4 h-4 accent-[#F97316] cursor-pointer"
                                    />
                                </label>

                                <label className="flex items-center justify-between bg-[#FFFDF5] border border-[#FEF3C7] p-3 rounded-xl cursor-pointer">
                                    <div className="flex items-center gap-2.5">
                                        <Phone className="w-4 h-4 text-[#F97316]" />
                                        <div>
                                            <span className="block text-xs font-bold text-[#111827]">SMS Alerts</span>
                                            <span className="block text-[10px] text-[#78716C]">Get instant SMS notifications for booking confirmations</span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={smsAlerts}
                                        onChange={(e) => setSmsAlerts(e.target.checked)}
                                        className="w-4 h-4 accent-[#F97316] cursor-pointer"
                                    />
                                </label>
                            </div>

                            <div className="pt-1">
                                <button
                                    type="submit"
                                    className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-md shadow-orange-500/20"
                                >
                                    Save Preferences
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
