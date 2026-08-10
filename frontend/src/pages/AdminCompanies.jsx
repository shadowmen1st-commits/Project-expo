import React, { useState, useEffect } from 'react';
import axios from '../config/api';
import { ShieldCheck, XCircle, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminCompanies() {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/companies');
            setCompanies(res.data.data);
        } catch (err) {
            setError('Failed to retrieve companies.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const handleAction = async (id, action) => {
        try {
            await axios.post(`/admin/companies/${id}/${action}`);
            setSuccess(`Company ${action} action executed successfully.`);
            fetchCompanies();
        } catch (err) {
            setError('Action failed.');
        }
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
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        item.profile?.verificationStatus === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                    }`}>
                                        {item.profile?.verificationStatus || 'PENDING'}
                                    </span>
                                </td>
                                <td className="p-4 font-semibold">{item.activeJobs}</td>
                                <td className="p-4 font-semibold">{item.workersHired}</td>
                                <td className="p-4 font-semibold">₹{(item.totalSpending/100).toFixed(0)}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button 
                                        onClick={() => navigate(`/admin/companies/${item.user?._id}/verification`)}
                                        className="text-xs bg-[#FFFBEB] border border-[#FEF3C7] text-[#F97316] font-bold px-2.5 py-1 rounded-lg hover:bg-[#FEF3C7] cursor-pointer"
                                    >
                                        Review KYC
                                    </button>
                                    {item.user?.status === 'ACTIVE' ? (
                                        <button 
                                            onClick={() => handleAction(item.user?._id, 'suspend')}
                                            className="text-xs bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                                        >
                                            Suspend
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleAction(item.user?._id, 'activate')}
                                            className="text-xs bg-green-600 text-white font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                                        >
                                            Activate
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
