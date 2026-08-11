import React, { useState, useEffect } from 'react';
import axios from '../config/api';
import { 
    ShieldCheck, 
    FileText, 
    UploadCloud, 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    XCircle,
    Info,
    ArrowRight,
    ArrowLeft,
    Trash2,
    Eye,
    Building,
    User,
    Phone,
    Mail,
    Globe,
    MapPin,
    Briefcase,
    Calendar,
    Edit3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DOCUMENT_TYPES = [
    { type: 'BUSINESS_REGISTRATION', label: 'Business Registration Certificate', required: true, desc: 'Certificate of Incorporation or Shop & Establishment License' },
    { type: 'ADDRESS_PROOF', label: 'Business Address Proof', required: true, desc: 'Utility Bill, Rent Agreement or Property Tax Receipt' },
    { type: 'AUTHORIZED_PERSON_ID', label: 'Authorized Person ID Proof', required: true, desc: 'Aadhaar Card, Passport, or Voter ID of Authorized Representative' },
    { type: 'COMPANY_PAN', label: 'Company / Firm PAN Card', required: true, desc: 'PAN Card registered under the company name' },
    { type: 'GST_CERTIFICATE', label: 'GST Certificate', required: false, desc: 'GST Registration Certificate (Form REG-06)' },
    { type: 'OTHER_SUPPORTING_DOCUMENT', label: 'Other Supporting Document', required: false, desc: 'Any additional license or trade endorsement' }
];

export default function CompanyVerification() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploadingDoc, setUploadingDoc] = useState('');
    const [selectedFiles, setSelectedFiles] = useState({}); // type -> File object
    const [uploadProgress, setUploadProgress] = useState({}); // type -> percentage
    const [confirmedDeclaration, setConfirmedDeclaration] = useState(false);

    // Form data states
    const [profileForm, setProfileForm] = useState({
        companyName: '',
        email: '',
        phone: '',
        authorizedPersonName: '',
        authorizedPersonPhone: '',
        companyType: 'Private Limited',
        businessType: 'Event Management',
        website: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
    });

    const [detailsForm, setDetailsForm] = useState({
        legalCompanyName: '',
        tradeName: '',
        companyType: 'Private Limited',
        registrationNumber: '',
        dateOfIncorporation: '',
        numberOfEmployees: '10-50',
        industry: 'Services',
        description: '',
        registeredAddress: '',
        operationalAddress: '',
        gstNumber: '',
        panNumber: ''
    });

    const fetchVerificationStatus = async (isInitial = false) => {
        try {
            const res = await axios.get('/company/verification');
            setStatusData(res.data);

            const prof = res.data.profile || {};
            setProfileForm({
                companyName: prof.companyName || '',
                email: prof.email || '',
                phone: prof.phone || '',
                authorizedPersonName: prof.authorizedPersonName || prof.contactPersonName || '',
                authorizedPersonPhone: prof.authorizedPersonPhone || prof.contactPersonPhone || '',
                companyType: prof.companyType || prof.businessType || 'Private Limited',
                businessType: prof.businessType || prof.companyType || 'Event Management',
                website: prof.website || '',
                address: prof.address || '',
                city: prof.city || '',
                state: prof.state || '',
                pincode: prof.pincode || '',
                country: prof.country || 'India'
            });

            setDetailsForm({
                legalCompanyName: prof.legalCompanyName || prof.companyName || '',
                tradeName: prof.tradeName || prof.companyName || '',
                companyType: prof.companyType || prof.businessType || 'Private Limited',
                registrationNumber: prof.registrationNumber || '',
                dateOfIncorporation: prof.dateOfIncorporation ? prof.dateOfIncorporation.split('T')[0] : '',
                numberOfEmployees: prof.numberOfEmployees || '10-50',
                industry: prof.industry || 'Services',
                description: prof.description || '',
                registeredAddress: prof.registeredAddress || prof.address || '',
                operationalAddress: prof.operationalAddress || prof.address || '',
                gstNumber: prof.gstNumber || '',
                panNumber: prof.panNumber || ''
            });

            if (isInitial) {
                const steps = res.data.completedSteps || [];
                const status = res.data.verificationStatus;
                if (status === 'UNDER_REVIEW' || status === 'PENDING' || status === 'VERIFIED' || status === 'APPROVED' || status === 'REJECTED') {
                    setCurrentStep(5);
                } else if (steps.includes('DOCUMENTS')) {
                    setCurrentStep(4);
                } else if (steps.includes('DETAILS')) {
                    setCurrentStep(3);
                } else if (steps.includes('PROFILE')) {
                    setCurrentStep(2);
                } else {
                    setCurrentStep(1);
                }
            }
        } catch (err) {
            setError('Failed to fetch company verification credentials.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVerificationStatus(true);
    }, []);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            await axios.post('/company/verification/profile', profileForm);
            setSuccess('Step 1 Profile details saved.');
            await fetchVerificationStatus();
            setCurrentStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save profile details.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDetails = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Client validation for GST and PAN formats if entered
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;

        if (detailsForm.gstNumber && !gstRegex.test(detailsForm.gstNumber.trim())) {
            setError('Invalid GSTIN format (15 characters required, e.g. 22AAAAA0000A1Z5).');
            return;
        }

        if (detailsForm.panNumber && !panRegex.test(detailsForm.panNumber.trim())) {
            setError('Invalid PAN Card format (10 characters required, e.g. ABCDE1234F).');
            return;
        }

        setSaving(true);
        try {
            await axios.post('/company/verification/details', detailsForm);
            setSuccess('Step 2 Business details saved.');
            await fetchVerificationStatus();
            setCurrentStep(3);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save business details.');
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            setError('File size must be less than 10MB.');
            return;
        }

        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError('Only PDF, JPEG, and PNG files are accepted.');
            return;
        }

        setError('');
        setSelectedFiles(prev => ({ ...prev, [type]: file }));
    };

    const handleUpload = async (type) => {
        const file = selectedFiles[type];
        if (!file) {
            setError('Please select a file to upload.');
            return;
        }

        setError('');
        setSuccess('');
        setUploadingDoc(type);
        setUploadProgress(prev => ({ ...prev, [type]: 20 }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', type);

        try {
            setUploadProgress(prev => ({ ...prev, [type]: 60 }));
            await axios.post('/company/verification/documents', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setUploadProgress(prev => ({ ...prev, [type]: 100 }));
            setSuccess(`${type.replace(/_/g, ' ')} uploaded successfully.`);
            setSelectedFiles(prev => {
                const updated = { ...prev };
                delete updated[type];
                return updated;
            });
            await fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Document upload failed.');
        } finally {
            setUploadingDoc('');
        }
    };

    const handleDeleteDoc = async (type) => {
        if (!window.confirm(`Are you sure you want to remove this document?`)) return;
        setError('');
        setSuccess('');
        try {
            await axios.delete(`/company/verification/documents/${type}`);
            setSuccess('Document removed.');
            await fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove document.');
        }
    };

    const handleSubmitKYC = async () => {
        if (!confirmedDeclaration) {
            setError('Please check the confirmation box to verify your submission.');
            return;
        }
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            await axios.post('/company/verification/submit');
            setSuccess('KYC Verification application submitted successfully.');
            await fetchVerificationStatus();
            setCurrentStep(5);
        } catch (err) {
            setError(err.response?.data?.message || 'Submission failed.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-[#78716C]">Loading verification data...</p>
                </div>
            </div>
        );
    }

    const { verificationStatus, progress, documents = [], rejectionReason, needsInfoReason } = statusData || {};

    const getDocStatus = (type) => {
        const doc = documents.find(d => d.documentType === type);
        if (!doc) return 'NOT_UPLOADED';
        return doc.status;
    };

    const getDocObject = (type) => documents.find(d => d.documentType === type);

    const mandatoryTypes = ['BUSINESS_REGISTRATION', 'ADDRESS_PROOF', 'AUTHORIZED_PERSON_ID', 'COMPANY_PAN'];
    const mandatoryComplete = mandatoryTypes.every(t => {
        const s = getDocStatus(t);
        return s === 'APPROVED' || s === 'PENDING';
    });

    return (
        <div className="min-h-screen bg-[#FFFCF5] text-[#171717] font-sans p-4 md:p-10">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Header branding */}
                <div className="flex items-center justify-between border-b border-[#FFF7D6] pb-6">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-black tracking-tight text-[#171717]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                        <span className="bg-[#FFF7D6] text-[#F97316] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                            COMPANY VERIFICATION
                        </span>
                    </div>
                    <button 
                        onClick={() => navigate('/company')}
                        className="text-xs font-bold text-[#78716C] hover:text-[#171717] flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Return to Dashboard</span>
                    </button>
                </div>

                {/* Status Intro */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight">Company KYC & Verification</h1>
                    <p className="text-sm text-[#78716C]">
                        Complete your 5-step company profile and document verification to unlock part-time job postings.
                    </p>
                </div>

                {/* Progress Bar & Wizard Step Navigator */}
                <div className="bg-white border border-[#FFF7D6] rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-[#78716C]">
                        <span>KYC Completion Status</span>
                        <span className="text-[#F97316] font-extrabold">{progress || 0}% Complete</span>
                    </div>
                    <div className="w-full bg-[#FFFBEB] h-2.5 rounded-full overflow-hidden border border-[#FFF7D6]">
                        <div className="bg-[#F97316] h-full transition-all duration-500" style={{ width: `${progress || 0}%` }}></div>
                    </div>

                    <div className="grid grid-cols-5 gap-2 text-center text-[10px] md:text-xs font-bold text-[#78716C] pt-2">
                        {[
                            { num: 1, label: 'Profile' },
                            { num: 2, label: 'Business Details' },
                            { num: 3, label: 'Documents' },
                            { num: 4, label: 'Review' },
                            { num: 5, label: 'Verification' }
                        ].map(step => {
                            const isActive = currentStep === step.num;
                            const isDone = currentStep > step.num || (step.num === 5 && (verificationStatus === 'VERIFIED' || verificationStatus === 'APPROVED' || verificationStatus === 'UNDER_REVIEW'));
                            return (
                                <button
                                    key={step.num}
                                    onClick={() => setCurrentStep(step.num)}
                                    className={`py-2 px-1 rounded-xl transition-all border flex flex-col md:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                                        isActive ? 'bg-[#F97316] text-white border-[#F97316] shadow-sm' :
                                        isDone ? 'bg-[#FFFBEB] text-[#F97316] border-[#FFF7D6]' :
                                        'bg-white text-[#A8A29E] border-gray-100 hover:border-gray-200'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                                        isActive ? 'bg-white text-[#F97316]' : isDone ? 'bg-[#F97316] text-white' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                        {isDone ? '✓' : step.num}
                                    </span>
                                    <span className="truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Global Status Error / Success alerts */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="font-semibold">{error}</span>
                        </div>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-700 font-bold">✕</button>
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-4 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="font-semibold">{success}</span>
                        </div>
                        <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-700 font-bold">✕</button>
                    </div>
                )}

                {/* STEP 1: COMPANY PROFILE FORM */}
                {currentStep === 1 && (
                    <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Building className="w-5 h-5 text-[#F97316]" />
                                    <span>Step 1: Organization & Profile</span>
                                </h2>
                                <p className="text-xs text-[#78716C] mt-0.5">Primary contact and location details of your company.</p>
                            </div>
                            <span className="text-xs font-bold text-[#F97316] bg-[#FFF7D6] px-3 py-1 rounded-full">Step 1 of 5</span>
                        </div>

                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Company / Organization Name *</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.companyName}
                                        onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="Apex Event Logistics Pvt Ltd"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Company Email *</label>
                                    <input 
                                        type="email" 
                                        value={profileForm.email}
                                        onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="contact@apexevents.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Company Phone *</label>
                                    <input 
                                        type="tel" 
                                        value={profileForm.phone}
                                        onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="9991110001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Business Type / Category *</label>
                                    <select 
                                        value={profileForm.companyType}
                                        onChange={e => setProfileForm({ ...profileForm, companyType: e.target.value, businessType: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    >
                                        <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                                        <option value="Public Limited">Public Limited</option>
                                        <option value="LLP">Limited Liability Partnership (LLP)</option>
                                        <option value="Partnership">Partnership Firm</option>
                                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                                        <option value="Event Management">Event Management Agency</option>
                                        <option value="Security Services">Security & Facility Services</option>
                                        <option value="Logistics">Logistics & Supply Chain</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Authorized Contact Person Name *</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.authorizedPersonName}
                                        onChange={e => setProfileForm({ ...profileForm, authorizedPersonName: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="Amit Verma"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Authorized Person Mobile *</label>
                                    <input 
                                        type="tel" 
                                        value={profileForm.authorizedPersonPhone}
                                        onChange={e => setProfileForm({ ...profileForm, authorizedPersonPhone: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="9991110011"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Official Website (Optional)</label>
                                    <input 
                                        type="url" 
                                        value={profileForm.website}
                                        onChange={e => setProfileForm({ ...profileForm, website: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="https://apexevents.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Country</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.country}
                                        onChange={e => setProfileForm({ ...profileForm, country: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Street Address *</label>
                                <input 
                                    type="text" 
                                    value={profileForm.address}
                                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                                    className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    required
                                    placeholder="12 Okhla Industrial Area Phase 3"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">City *</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.city}
                                        onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="New Delhi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">State *</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.state}
                                        onChange={e => setProfileForm({ ...profileForm, state: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="Delhi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Pincode *</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.pincode}
                                        onChange={e => setProfileForm({ ...profileForm, pincode: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        required
                                        placeholder="110020"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-[#F97316] hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-2xl cursor-pointer text-xs flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <span>{saving ? 'Saving...' : 'Save & Continue to Step 2'}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* STEP 2: BUSINESS DETAILS FORM */}
                {currentStep === 2 && (
                    <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#F97316]" />
                                    <span>Step 2: Business & Tax Credentials</span>
                                </h2>
                                <p className="text-xs text-[#78716C] mt-0.5">Legal company identification, GST, and PAN information.</p>
                            </div>
                            <span className="text-xs font-bold text-[#F97316] bg-[#FFF7D6] px-3 py-1 rounded-full">Step 2 of 5</span>
                        </div>

                        <form onSubmit={handleSaveDetails} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Legal Company Name</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.legalCompanyName}
                                        onChange={e => setDetailsForm({ ...detailsForm, legalCompanyName: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="Apex Event Logistics Private Limited"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Trade / Brand Name</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.tradeName}
                                        onChange={e => setDetailsForm({ ...detailsForm, tradeName: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="Apex Events"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Registration / CIN Number</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.registrationNumber}
                                        onChange={e => setDetailsForm({ ...detailsForm, registrationNumber: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="U74999DL2021PTC123456"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Date of Incorporation</label>
                                    <input 
                                        type="date" 
                                        value={detailsForm.dateOfIncorporation}
                                        onChange={e => setDetailsForm({ ...detailsForm, dateOfIncorporation: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">GSTIN Number (15 Digits)</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.gstNumber}
                                        onChange={e => setDetailsForm({ ...detailsForm, gstNumber: e.target.value.toUpperCase() })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="07AAAAA0000A1Z5"
                                        maxLength={15}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Company PAN Card Number (10 Digits)</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.panNumber}
                                        onChange={e => setDetailsForm({ ...detailsForm, panNumber: e.target.value.toUpperCase() })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="ABCDE1234F"
                                        maxLength={10}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Industry Sector</label>
                                    <input 
                                        type="text" 
                                        value={detailsForm.industry}
                                        onChange={e => setDetailsForm({ ...detailsForm, industry: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                        placeholder="Events & Manpower Services"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Company Size (Employees)</label>
                                    <select 
                                        value={detailsForm.numberOfEmployees}
                                        onChange={e => setDetailsForm({ ...detailsForm, numberOfEmployees: e.target.value })}
                                        className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    >
                                        <option value="1-10">1-10 employees</option>
                                        <option value="10-50">10-50 employees</option>
                                        <option value="50-200">50-200 employees</option>
                                        <option value="200+">200+ employees</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Registered Business Address</label>
                                <input 
                                    type="text" 
                                    value={detailsForm.registeredAddress}
                                    onChange={e => setDetailsForm({ ...detailsForm, registeredAddress: e.target.value })}
                                    className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    placeholder="Registered office address as per MCA/GST"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Operational Address</label>
                                <input 
                                    type="text" 
                                    value={detailsForm.operationalAddress}
                                    onChange={e => setDetailsForm({ ...detailsForm, operationalAddress: e.target.value })}
                                    className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    placeholder="Main office or warehouse address for ops"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-[#78716C] mb-1">Brief Company Description</label>
                                <textarea 
                                    rows={3}
                                    value={detailsForm.description}
                                    onChange={e => setDetailsForm({ ...detailsForm, description: e.target.value })}
                                    className="w-full bg-[#FFFCF5] border border-[#FFF7D6] rounded-xl p-3 text-xs outline-none focus:border-[#F97316]"
                                    placeholder="Providing event marshals, ticketing clerks, and security personnel across NCR."
                                />
                            </div>

                            <div className="pt-4 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep(1)}
                                    className="bg-white border border-[#FFF7D6] hover:bg-[#FFFCF5] text-xs font-bold px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-1.5"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back</span>
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-[#F97316] hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-2xl cursor-pointer text-xs flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <span>{saving ? 'Saving...' : 'Save & Continue to Step 3'}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* STEP 3: DOCUMENT UPLOAD */}
                {currentStep === 3 && (
                    <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-6">
                        <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <UploadCloud className="w-5 h-5 text-[#F97316]" />
                                    <span>Step 3: Certificate & Document Upload</span>
                                </h2>
                                <p className="text-xs text-[#78716C] mt-0.5">Upload mandatory compliance documents (PDF, JPG, PNG under 10MB).</p>
                            </div>
                            <span className="text-xs font-bold text-[#F97316] bg-[#FFF7D6] px-3 py-1 rounded-full">Step 3 of 5</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {DOCUMENT_TYPES.map(doc => {
                                const state = getDocStatus(doc.type);
                                const dbDoc = getDocObject(doc.type);
                                const selectedFile = selectedFiles[doc.type];

                                return (
                                    <div key={doc.type} className="bg-[#FFFCF5] border border-[#FFF7D6] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-sm text-[#171717]">{doc.label}</h4>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                                    doc.required ? 'bg-orange-100 text-[#F97316]' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {doc.required ? 'Required' : 'Optional'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[#78716C]">{doc.desc}</p>

                                            <div className="pt-1">
                                                <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                                    state === 'APPROVED' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                    state === 'REJECTED' ? 'bg-red-100 text-red-800 border border-red-200' :
                                                    state === 'PENDING' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                    'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}>
                                                    {state === 'NOT_UPLOADED' ? 'Not Uploaded' : state}
                                                </span>
                                            </div>
                                        </div>

                                        {state === 'REJECTED' && dbDoc?.rejectionReason && (
                                            <div className="bg-red-50 text-red-800 text-[11px] p-3 rounded-xl border border-red-200">
                                                <strong>Rejected by Admin:</strong> {dbDoc.rejectionReason}
                                            </div>
                                        )}

                                        <div className="space-y-3 pt-2">
                                            {uploadingDoc === doc.type && (
                                                <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-[#F97316] h-full transition-all" style={{ width: `${uploadProgress[doc.type] || 0}%` }}></div>
                                                </div>
                                            )}

                                            {dbDoc?.documentUrl && (
                                                <div className="bg-white p-3 rounded-xl border border-[#FFF7D6] text-xs flex justify-between items-center">
                                                    <span className="truncate max-w-[180px] font-semibold text-[#171717]">
                                                        {dbDoc.fileName || `${doc.type}.pdf`}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await axios.get(`/company/verification/documents/${dbDoc._id}/view`, { responseType: 'blob' });
                                                                    const url = URL.createObjectURL(new Blob([res.data], { type: dbDoc.mimeType || res.headers['content-type'] || 'application/pdf' }));
                                                                    window.open(url, '_blank');
                                                                } catch (err) {
                                                                    alert('Failed to load document content.');
                                                                }
                                                            }}
                                                            className="text-[#F97316] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>View</span>
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteDoc(doc.type)}
                                                            className="text-red-500 hover:text-red-700 cursor-pointer"
                                                            title="Remove document"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedFile && (
                                                <p className="text-[11px] text-[#78716C] italic font-semibold">
                                                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                                                </p>
                                            )}

                                            <div className="flex gap-2">
                                                <input 
                                                    type="file" 
                                                    id={`input-${doc.type}`}
                                                    className="hidden" 
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => handleFileChange(e, doc.type)}
                                                />
                                                <label 
                                                    htmlFor={`input-${doc.type}`}
                                                    className="bg-white hover:bg-[#FFFBEB] border border-[#FFF7D6] text-xs font-bold px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 flex-1 shadow-sm"
                                                >
                                                    <UploadCloud className="w-4 h-4 text-[#F97316]" />
                                                    <span>{selectedFile ? 'Change File' : dbDoc ? 'Replace Document' : 'Select File'}</span>
                                                </label>
                                                {selectedFile && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleUpload(doc.type)}
                                                        className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                                                    >
                                                        Upload
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-4 flex justify-between border-t border-[#FFF7D6]">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(2)}
                                className="bg-white border border-[#FFF7D6] hover:bg-[#FFFCF5] text-xs font-bold px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentStep(4)}
                                disabled={!mandatoryComplete}
                                className="bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-2xl cursor-pointer text-xs flex items-center gap-2 shadow-sm transition-all"
                            >
                                <span>Continue to Step 4 Review</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: REVIEW STEP */}
                {currentStep === 4 && (
                    <div className="bg-white border border-[#FFF7D6] rounded-3xl p-8 shadow-sm space-y-8">
                        <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-[#F97316]" />
                                    <span>Step 4: Comprehensive Application Review</span>
                                </h2>
                                <p className="text-xs text-[#78716C] mt-0.5">Review all submitted details and documents before final submission to Admin.</p>
                            </div>
                            <span className="text-xs font-bold text-[#F97316] bg-[#FFF7D6] px-3 py-1 rounded-full">Step 4 of 5</span>
                        </div>

                        {/* Profile Summary Card */}
                        <div className="bg-[#FFFCF5] border border-[#FFF7D6] p-6 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-3">
                                <h3 className="font-bold text-sm text-[#171717] flex items-center gap-1.5">
                                    <Building className="w-4 h-4 text-[#F97316]" />
                                    <span>1. Organization & Contact Summary</span>
                                </h3>
                                <button 
                                    onClick={() => setCurrentStep(1)}
                                    className="text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Company Name</span>
                                    <span className="font-bold text-[#171717]">{profileForm.companyName}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Official Email</span>
                                    <span className="font-bold text-[#171717]">{profileForm.email}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Phone</span>
                                    <span className="font-bold text-[#171717]">{profileForm.phone}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Authorized Person</span>
                                    <span className="font-bold text-[#171717]">{profileForm.authorizedPersonName} ({profileForm.authorizedPersonPhone})</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Address</span>
                                    <span className="font-bold text-[#171717]">{profileForm.address}, {profileForm.city}, {profileForm.state} - {profileForm.pincode}</span>
                                </div>
                            </div>
                        </div>

                        {/* Business Details Summary Card */}
                        <div className="bg-[#FFFCF5] border border-[#FFF7D6] p-6 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-3">
                                <h3 className="font-bold text-sm text-[#171717] flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-[#F97316]" />
                                    <span>2. Business Identification & Tax Info</span>
                                </h3>
                                <button 
                                    onClick={() => setCurrentStep(2)}
                                    className="text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Legal Name</span>
                                    <span className="font-bold text-[#171717]">{detailsForm.legalCompanyName || profileForm.companyName}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">Registration No</span>
                                    <span className="font-bold text-[#171717]">{detailsForm.registrationNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">GSTIN</span>
                                    <span className="font-bold text-[#171717]">{detailsForm.gstNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[#78716C] block uppercase font-bold text-[9px]">PAN Card</span>
                                    <span className="font-bold text-[#171717]">{detailsForm.panNumber || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Documents Summary Card */}
                        <div className="bg-[#FFFCF5] border border-[#FFF7D6] p-6 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-3">
                                <h3 className="font-bold text-sm text-[#171717] flex items-center gap-1.5">
                                    <UploadCloud className="w-4 h-4 text-[#F97316]" />
                                    <span>3. Uploaded Verification Documents</span>
                                </h3>
                                <button 
                                    onClick={() => setCurrentStep(3)}
                                    className="text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit Documents</span>
                                </button>
                            </div>

                            <div className="space-y-2 text-xs">
                                {DOCUMENT_TYPES.map(doc => {
                                    const state = getDocStatus(doc.type);
                                    const dbDoc = getDocObject(doc.type);
                                    const isOk = state === 'APPROVED' || state === 'PENDING';
                                    return (
                                        <div key={doc.type} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className={isOk ? 'text-green-600 font-bold' : 'text-gray-400'}>
                                                    {isOk ? '✓' : '○'}
                                                </span>
                                                <span className="font-semibold">{doc.label}</span>
                                            </div>
                                            {dbDoc ? (
                                                <a href={dbDoc.documentUrl} target="_blank" rel="noreferrer" className="text-[#F97316] font-bold hover:underline">
                                                    View File ({dbDoc.fileName || 'Attached'})
                                                </a>
                                            ) : (
                                                <span className="text-gray-400 italic">Not Uploaded</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Confirmation Checkbox */}
                        <div className="bg-[#FFFBEB] p-5 rounded-2xl border border-[#FFF7D6] space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={confirmedDeclaration}
                                    onChange={e => setConfirmedDeclaration(e.target.checked)}
                                    className="w-4 h-4 mt-0.5 accent-[#F97316] rounded cursor-pointer"
                                />
                                <span className="text-xs font-bold text-[#171717] leading-relaxed">
                                    I confirm that the information and documents provided are accurate and belong to my company. I understand that submitting false credentials may result in account suspension.
                                </span>
                            </label>
                        </div>

                        <div className="pt-4 flex justify-between border-t border-[#FFF7D6]">
                            <button
                                type="button"
                                onClick={() => setCurrentStep(3)}
                                className="bg-white border border-[#FFF7D6] hover:bg-[#FFFCF5] text-xs font-bold px-6 py-3 rounded-2xl cursor-pointer flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitKYC}
                                disabled={saving || !confirmedDeclaration || !mandatoryComplete}
                                className="bg-[#F97316] hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-2xl cursor-pointer text-xs shadow-sm transition-all flex items-center gap-2"
                            >
                                <span>{saving ? 'Submitting Application...' : 'Submit For Verification'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 5: VERIFICATION STATUS DISPLAY */}
                {currentStep === 5 && (
                    <div className="space-y-6">
                        
                        {/* UNDER REVIEW BANNERS */}
                        {(verificationStatus === 'UNDER_REVIEW' || verificationStatus === 'PENDING') && (
                            <div className="bg-white border border-[#FFF7D6] rounded-3xl p-10 shadow-sm text-center space-y-6">
                                <div className="w-20 h-20 bg-[#FFF7D6] text-[#F97316] rounded-full flex items-center justify-center mx-auto animate-pulse">
                                    <Clock className="w-10 h-10" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-[#171717]">⏳ Verification Application Under Review</h2>
                                    <p className="text-sm text-[#78716C] max-w-md mx-auto">
                                        Your company KYC application has been submitted successfully. Our compliance admin team is reviewing your documents.
                                    </p>
                                    <p className="text-xs font-bold text-[#F97316]">Estimated review duration: 12-24 business hours</p>
                                </div>

                                <div className="max-w-md mx-auto bg-[#FFFCF5] p-5 rounded-2xl border border-[#FFF7D6] text-left space-y-3">
                                    <h4 className="font-bold text-xs uppercase text-[#78716C]">Submitted Document Checklist:</h4>
                                    {DOCUMENT_TYPES.map(d => {
                                        const state = getDocStatus(d.type);
                                        if (state !== 'NOT_UPLOADED') {
                                            return (
                                                <div key={d.type} className="flex items-center gap-2 text-xs font-semibold">
                                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                    <span>{d.label}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>

                                <div className="pt-4">
                                    <button 
                                        onClick={() => navigate('/company')}
                                        className="bg-[#F97316] hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl text-xs"
                                    >
                                        Return to Company Dashboard
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* NEEDS INFORMATION / RESUBMISSION REQUIRED BANNERS */}
                        {(verificationStatus === 'NEEDS_INFORMATION' || verificationStatus === 'RESUBMISSION_REQUIRED') && (
                            <div className="bg-white border border-yellow-200 rounded-3xl p-8 shadow-sm space-y-6">
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-2xl space-y-3">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-base">⚠ Resubmission Required by Compliance Admin</h3>
                                            <p className="text-sm mt-1 font-semibold">"{needsInfoReason || rejectionReason || 'Please review document uploads and provide requested details.'}"</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm">Action Items:</h4>
                                    <p className="text-xs text-[#78716C]">Please update your profile details or upload replacement documents in Step 3, then resubmit.</p>
                                    <button 
                                        onClick={() => setCurrentStep(3)}
                                        className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-6 py-3 rounded-2xl cursor-pointer"
                                    >
                                        Update Documents & Resubmit
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* REJECTED BANNER */}
                        {verificationStatus === 'REJECTED' && (
                            <div className="bg-white border border-red-200 rounded-3xl p-8 shadow-sm space-y-6 text-center">
                                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                                    <XCircle className="w-8 h-8" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-red-600">❌ Verification Rejected</h2>
                                    <p className="text-sm text-[#78716C] max-w-md mx-auto font-medium">
                                        "{rejectionReason || 'Documents did not meet platform verification criteria.'}"
                                    </p>
                                </div>

                                <div className="flex justify-center gap-3">
                                    <button 
                                        onClick={() => setCurrentStep(1)}
                                        className="bg-[#FFFCF5] border border-[#FFF7D6] text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#FFFBEB]"
                                    >
                                        Edit Details
                                    </button>
                                    <button 
                                        onClick={() => navigate('/support')}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs"
                                    >
                                        Contact Support Team
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* APPROVED / VERIFIED BANNER */}
                        {(verificationStatus === 'VERIFIED' || verificationStatus === 'APPROVED') && (
                            <div className="bg-white border border-green-200 rounded-3xl p-10 shadow-sm text-center space-y-6">
                                <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-12 h-12" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-green-700">✓ COMPANY VERIFIED</h2>
                                    <p className="text-sm text-green-800 max-w-md mx-auto font-medium">
                                        Congratulations! Your company verification is complete. You now have full access to post part-time jobs, build workforce teams, and manage workers.
                                    </p>
                                </div>

                                <div className="pt-4">
                                    <button 
                                        onClick={() => window.location.href = '/company'}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3.5 rounded-2xl text-xs shadow-sm"
                                    >
                                        Go To Company Dashboard
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                )}

            </div>
        </div>
    );
}
