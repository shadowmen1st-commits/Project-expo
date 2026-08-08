import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldCheck, 
    FileText, 
    UploadCloud, 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    ArrowLeft, 
    HelpCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DOCUMENT_LABELS = {
    BUSINESS_REGISTRATION: 'Business Registration / Incorporation Certificate',
    ADDRESS_PROOF: 'Business Address Proof',
    GST_CERTIFICATE: 'GST Certificate',
    AUTHORIZED_PERSON_ID: 'Authorized Person ID Proof',
    COMPANY_PAN: 'Company PAN Card'
};

export default function CompanyVerification() {
    const navigate = useNavigate();
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadingDoc, setUploadingDoc] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchVerificationStatus = async () => {
        try {
            const res = await axios.get('/api/company/verification');
            setStatusData(res.data);
        } catch (err) {
            setError('Failed to fetch verification status.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerificationStatus();
    }, []);

    const handleFileChange = (e, type) => {
        setSelectedFile(e.target.files[0]);
        setUploadingDoc(type);
    };

    const handleUpload = async (type) => {
        if (!selectedFile) {
            setError('Please select a file to upload.');
            return;
        }

        setError('');
        setSuccess('');
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentType', type);

        try {
            await axios.post('/api/company/verification/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSuccess('Document uploaded successfully.');
            setSelectedFile(null);
            setUploadingDoc('');
            fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed.');
        }
    };

    const handleSubmitKYC = async () => {
        setError('');
        setSuccess('');
        try {
            const res = await axios.post('/api/company/verification/submit');
            setSuccess('KYC verification submitted successfully.');
            fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Submission failed.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const { verificationStatus, progress, checklist, documents } = statusData || {};

    return (
        <div className="min-h-screen bg-[#FFFBEB] p-8 text-[#111827] font-sans">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Back button */}
                <button 
                    onClick={() => navigate('/company')}
                    className="flex items-center gap-2 text-sm font-semibold text-[#4B5563] hover:text-[#111827] cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                </button>

                {/* Status card */}
                <div className="bg-white border border-[#FEF3C7] rounded-3xl p-8 shadow-sm space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight">Company Verification / KYC</h1>
                            <p className="text-sm text-[#4B5563] mt-1">Submit your official business credentials for administrator approval.</p>
                        </div>
                        <span className={`text-xs font-black uppercase px-4 py-1.5 rounded-full border ${
                            verificationStatus === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-700' :
                            verificationStatus === 'UNDER_REVIEW' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            verificationStatus === 'NEEDS_INFORMATION' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                            verificationStatus === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' :
                            verificationStatus === 'SUSPENDED' ? 'bg-red-100 border-red-300 text-red-800' :
                            'bg-gray-50 border border-gray-200 text-gray-700'
                        }`}>
                            {verificationStatus?.replace('_', ' ')}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-[#4B5563]">
                            <span>Verification Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-[#FFFBEB] h-3 rounded-full overflow-hidden border border-[#FEF3C7]">
                            <div className="bg-[#F97316] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>

                    {/* Message alerts */}
                    {verificationStatus === 'NEEDS_INFORMATION' && statusData.needsInfoReason && (
                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm">Action Required: More Information Needed</h4>
                                <p className="text-xs mt-1 text-yellow-700">"{statusData.needsInfoReason}"</p>
                            </div>
                        </div>
                    )}

                    {verificationStatus === 'REJECTED' && statusData.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm">KYC Rejected</h4>
                                <p className="text-xs mt-1 text-red-700">"{statusData.rejectionReason}"</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">{error}</div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs">{success}</div>
                    )}
                </div>

                {/* Documents Checklist & Uploads */}
                <div className="bg-white border border-[#FEF3C7] rounded-3xl p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-bold">Required Documents Checklist</h2>

                    <div className="divide-y divide-[#FEF3C7]">
                        {Object.keys(DOCUMENT_LABELS).map((type) => {
                            const label = DOCUMENT_LABELS[type];
                            const doc = documents.find(d => d.documentType === type);

                            return (
                                <div key={type} className="py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm text-[#111827]">{label}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                doc ? (
                                                    doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                                    doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                                    'bg-blue-100 text-blue-800'
                                                ) : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {doc ? doc.status : 'REQUIRED'}
                                            </span>
                                            {doc?.rejectionReason && (
                                                <span className="text-[10px] text-red-600 font-medium">Reason: {doc.rejectionReason}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload action */}
                                    {(!doc || doc.status === 'REJECTED') && (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="file" 
                                                id={`file-${type}`}
                                                className="hidden" 
                                                onChange={(e) => handleFileChange(e, type)}
                                            />
                                            <label 
                                                htmlFor={`file-${type}`}
                                                className="bg-[#FFFBEB] hover:bg-[#FEF3C7] border border-[#FEF3C7] text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1.5"
                                            >
                                                <UploadCloud className="w-3.5 h-3.5 text-[#F97316]" />
                                                <span>{uploadingDoc === type && selectedFile ? selectedFile.name : 'Select File'}</span>
                                            </label>
                                            {uploadingDoc === type && selectedFile && (
                                                <button 
                                                    onClick={() => handleUpload(type)}
                                                    className="bg-[#F97316] text-white hover:bg-orange-600 text-xs font-bold px-3.5 py-1.5 rounded-xl cursor-pointer"
                                                >
                                                    Upload
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {doc && doc.status !== 'REJECTED' && (
                                        <a 
                                            href={doc.documentUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs text-[#F97316] font-bold hover:underline"
                                        >
                                            View Uploaded Document
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Final Submit button */}
                {verificationStatus !== 'VERIFIED' && verificationStatus !== 'UNDER_REVIEW' && (
                    <button
                        onClick={handleSubmitKYC}
                        disabled={progress < 100}
                        className="w-full bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl cursor-pointer shadow-md text-sm transition-all"
                    >
                        Submit Verification Profile for Administrator Review
                    </button>
                )}
            </div>
        </div>
    );
}
