import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../config/api';
import { 
    ArrowLeft, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    Info, 
    Building2, 
    User, 
    Phone, 
    Mail, 
    FileText 
} from 'lucide-react';

export default function AdminCompanyVerification() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal states
    const [activeModal, setActiveModal] = useState(''); // 'info', 'reject', 'suspend'
    const [modalReason, setModalReason] = useState('');
    const [selectedDocIds, setSelectedDocIds] = useState([]);

    const fetchVerificationData = async () => {
        try {
            const res = await axios.get(`/admin/companies/${id}/verification`);
            setProfile(res.data.profile);
            setDocuments(res.data.documents);
        } catch (err) {
            setError('Failed to fetch company verification credentials.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerificationData();
    }, [id]);

    const handleApprove = async () => {
        setError('');
        setSuccess('');
        try {
            await axios.patch(`/admin/companies/${id}/verification/approve`);
            setSuccess('Company verified successfully.');
            fetchVerificationData();
        } catch (err) {
            setError('Approval failed.');
        }
    };

    const handleActionSubmit = async (e) => {
        e.preventDefault();
        if (!modalReason.trim()) {
            setError('Reason must not be empty.');
            return;
        }

        setError('');
        setSuccess('');
        try {
            if (activeModal === 'info') {
                await axios.patch(`/admin/companies/${id}/verification/request-information`, {
                    reason: modalReason,
                    rejectedDocuments: selectedDocIds
                });
                setSuccess('Request for information sent.');
            } else if (activeModal === 'reject') {
                await axios.patch(`/admin/companies/${id}/verification/reject`, {
                    reason: modalReason
                });
                setSuccess('Company KYC verification rejected.');
            } else if (activeModal === 'suspend') {
                await axios.patch(`/admin/companies/${id}/suspend`, {
                    reason: modalReason
                });
                setSuccess('Company account suspended.');
            }

            setModalReason('');
            setActiveModal('');
            setSelectedDocIds([]);
            fetchVerificationData();
        } catch (err) {
            setError('Action failed.');
        }
    };

    const toggleDocSelection = (docId) => {
        setSelectedDocIds(prev => 
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#EAB308] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF6F0] p-8 text-[#1C1917] font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Back Link */}
                <button 
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 text-sm font-semibold text-[#78716C] hover:text-[#1C1917] cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Admin Directory</span>
                </button>

                {error && <div className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-200">{error}</div>}
                {success && <div className="bg-green-50 text-green-700 text-xs p-4 rounded-xl border border-green-200">{success}</div>}

                {/* Company details card */}
                {profile && (
                    <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    profile.verificationStatus === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                }`}>
                                    {profile.verificationStatus}
                                </span>
                                <h1 className="text-3xl font-extrabold tracking-tight mt-2">{profile.companyName}</h1>
                                <p className="text-sm text-[#78716C] mt-1">{profile.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-[#A8A29E] block uppercase font-bold text-[9px]">Business Type</span>
                                    <span className="font-semibold text-sm">{profile.businessType}</span>
                                </div>
                                <div>
                                    <span className="text-[#A8A29E] block uppercase font-bold text-[9px]">Official Website</span>
                                    <a href={profile.website} target="_blank" rel="noreferrer" className="font-semibold text-sm text-[#EAB308] hover:underline">
                                        {profile.website || 'N/A'}
                                    </a>
                                </div>
                                <div>
                                    <span className="text-[#A8A29E] block uppercase font-bold text-[9px]">GSTIN</span>
                                    <span className="font-semibold text-sm">{profile.gstNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[#A8A29E] block uppercase font-bold text-[9px]">PAN Card Number</span>
                                    <span className="font-semibold text-sm">{profile.panNumber || 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[#A8A29E] block uppercase font-bold text-[9px]">Registered Address</span>
                                    <span className="font-semibold text-sm">{profile.address}, {profile.city}, {profile.state} - {profile.pincode}</span>
                                </div>
                            </div>
                        </div>

                        {/* Authorized Rep */}
                        <div className="bg-[#FAF6F0] border border-[#E7E0D8] p-6 rounded-2xl h-fit space-y-4">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-[#78716C] flex items-center gap-1.5">
                                <User className="w-4 h-4 text-[#EAB308]" />
                                <span>Authorized Person</span>
                            </h3>
                            <div className="space-y-2 text-xs">
                                <div>
                                    <p className="font-extrabold text-[#1C1917]">{profile.authorizedPersonName}</p>
                                    <p className="text-[#78716C] mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {profile.authorizedPersonPhone}</p>
                                    <p className="text-[#78716C] mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3" /> {profile.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Documents review grid */}
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-bold">Uploaded Documents</h2>
                    {documents.length === 0 ? (
                        <p className="text-sm text-[#78716C] italic">No documents uploaded by company.</p>
                    ) : (
                        <div className="divide-y divide-[#E7E0D8]">
                            {documents.map(doc => (
                                <div key={doc._id} className="py-4 flex justify-between items-center text-xs">
                                    <div>
                                        <p className="font-bold text-sm text-[#1C1917]">{doc.documentType.replace('_', ' ')}</p>
                                        <p className="text-[10px] text-[#A8A29E] mt-0.5">Status: {doc.status}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <a 
                                            href={doc.documentUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs text-[#EAB308] font-bold hover:underline"
                                        >
                                            View File
                                        </a>
                                        {profile?.verificationStatus === 'UNDER_REVIEW' && (
                                            <input 
                                                type="checkbox"
                                                checked={selectedDocIds.includes(doc._id)}
                                                onChange={() => toggleDocSelection(doc._id)}
                                                className="w-4 h-4 accent-[#EAB308]"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Decision Actions bar */}
                <div className="bg-white border border-[#E7E0D8] p-6 rounded-2xl flex flex-wrap gap-3 justify-end shadow-sm">
                    {profile?.verificationStatus !== 'VERIFIED' && profile?.verificationStatus !== 'APPROVED' && profile?.verificationStatus !== 'SUSPENDED' && (
                        <>
                            <button 
                                onClick={handleApprove}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                                Approve Company Verification
                            </button>
                            <button 
                                onClick={() => { setActiveModal('info'); setError(''); }}
                                className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                                Request Information / Resubmission
                            </button>
                            <button 
                                onClick={() => { setActiveModal('reject'); setError(''); }}
                                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                            >
                                Reject Company
                            </button>
                        </>
                    )}
                    {(profile?.verificationStatus === 'VERIFIED' || profile?.verificationStatus === 'APPROVED') && (
                        <button 
                            onClick={() => { setActiveModal('suspend'); setError(''); }}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                        >
                            Suspend Company
                        </button>
                    )}
                </div>

                {/* Modals for reasons */}
                {activeModal && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl border border-[#E7E0D8] p-8 max-w-md w-full space-y-4">
                            <h3 className="text-lg font-bold capitalize">
                                {activeModal === 'info' ? 'Request KYC Information' : `${activeModal} Company`}
                            </h3>
                            <form onSubmit={handleActionSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">
                                        Mandatory Reason / Notes
                                    </label>
                                    <textarea 
                                        rows={4}
                                        value={modalReason}
                                        onChange={e => setModalReason(e.target.value)}
                                        className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl p-3 text-xs outline-none focus:border-[#EAB308]"
                                        placeholder={`Please specify why you are performing this action...`}
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => { setActiveModal(''); setModalReason(''); setSelectedDocIds([]); }}
                                        className="bg-[#FAF6F0] border border-[#E7E0D8] text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer hover:bg-orange-700"
                                    >
                                        Submit Decision
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
