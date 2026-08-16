import React, { useState, useEffect } from 'react';
import axios from '../config/api';
import { XCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminCompanies() {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [suspendModal, setSuspendModal] = useState(null); // { id, name }
    const [suspendReason, setSuspendReason] = useState('');
    const [suspending, setSuspending] = useState(false);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/companies');
            setCompanies(res.data.data || []);
        } catch (err) {
            setError('Failed to retrieve companies.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleSuspend = async () => {
        if (!suspendModal || !suspendReason.trim()) return;
        setSuspending(true);
        try {
            await axios.patch(`/admin/companies/${suspendModal.id}/suspend`, { reason: suspendReason.trim() });
            setSuccess(`${suspendModal.name} has been suspended.`);
            setSuspendModal(null);
            setSuspendReason('');
            fetchCompanies();
        } catch (err) {
            setError(err.response?.data?.message || 'Suspension failed.');
        } finally {
            setSuspending(false);
        }
    };

    const handleActivate = async (id, name) => {
        try {
            await axios.post(`/admin/companies/${id}/activate`);
            setSuccess(`${name} reactivated successfully.`);
            fetchCompanies();
        } catch (err) {
            setError(err.response?.data?.message || 'Activation failed.');
        }
    };

    const statusColor = (status) => {
        if (status === 'VERIFIED') return 'bg-green-50 border-green-200 text-green-700';
        if (status === 'SUSPENDED') return 'bg-red-50 border-red-200 text-red-700';
        if (status === 'REJECTED') return 'bg-red-50 border-red-200 text-red-700';
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-sm font-semibold text-[#4B5563]">
                Loading Companies...
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#111827]">Company Administration</h1>
                    <p className="text-sm text-[#4B5563] mt-1">Review profiles, verify business credentials, and manage active status.</p>
                </div>
                <button
                    onClick={fetchCompanies}
                    className="p-2.5 bg-white border border-[#FEF3C7] rounded-xl hover:bg-[#FFFBEB] cursor-pointer"
                >
                    <RefreshCw className="w-5 h-5 text-[#F97316]" />
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-200">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 text-xs p-4 rounded-xl border border-green-200">{success}</div>}

            <div className="bg-white border border-[#FEF3C7] rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#FFFBEB] text-[#4B5563] text-xs uppercase border-b border-[#FEF3C7]">
                            <th className="p-4">Company Name</th>
                            <th className="p-4">Contact</th>
                            <th className="p-4">Verification</th>
                            <th className="p-4">Active Jobs</th>
                            <th className="p-4">Hired</th>
                            <th className="p-4">Spent</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FEF3C7] text-sm">
                        {companies.map(item => (
                            <tr key={item.user?._id} className="hover:bg-[#FFFBEB]/30">
                                <td className="p-4">
                                    <div className="font-bold">{item.profile?.companyName || item.user?.name}</div>
                                    <div className="text-xs text-[#9CA3AF]">{item.profile?.businessType}</div>
                                </td>
                                <td className="p-4 text-xs">
                                    <div>{item.user?.email}</div>
                                    <div>{item.user?.phone}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor(item.profile?.verificationStatus)}`}>
                                        {item.profile?.verificationStatus || 'PENDING'}
                                    </span>
                                </td>
                                <td className="p-4 font-semibold">{item.activeJobs}</td>
                                <td className="p-4 font-semibold">{item.workersHired}</td>
                                <td className="p-4 font-semibold">₹{((item.totalSpending || 0) / 100).toFixed(0)}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button
                                        onClick={() => navigate(`/admin/companies/${item.user?._id}/verification`)}
                                        className="text-xs bg-[#FFFBEB] border border-[#FEF3C7] text-[#F97316] font-bold px-2.5 py-1 rounded-lg hover:bg-[#FEF3C7] cursor-pointer"
                                    >
                                        Review KYC
                                    </button>
                                    {(item.user?.status === 'ACTIVE' || item.profile?.verificationStatus === 'VERIFIED') ? (
                                        <button
                                            onClick={() => {
                                                setError(''); setSuccess('');
                                                setSuspendModal({ id: item.user?._id, name: item.profile?.companyName || item.user?.name });
                                            }}
                                            className="text-xs bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer hover:bg-red-700"
                                        >
                                            Suspend
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setError(''); setSuccess('');
                                                handleActivate(item.user?._id, item.profile?.companyName || item.user?.name);
                                            }}
                                            className="text-xs bg-green-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer hover:bg-green-700"
                                        >
                                            Activate
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {companies.length === 0 && (
                    <div className="p-8 text-center text-sm text-[#9CA3AF]">No companies registered yet.</div>
                )}
            </div>

            {/* Suspend Reason Modal */}
            {suspendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 border border-[#E7E0D8]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                                <XCircle className="w-5 h-5 text-[#EF4444]" />
                            </div>
                            <h2 className="font-extrabold text-[#1C1917] text-base">Suspend Company?</h2>
                        </div>
                        <p className="text-sm text-[#78716C] mb-4">
                            Suspending <span className="font-bold text-[#1C1917]">{suspendModal.name}</span> will block all their operations.
                        </p>
                        <label className="block text-xs font-bold text-[#44403C] mb-1">Reason for suspension *</label>
                        <textarea
                            value={suspendReason}
                            onChange={e => setSuspendReason(e.target.value)}
                            placeholder="e.g. Repeated policy violations, fraudulent listings..."
                            rows={3}
                            className="w-full border border-[#E7E0D8] rounded-xl px-3 py-2 text-xs text-[#1C1917] resize-none focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setSuspendModal(null); setSuspendReason(''); }}
                                disabled={suspending}
                                className="flex-1 bg-[#FAF6F0] border border-[#E7E0D8] text-[#44403C] font-bold text-xs py-2.5 rounded-xl hover:bg-[#F0EBE3] transition-colors cursor-pointer disabled:opacity-50"
                            >Cancel</button>
                            <button
                                onClick={handleSuspend}
                                disabled={suspending || !suspendReason.trim()}
                                className="flex-1 bg-[#EF4444] text-white font-bold text-xs py-2.5 rounded-xl hover:bg-[#DC2626] transition-colors cursor-pointer disabled:opacity-50"
                            >{suspending ? 'Suspending...' : 'Confirm Suspend'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
