import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    ShieldCheck, 
    FileText, 
    UploadCloud, 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    XCircle,
    Info,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DOCUMENT_TYPES = [
    { type: 'BUSINESS_REGISTRATION', label: 'Business Registration Certificate', required: true },
    { type: 'ADDRESS_PROOF', label: 'Business Address Proof', required: true },
    { type: 'AUTHORIZED_PERSON_ID', label: 'Authorized Person ID', required: true },
    { type: 'GST_CERTIFICATE', label: 'GST Certificate', required: false },
    { type: 'COMPANY_PAN', label: 'PAN Card / Business Document', required: false }
];

export default function CompanyVerification() {
    const navigate = useNavigate();
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadingDoc, setUploadingDoc] = useState('');
    const [selectedFiles, setSelectedFiles] = useState({}); // type -> File object
    const [uploadProgress, setUploadProgress] = useState({}); // type -> percentage (number)

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
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB.');
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError('Only PDF, JPEG, and PNG files are allowed.');
            return;
        }

        setError('');
        setSelectedFiles(prev => ({ ...prev, [type]: file }));
    };

    const handleUpload = async (type) => {
        const file = selectedFiles[type];
        if (!file) {
            setError('Please select a file first.');
            return;
        }

        setError('');
        setSuccess('');
        setUploadingDoc(type);
        setUploadProgress(prev => ({ ...prev, [type]: 10 }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', type);

        try {
            setUploadProgress(prev => ({ ...prev, [type]: 50 }));
            await axios.post('/api/company/verification/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadProgress(prev => ({ ...prev, [type]: 100 }));
            setSuccess(`${type.replace('_', ' ')} uploaded successfully.`);
            setSelectedFiles(prev => {
                const updated = { ...prev };
                delete updated[type];
                return updated;
            });
            fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed.');
        } finally {
            setUploadingDoc('');
        }
    };

    const handleSubmitKYC = async () => {
        setError('');
        setSuccess('');
        try {
            await axios.post('/api/company/verification/submit');
            setSuccess('KYC Verification submitted successfully.');
            // Reload user session to update state in guard
            window.location.reload();
        } catch (err) {
            setError(err.response?.data?.message || 'Submission failed.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const { verificationStatus, progress, checklist, documents } = statusData || {};

    const getDocStatus = (type) => {
        const doc = documents?.find(d => d.documentType === type);
        if (!doc) return 'NOT_UPLOADED';
        return doc.status; // 'PENDING', 'APPROVED', 'REJECTED'
    };

    const getDocObject = (type) => {
        return documents?.find(d => d.documentType === type);
    };

    return (
        <div className="min-h-screen bg-[#FFFCF5] text-[#171717] font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Header branding */}
                <div className="flex items-center justify-between border-b border-[#FFF7D6] pb-6">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tracking-tight text-[#171717]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                        <span className="bg-[#FFF7D6] text-[#F97316] text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                            COMPANY
                        </span>
                    </div>
                </div>

                {/* Subtitle / intro */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-extrabold tracking-tight">Verify Your Company</h1>
                    <p className="text-sm text-[#78716C] max-w-2xl">
                        Complete your company verification to start posting part-time jobs and hiring workers.
                    </p>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-5 gap-2 text-center text-[10px] md:text-xs font-bold text-[#78716C] bg-white p-4 rounded-2xl border border-[#FFF7D6] shadow-sm">
                    <div className="text-[#F97316]">1. Profile ✓</div>
                    <div className="text-[#F97316]">2. Details ✓</div>
                    <div className={`${progress >= 40 ? 'text-[#F97316]' : ''}`}>3. Documents</div>
                    <div className={`${progress >= 80 ? 'text-[#F97316]' : ''}`}>4. Review</div>
                    <div className={`${verificationStatus === 'VERIFIED' ? 'text-green-600' : ''}`}>5. Verification</div>
                </div>

                {/* Global Status Message Banners */}
                {verificationStatus === 'UNDER_REVIEW' && (
                    <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-6 text-center">
                        <div className="w-16 h-16 bg-[#FFF7D6] text-[#F97316] rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <Clock className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">⏳ Under Review</h2>
                            <p className="text-sm text-[#78716C] max-w-md mx-auto">
                                Your company documents have been submitted successfully. Our Admin team is reviewing your information.
                            </p>
                            <p className="text-xs text-[#A8A29E]">Estimated next step: Admin verification</p>
                        </div>

                        <div className="max-w-md mx-auto bg-[#FFFCF5] p-5 rounded-2xl border border-[#FFF7D6] text-left space-y-3">
                            <h4 className="font-bold text-xs uppercase text-[#78716C]">Submitted Documents:</h4>
                            {DOCUMENT_TYPES.map(d => {
                                const state = getDocStatus(d.type);
                                if (state !== 'NOT_UPLOADED') {
                                    return (
                                        <div key={d.type} className="flex items-center gap-2 text-xs font-semibold">
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span>{d.label}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}

                {verificationStatus === 'NEEDS_INFORMATION' && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-3xl space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-base">⚠ Additional Information Required</h3>
                                <p className="text-sm mt-1 font-medium">"{statusData.needsInfoReason || 'Please review document uploads.'}"</p>
                            </div>
                        </div>
                    </div>
                )}

                {verificationStatus === 'REJECTED' && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-3xl space-y-4">
                        <div className="flex items-start gap-3">
                            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-base">❌ Verification Rejected</h3>
                                <p className="text-sm mt-1 font-medium">"{statusData.rejectionReason || 'Documents did not meet criteria.'}"</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => navigate('/support')} className="bg-white border border-red-200 text-red-800 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-100">
                                Contact Support
                            </button>
                        </div>
                    </div>
                )}

                {verificationStatus === 'VERIFIED' && (
                    <div className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-3xl text-center space-y-6">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle className="w-10 h-10" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black">✓ COMPANY VERIFIED</h2>
                            <p className="text-sm mt-1 text-green-700 max-w-md mx-auto">
                                Congratulations! Your company has been verified. You can now post part-time jobs and hire workers.
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                // Forces verificationStatus refresh inguard
                                window.location.href = '/company';
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl text-sm"
                        >
                            Go To Company Dashboard
                        </button>
                    </div>
                )}

                {/* Verification Card for Pending/NeedsInfo states */}
                {(verificationStatus === 'PENDING' || verificationStatus === 'NEEDS_INFORMATION') && (
                    <div className="space-y-8">
                        
                        {/* Summary checklist card */}
                        <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold">Company Verification</h2>
                                    <p className="text-xs text-[#78716C] mt-1">Review the checklist and upload missing certificates.</p>
                                </div>
                                <span className="bg-[#FFF7D6] text-[#F97316] text-[10px] font-black uppercase px-3 py-1 rounded-full border border-orange-200">
                                    {verificationStatus}
                                </span>
                            </div>

                            <div className="space-y-3 border-t border-[#FFF7D6] pt-6">
                                <div className="flex items-center gap-2.5 text-sm font-semibold">
                                    <span className="text-green-600">✓</span>
                                    <span>Company Profile</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-sm font-semibold">
                                    <span className="text-green-600">✓</span>
                                    <span>Business Information</span>
                                </div>
                                {DOCUMENT_TYPES.map(doc => {
                                    const state = getDocStatus(doc.type);
                                    const isOk = state === 'APPROVED' || state === 'PENDING';
                                    return (
                                        <div key={doc.type} className="flex items-center gap-2.5 text-sm font-semibold text-[#171717]">
                                            <span className={isOk ? 'text-green-600' : 'text-gray-400'}>
                                                {isOk ? '✓' : '○'}
                                            </span>
                                            <span className={!isOk ? 'text-[#78716C]' : ''}>{doc.label} {doc.required ? '' : '(Optional)'}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <button 
                                onClick={() => document.getElementById('documents-upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                                className="bg-[#FFFBEB] hover:bg-[#FFF7D6] text-[#F97316] font-bold text-xs px-4 py-2.5 rounded-xl border border-[#FFF7D6] cursor-pointer flex items-center gap-1.5"
                            >
                                <span>Continue Verification</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Document upload cards list */}
                        <div id="documents-upload-section" className="space-y-6">
                            <h3 className="text-lg font-bold">Upload Verification Documents</h3>
                            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">{error}</div>}
                            {success && <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-xl">{success}</div>}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {DOCUMENT_TYPES.map(doc => {
                                    const state = getDocStatus(doc.type);
                                    const dbDoc = getDocObject(doc.type);
                                    const selectedFile = selectedFiles[doc.type];

                                    return (
                                        <div key={doc.type} className="bg-white border border-[#FFF7D6] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="font-bold text-sm text-[#171717]">{doc.label}</h4>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${doc.required ? 'bg-orange-50 text-[#F97316]' : 'bg-gray-50 text-gray-500'}`}>
                                                        {doc.required ? 'Required' : 'Optional'}
                                                    </span>
                                                </div>
                                                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                    state === 'APPROVED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                    state === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    state === 'PENDING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                    'bg-gray-50 text-gray-500 border border-gray-200'
                                                }`}>
                                                    {state}
                                                </span>
                                            </div>

                                            {state === 'REJECTED' && dbDoc?.rejectionReason && (
                                                <div className="bg-red-50 text-red-800 text-[11px] p-2.5 rounded-xl">
                                                    <strong>Document rejected:</strong> {dbDoc.rejectionReason}
                                                </div>
                                            )}

                                            <div className="space-y-3 pt-2">
                                                {uploadingDoc === doc.type && (
                                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                        <div className="bg-[#F97316] h-full" style={{ width: `${uploadProgress[doc.type] || 0}%` }}></div>
                                                    </div>
                                                )}

                                                {selectedFile && (
                                                    <p className="text-[11px] text-[#78716C] italic font-semibold">Selected: {selectedFile.name}</p>
                                                )}

                                                {state !== 'APPROVED' ? (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="file" 
                                                            id={`input-${doc.type}`}
                                                            className="hidden" 
                                                            onChange={(e) => handleFileChange(e, doc.type)}
                                                        />
                                                        <label 
                                                            htmlFor={`input-${doc.type}`}
                                                            className="bg-white hover:bg-[#FFFCF5] border border-[#FFF7D6] text-xs font-bold px-3 py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 flex-1"
                                                        >
                                                            <UploadCloud className="w-4 h-4 text-[#F97316]" />
                                                            <span>{selectedFile ? 'Change File' : 'Select File'}</span>
                                                        </label>
                                                        {selectedFile && (
                                                            <button 
                                                                onClick={() => handleUpload(doc.type)}
                                                                className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                                                            >
                                                                Upload
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-green-600 font-bold">✓ Approved and verified.</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Submit bar */}
                        <div className="pt-8 border-t border-[#FFF7D6] flex justify-end">
                            <button
                                onClick={handleSubmitKYC}
                                disabled={progress < 100}
                                className="bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-2xl cursor-pointer text-sm shadow-sm transition-all"
                            >
                                Submit For Verification
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
