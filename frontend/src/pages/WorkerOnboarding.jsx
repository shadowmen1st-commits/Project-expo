import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { 
    Upload, FileText, ArrowRight, ArrowLeft, Check, Loader2, 
    ShieldCheck, Calendar, MapPin, User, Briefcase, Languages, 
    AlertCircle, FileCheck, Info, X, Clock, HelpCircle, CheckCircle2
} from 'lucide-react';
import { getProfileImageUrl } from '../utils/imageUtils';

export const WorkerOnboarding = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Status state
    const [verificationStatus, setVerificationStatus] = useState('INCOMPLETE_PROFILE');
    const [onboardingPercent, setOnboardingPercent] = useState(0);
    const [rejectionReason, setRejectionReason] = useState('');
    const [requiredDocTypes, setRequiredDocTypes] = useState(['AADHAAR', 'PAN', 'ADDRESS_PROOF']);
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [submissionHistory, setSubmissionHistory] = useState([]);

    // Form fields - Step 1: Personal Details
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [phone, setPhone] = useState('');
    const [alternatePhone, setAlternatePhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('India');
    const [profilePhoto, setProfilePhoto] = useState(null); // File object
    const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

    // Form fields - Step 2 & 3: Professional Details & Services
    const [bio, setBio] = useState('');
    const [yearsOfExperience, setYearsOfExperience] = useState(0);
    const [primaryServiceCategoryId, setPrimaryServiceCategoryId] = useState('');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [skillsText, setSkillsText] = useState('');
    const [languagesText, setLanguagesText] = useState('English, Hindi');
    const [hourlyRate, setHourlyRate] = useState(300);
    const [dailyRate, setDailyRate] = useState(2000);
    const [serviceRadiusKm, setServiceRadiusKm] = useState(10);

    // Form fields - Step 4: Documents Upload State
    const [docNumbers, setDocNumbers] = useState({}); // { AADHAAR: '1234...', PAN: '...' }
    const [docFiles, setDocFiles] = useState({}); // { AADHAAR: File, PAN: File }
    const [docExpiries, setDocExpiries] = useState({}); // { DRIVING_LICENSE: '2030-01-01' }
    const [docAuthorities, setDocAuthorities] = useState({}); // { PAN: 'IT Department' }
    const documentOperationIds = useRef({});

    // Step 5: Declarations
    const [declarationAccepted, setDeclarationAccepted] = useState(false);
    const [consentAccepted, setConsentAccepted] = useState(false);

    useEffect(() => {
        const initialize = async () => {
            await fetchCategories();
            await fetchVerificationStatus();
        };
        initialize();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/admin/categories/all');
            if (res.data.success) {
                setCategories(res.data.categories || []);
            }
        } catch (err) {
            console.error('Failed to load categories', err);
        }
    };

    const fetchVerificationStatus = async () => {
        setFetching(true);
        try {
            const res = await api.get('/v1/worker/verification');
            if (res.data.success) {
                const { profile, requiredDocumentTypes, uploadedDocuments, submissionHistory: history } = res.data.data;
                
                setVerificationStatus(profile.verificationStatus || 'INCOMPLETE_PROFILE');
                setOnboardingPercent(profile.onboardingProgressPercent || 0);
                setRejectionReason(profile.rejectionReason || '');
                setRequiredDocTypes(requiredDocumentTypes || ['AADHAAR', 'PAN', 'ADDRESS_PROOF']);
                setUploadedDocs(uploadedDocuments || []);
                setSubmissionHistory(history || []);

                // Pre-fill profile details
                if (profile.fullName) setFullName(profile.fullName);
                if (profile.dateOfBirth) setDob(profile.dateOfBirth.split('T')[0]);
                if (profile.phone) setPhone(profile.phone);
                if (profile.alternatePhone) setAlternatePhone(profile.alternatePhone);
                if (profile.address) setAddress(profile.address);
                if (profile.city) setCity(profile.city);
                if (profile.state) setStateName(profile.state);
                if (profile.postalCode) setPostalCode(profile.postalCode);
                if (profile.country) setCountry(profile.country);
                if (profile.profilePhotoId) setProfilePhotoUrl(profile.profilePhotoId);
                
                // Pre-fill professional details
                if (profile.bio) setBio(profile.bio);
                if (profile.yearsOfExperience) setYearsOfExperience(profile.yearsOfExperience);
                if (profile.primaryServiceCategoryId) setPrimaryServiceCategoryId(profile.primaryServiceCategoryId);
                if (profile.serviceCategoryIds) setSelectedCategoryIds(profile.serviceCategoryIds);
                if (profile.skills) setSkillsText(profile.skills.join(', '));
                if (profile.languages) setLanguagesText(profile.languages.join(', '));
                if (profile.hourlyRate) setHourlyRate(profile.hourlyRate / 100);
                if (profile.dailyRate) setDailyRate(profile.dailyRate / 100);
                if (profile.serviceRadiusKm) setServiceRadiusKm(profile.serviceRadiusKm);
            }
        } catch (err) {
            console.error('Failed to fetch status details', err);
        } finally {
            setFetching(false);
        }
    };

    // Calculate dynamic required documents when primary category changes
    useEffect(() => {
        if (!primaryServiceCategoryId) return;
        const cat = categories.find(c => c._id === primaryServiceCategoryId);
        if (cat) {
            const docs = ['AADHAAR', 'PAN', 'ADDRESS_PROOF'];
            const slug = cat.slug || cat.name.toLowerCase();
            if (slug.includes('driver')) {
                docs.push('DRIVING_LICENSE');
            } else if (slug.includes('care') || slug.includes('health') || slug.includes('nurse') || slug.includes('senior') || slug.includes('patient')) {
                docs.push('EXPERIENCE_CERTIFICATE');
            } else if (slug.includes('sit') || slug.includes('baby')) {
                docs.push('POLICE_VERIFICATION');
            }
            setRequiredDocTypes(docs);
        }
    }, [primaryServiceCategoryId, categories]);

    const handleSaveDraft = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            // Save Profile details
            await api.put('/v1/worker/verification/profile', {
                fullName,
                dateOfBirth: dob || undefined,
                phone,
                alternatePhone,
                address,
                city,
                state: stateName,
                postalCode,
                country,
                profilePhotoId: profilePhotoUrl
            });

            // Save Professional details
            await api.put('/v1/worker/verification/professional-details', {
                primaryServiceCategoryId: primaryServiceCategoryId || undefined,
                serviceCategoryIds: selectedCategoryIds,
                skills: skillsText.split(',').map(s => s.trim()).filter(s => s.length > 0),
                languages: languagesText.split(',').map(l => l.trim()).filter(l => l.length > 0),
                hourlyRate: Math.round(Number(hourlyRate) * 100),
                dailyRate: Math.round(Number(dailyRate) * 100),
                serviceRadiusKm: Number(serviceRadiusKm),
                bio,
                yearsOfExperience: Number(yearsOfExperience)
            });

            setSuccess('Draft progress saved successfully!');
            await fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save onboarding progress.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        // Secure file validation on client side
        if (file.size > 5 * 1024 * 1024) {
            setError('File size must not exceed 5 MB.');
            return;
        }

        const allowedExts = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowedExts.includes(file.type)) {
            setError('Only JPEG, PNG and PDF formats are permitted.');
            return;
        }

        setError('');
        setDocFiles(prev => ({ ...prev, [type]: file }));
    };

    const handleProfilePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError('Profile photo size must not exceed 5 MB.');
            return;
        }

        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.type.toLowerCase())) {
            setError('Only JPEG, JPG, PNG and WEBP image formats are permitted for profile photos.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post('/v1/worker/verification/profile-photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setProfilePhotoUrl(res.data.photoUrl);
                setSuccess('Profile photo uploaded successfully.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload profile photo.');
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentUploadSubmit = async (type) => {
        const file = docFiles[type];
        const num = docNumbers[type];

        if (!file) {
            setError(`Please select a file to upload for ${type}.`);
            return;
        }
        if (!num) {
            setError(`Please specify document identifier number for ${type}.`);
            return;
        }

        setError('');
        setLoading(true);
        try {
            const currentDocument = uploadedDocs.find(doc => doc.documentType === type);
            const operationKey = documentOperationIds.current[type] || crypto.randomUUID();
            documentOperationIds.current[type] = operationKey;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('documentType', type);
            formData.append('documentNumber', num);
            if (docExpiries[type]) formData.append('expiryDate', docExpiries[type]);
            if (docAuthorities[type]) formData.append('issuingAuthority', docAuthorities[type]);

            const docId = currentDocument ? (currentDocument.id || currentDocument._id) : null;
            const endpoint = docId
                ? `/v1/worker/verification/documents/${docId}`
                : '/v1/worker/verification/documents';
            await api.request({ method: docId ? 'put' : 'post', url: endpoint, data: formData, headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': operationKey } });

            documentOperationIds.current[type] = undefined;
            setDocFiles(prev => ({ ...prev, [type]: undefined }));
            setDocNumbers(prev => ({ ...prev, [type]: '' }));
            setDocExpiries(prev => ({ ...prev, [type]: '' }));
            setDocAuthorities(prev => ({ ...prev, [type]: '' }));
            setSuccess(`${type} document ${currentDocument ? 'replaced' : 'uploaded'} successfully.`);
            await fetchVerificationStatus();
        } catch (err) {
            if (err.response?.data?.errorCode === 'DOCUMENT_ALREADY_EXISTS') {
                documentOperationIds.current[type] = undefined;
                await fetchVerificationStatus();
                setError(`A current ${type} document already exists. Use Replace Document.`);
            } else {
                setError(err.response?.data?.errorCode === 'DUPLICATE_RECORD'
                    ? `A current ${type} document already exists. Refresh and use Replace Document.`
                    : (err.response?.data?.message || `Failed to upload ${type} document.`));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveDoc = async (docId) => {
        if (!window.confirm('Are you sure you want to remove this document?')) return;
        setError('');
        setLoading(true);
        try {
            await api.delete(`/v1/worker/verification/documents/${docId}`);
            setSuccess('Document removed successfully.');
            await fetchVerificationStatus();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove document.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitForVerification = async () => {
        setError('');
        setSuccess('');
        if (!declarationAccepted || !consentAccepted) {
            setError('Please accept all declarations and verification consent checks.');
            return;
        }

        if (!profilePhotoUrl) {
            setError("Required profile photo is missing. Please go back to Step 1 (Personal tab) and upload your profile photo.");
            return;
        }

        setLoading(true);
        try {
            // First save latest profile/services
            await handleSaveDraft();

            const res = await api.post('/v1/worker/verification/submit', {
                declarationAccepted,
                consentAccepted
            });

            if (res.data.success) {
                setSuccess('Your profile has been submitted for verification review!');
                setStep(6);
                await fetchVerificationStatus();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Submission verification failed. Ensure profile is complete.');
        } finally {
            setLoading(false);
        }
    };

    const handleResubmit = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const res = await api.post('/v1/worker/verification/resubmit', {
                declarationAccepted: true,
                consentAccepted: true
            });
            if (res.data.success) {
                setSuccess('Resubmitted verification snapshot successfully.');
                setStep(6);
                await fetchVerificationStatus();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Resubmission failed.');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-[#EAB308] animate-spin"/>
                    <span className="text-sm font-semibold text-[#57534E]">Loading profile workspace...</span>
                </div>
            </div>
        );
    }

    // Render Read-Only screen when PENDING_APPROVAL
    if (verificationStatus === 'PENDING_APPROVAL') {
        return (
            <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] p-8 lg:p-16 flex items-center justify-center font-sans">
                <div className="max-w-xl w-full bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm space-y-6 text-center">
                    <div className="w-16 h-16 bg-[#FEFCE8] text-[#EAB308] rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Clock className="w-8 h-8"/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold tracking-tight">Verification Under Review</h2>
                        <p className="text-sm text-[#78716C] mt-2">
                            Your credentials and documents have been submitted to the Admin team. We are auditing your background check.
                        </p>
                    </div>

                    <div className="bg-[#FAF6F0] rounded-2xl p-4 border border-[#E7E0D8] text-left space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#78716C] border-b border-[#E7E0D8] pb-1.5">
                            Submission Summary
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <span className="text-[#57534E]">Full Legal Name:</span>
                            <span className="font-semibold text-right">{fullName}</span>
                            <span className="text-[#57534E]">Category:</span>
                            <span className="font-semibold text-right">
                                {categories.find(c => c._id === primaryServiceCategoryId)?.name || 'Default'}
                            </span>
                            <span className="text-[#57534E]">Uploaded Docs:</span>
                            <span className="font-semibold text-right">{uploadedDocs.length} Documents</span>
                        </div>
                    </div>

                    <p className="text-[10px] text-[#A8A29E]">
                        Expected review status updates will appear here. No lockouts on your existing bookings.
                    </p>

                    <button onClick={() => navigate('/worker')} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] hover:bg-[#FEFCE8] text-[#44403C] font-semibold py-3 rounded-xl transition-colors cursor-pointer">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] font-sans pb-16">
            {/* Navbar */}
            <nav className="border-b border-[#E7E0D8] bg-[#FAF6F0]/95 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl logo-gradient flex items-center justify-center font-black text-white text-base">
                        H
                    </div>
                    <span className="font-extrabold text-[#1C1917] text-xl">HyperLocal<span className="text-[#EAB308]">.</span></span>
                    <span className="bg-[#FEFCE8] text-[#EAB308] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#FEF08A]">
                        Verification Wizard
                    </span>
                </div>
                <button onClick={() => navigate('/worker')} className="bg-white border border-[#E7E0D8] hover:bg-[#FEFCE8] text-[#44403C] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                    Dashboard
                </button>
            </nav>

            <div className="max-w-4xl mx-auto px-6 pt-10">
                {/* Error Banner */}
                {error && (
                    <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-4 rounded-2xl flex items-start gap-2.5 mb-6">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                        <div>
                            <span className="font-bold">Verification Error:</span> {error}
                        </div>
                    </div>
                )}

                {/* Rejection / Changes Banner */}
                {verificationStatus === 'CHANGES_REQUIRED' && (
                    <div className="bg-[#D97706]/10 border border-[#D97706]/30 text-[#D97706] text-xs p-4 rounded-2xl flex items-start gap-2.5 mb-6">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5"/>
                        <div>
                            <span className="font-bold">⚠️ Changes Requested by Admin:</span>
                            <p className="mt-1 text-[#44403C]">{rejectionReason || 'Please replace invalid documents below.'}</p>
                            <button onClick={handleResubmit} className="btn-primary-gradient text-[10px] py-1 px-3 rounded-lg text-white mt-2 font-bold cursor-pointer">
                                Resubmit Now
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress bar */}
                <div className="mb-8 bg-white border border-[#E7E0D8] p-6 rounded-3xl shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Onboarding Checklist</div>
                        <h2 className="text-xl font-extrabold text-[#1c1917] mt-1">{onboardingPercent}% Complete</h2>
                    </div>
                    <div className="w-32 bg-[#E7E0D8] h-2.5 rounded-full overflow-hidden">
                        <div className="bg-[#EAB308] h-full transition-all duration-500" style={{ width: `${onboardingPercent}%` }}/>
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 shadow-sm">
                    {/* Step Navigation Header */}
                    <div className="grid grid-cols-6 gap-2 mb-8 text-center text-[10px] font-bold tracking-wider uppercase text-[#78716C]">
                        {['Personal', 'Profession', 'Services', 'KYC Docs', 'Consent', 'Status'].map((n, idx) => (
                            <div 
                                key={n} 
                                className={`pb-2 border-b-2 transition-all ${step === idx + 1 ? 'border-[#EAB308] text-[#EAB308]' : 'border-[#E7E0D8] text-[#A8A29E]'}`}
                            >
                                {n}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Personal Details */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                                    <User className="w-5 h-5 text-[#EAB308]"/> Personal Identification
                                </h3>
                                <p className="text-xs text-[#78716C] mt-1">Please enter your exact legal details as shown on your government documents.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Full Legal Name</label>
                                    <input 
                                        type="text" 
                                        value={fullName} 
                                        onChange={e => setFullName(e.target.value)} 
                                        placeholder="Rahul Sharma" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Date of Birth</label>
                                    <input 
                                        type="date" 
                                        value={dob} 
                                        onChange={e => setDob(e.target.value)} 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm text-[#57534E]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Primary Contact Phone</label>
                                    <input 
                                        type="tel" 
                                        value={phone} 
                                        onChange={e => setPhone(e.target.value)} 
                                        placeholder="9876543210" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Alternate Contact Phone (Optional)</label>
                                    <input 
                                        type="tel" 
                                        value={alternatePhone} 
                                        onChange={e => setAlternatePhone(e.target.value)} 
                                        placeholder="9876543211" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-[#E7E0D8] pt-4 space-y-4">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Residential Address</label>
                                <input 
                                    type="text" 
                                    value={address} 
                                    onChange={e => setAddress(e.target.value)} 
                                    placeholder="Apartment/Flat, Street Details" 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <input 
                                        type="text" 
                                        value={city} 
                                        onChange={e => setCity(e.target.value)} 
                                        placeholder="City" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                    <input 
                                        type="text" 
                                        value={stateName} 
                                        onChange={e => setStateName(e.target.value)} 
                                        placeholder="State" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                    <input 
                                        type="text" 
                                        value={postalCode} 
                                        onChange={e => setPostalCode(e.target.value)} 
                                        placeholder="Pincode" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                    <input 
                                        type="text" 
                                        value={country} 
                                        onChange={e => setCountry(e.target.value)} 
                                        placeholder="Country" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="border-t border-[#E7E0D8] pt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E]">Profile Photo</label>
                                    <span className="text-[10px] text-[#DC2626] font-semibold">* Required</span>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#FAF6F0] p-4 border border-[#E7E0D8] rounded-2xl">
                                    <div className="w-20 h-20 rounded-full border-2 border-[#E7E0D8] bg-white overflow-hidden flex items-center justify-center shrink-0">
                                        {profilePhotoUrl ? (
                                            <img src={getProfileImageUrl(profilePhotoUrl)} alt="Profile Preview" className="w-full h-full object-cover"/>
                                        ) : (
                                            <User className="w-8 h-8 text-[#A8A29E]"/>
                                        )}
                                    </div>
                                    
                                    <div className="flex-grow space-y-2 w-full">
                                        <input 
                                            type="file" 
                                            accept="image/jpeg,image/png,image/jpg,image/webp"
                                            onChange={handleProfilePhotoChange}
                                            className="w-full text-xs text-[#57534E] file:mr-4 file:py-1.5 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#FEFCE8] file:text-[#EAB308] file:hover:bg-[#FEF9C3] cursor-pointer"
                                            disabled={verificationStatus === 'PENDING_APPROVAL'}
                                        />
                                        <p className="text-[10px] text-[#78716C]">Upload a formal headshot. Max 5MB (JPEG, JPG, PNG or WEBP only).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Professional Details */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-[#EAB308]"/> Professional Profile
                                </h3>
                                <p className="text-xs text-[#78716C] mt-1">Specify your working experience, bio and base rates.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Years of Experience</label>
                                    <input 
                                        type="number" 
                                        value={yearsOfExperience} 
                                        onChange={e => setYearsOfExperience(Number(e.target.value))} 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Languages (Comma separated)</label>
                                    <input 
                                        type="text" 
                                        value={languagesText} 
                                        onChange={e => setLanguagesText(e.target.value)} 
                                        placeholder="English, Hindi, Kannada" 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Base Hourly Rate (₹)</label>
                                    <input 
                                        type="number" 
                                        value={hourlyRate} 
                                        onChange={e => setHourlyRate(Number(e.target.value))} 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Base Daily Rate (₹)</label>
                                    <input 
                                        type="number" 
                                        value={dailyRate} 
                                        onChange={e => setDailyRate(Number(e.target.value))} 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Service Work Radius (km)</label>
                                    <input 
                                        type="number" 
                                        value={serviceRadiusKm} 
                                        onChange={e => setServiceRadiusKm(Number(e.target.value))} 
                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                        min={1}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Professional Bio (min 10 characters)</label>
                                <textarea 
                                    rows={4}
                                    value={bio} 
                                    onChange={e => setBio(e.target.value)} 
                                    placeholder="Write a brief professional summary of your skills and work ethics..." 
                                    className="w-full input-field-style rounded-xl p-4 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Service Selection */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-[#EAB308]"/> Service Category Setup
                                </h3>
                                <p className="text-xs text-[#78716C] mt-1">Select your primary category. Requirements will adapt dynamically.</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-2.5">Primary Category</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat._id}
                                            type="button"
                                            onClick={() => setPrimaryServiceCategoryId(cat._id)}
                                            className={`p-4 border rounded-2xl text-left transition-all flex flex-col justify-between cursor-pointer ${
                                                primaryServiceCategoryId === cat._id 
                                                    ? 'border-[#EAB308] bg-[#FEFCE8] text-[#EAB308]' 
                                                    : 'border-[#E7E0D8] bg-white hover:border-[#DCD4C8]'
                                            }`}
                                        >
                                            <span className="font-bold text-sm">{cat.name}</span>
                                            <span className="text-[10px] text-[#78716C] mt-1 line-clamp-1">{cat.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-[#E7E0D8] pt-4">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-2.5">Specific Skills (Comma separated list)</label>
                                <input 
                                    type="text" 
                                    value={skillsText} 
                                    onChange={e => setSkillsText(e.target.value)} 
                                    placeholder="wiring, maintenance, repairs" 
                                    className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Documents Upload */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-[#EAB308]"/> Conditional KYC Document Upload
                                </h3>
                                <p className="text-xs text-[#78716C] mt-1">Upload files securely. Uploads are stored in private cloud repositories.</p>
                            </div>

                            {/* Active uploaded documents queue */}
                            {uploadedDocs.length > 0 && (
                                <div className="bg-[#FAF6F0] border border-[#E7E0D8] p-4 rounded-2xl space-y-3">
                                    <div className="text-xs font-semibold text-[#57534E] uppercase tracking-wider">Active Uploaded Documents</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {uploadedDocs.map((doc) => (
                                            <div key={doc.id} className="bg-white p-3 rounded-xl border border-[#E7E0D8] flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-[#EAB308]"/>
                                                    <div>
                                                        <div className="font-bold text-xs">{doc.documentType}</div>
                                                        <div className="text-[10px] text-[#78716C]">Number: •••• {doc.documentNumberLast4}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                        doc.verificationStatus === 'APPROVED' ? 'bg-[#16A34A]/10 text-[#16A34A]' :
                                                        doc.verificationStatus === 'CHANGES_REQUIRED' ? 'bg-[#D97706]/10 text-[#D97706]' : 'bg-[#78716C]/10 text-[#78716C]'
                                                    }`}>
                                                        {doc.verificationStatus}
                                                    </span>
                                                    {doc.verificationStatus !== 'APPROVED' && (
                                                        <button 
                                                            onClick={() => handleRemoveDoc(doc.id)}
                                                            className="text-[#DC2626] hover:bg-[#DC2626]/10 p-1 rounded-lg cursor-pointer"
                                                        >
                                                            <X className="w-4 h-4"/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Upload panels for required document types */}
                            <div className="space-y-4">
                                {requiredDocTypes.map((type) => {
                                    const currentDocument = uploadedDocs.find(d => d.documentType === type);

                                    return (
                                        <div key={type} className="border border-[#E7E0D8] rounded-2xl p-4 space-y-4 bg-white">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-sm text-[#1C1917]">{type} Verification Details</span>
                                                <span className="text-[10px] text-[#DC2626] font-semibold">* Required</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Document Number</label>
                                                    <input 
                                                        type="text" 
                                                        value={docNumbers[type] || ''} 
                                                        onChange={e => setDocNumbers(prev => ({ ...prev, [type]: e.target.value }))} 
                                                        placeholder={`Enter ${type} Identifier`} 
                                                        className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Select File (JPEG/PNG/PDF, Max 5MB)</label>
                                                    <input 
                                                        key={`${type}-${currentDocument?.id || 'new'}`}
                                                        type="file" 
                                                        onChange={e => handleFileUpload(e, type)}
                                                        className="w-full text-xs text-[#57534E] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FEFCE8] file:text-[#EAB308] file:hover:bg-[#FEF9C3] cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            {/* Expiry & Authority fields for License / Certificates */}
                                            {(type === 'DRIVING_LICENSE' || type === 'EXPERIENCE_CERTIFICATE') && (
                                                <div className="grid grid-cols-2 gap-4 pt-2">
                                                    <div>
                                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Expiry Date</label>
                                                        <input 
                                                            type="date" 
                                                            value={docExpiries[type] || ''} 
                                                            onChange={e => setDocExpiries(prev => ({ ...prev, [type]: e.target.value }))} 
                                                            className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#57534E] mb-1.5">Issuing Authority</label>
                                                        <input 
                                                            type="text" 
                                                            value={docAuthorities[type] || ''} 
                                                            onChange={e => setDocAuthorities(prev => ({ ...prev, [type]: e.target.value }))} 
                                                            placeholder="State RTO / Authority" 
                                                            className="w-full input-field-style rounded-xl px-4 py-2.5 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    disabled={loading}
                                                    onClick={() => handleDocumentUploadSubmit(type)}
                                                    className="bg-[#EAB308] text-white hover:bg-[#CA8A04] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                                                    {currentDocument ? 'Replace Document' : 'Upload Document'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Declarations */}
                    {step === 5 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-[#EAB308]"/> Final Review & Declaration
                                </h3>
                                <p className="text-xs text-[#78716C] mt-1">Review your details carefully. Submissions create an audit snapshot.</p>
                            </div>

                            <div className="bg-[#FAF6F0] rounded-2xl p-6 border border-[#E7E0D8] space-y-4 text-xs">
                                <h4 className="font-extrabold uppercase tracking-wider text-[#44403C]">Verification Summary</h4>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-b border-[#E7E0D8] pb-4">
                                    <span className="text-[#57534E]">Legal Name:</span> <span className="font-semibold text-right">{fullName}</span>
                                    <span className="text-[#57534E]">Primary Category:</span> 
                                    <span className="font-semibold text-right">
                                        {categories.find(c => c._id === primaryServiceCategoryId)?.name || 'Not Selected'}
                                    </span>
                                    <span className="text-[#57534E]">Email & Payouts:</span>
                                    <span className="font-semibold text-right">Active under KYC audit requirements</span>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={declarationAccepted}
                                            onChange={e => setDeclarationAccepted(e.target.checked)}
                                            className="mt-0.5 rounded border-[#E7E0D8] text-[#EAB308] focus:ring-[#EAB308]"
                                        />
                                        <span className="text-[#57534E]">
                                            I declare that all details, rates, certifications, and documentation uploaded are correct and belong to me.
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={consentAccepted}
                                            onChange={e => setConsentAccepted(e.target.checked)}
                                            className="mt-0.5 rounded border-[#E7E0D8] text-[#EAB308] focus:ring-[#EAB308]"
                                        />
                                        <span className="text-[#57534E]">
                                            I consent to background verification audits and identity validation performed securely by the marketplace system.
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Confirmation */}
                    {step === 6 && (
                        <div className="text-center py-8 space-y-6">
                            <div className="w-16 h-16 bg-[#FEFCE8] text-[#EAB308] rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8"/>
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold">Verification Submitted Successfully!</h3>
                                <p className="text-xs text-[#78716C] mt-2">
                                    Admin will inspect the submitted evidence. You will be notified when your status changes.
                                </p>
                            </div>
                            <button 
                                onClick={() => navigate('/worker')}
                                className="bg-[#FAF6F0] border border-[#E7E0D8] hover:bg-[#FEFCE8] px-6 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                Go to Worker Dashboard
                            </button>
                        </div>
                    )}

                    {/* Footer Nav Controls */}
                    {step < 6 && (
                        <div className="mt-8 pt-6 border-t border-[#E7E0D8] flex items-center justify-between">
                            <button
                                type="button"
                                disabled={step === 1 || loading}
                                onClick={() => setStep(step - 1)}
                                className="flex items-center gap-1.5 border border-[#E7E0D8] hover:bg-[#FAF6F0] px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5"/> Previous
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={handleSaveDraft}
                                    className="text-xs font-semibold text-[#78716C] hover:text-[#1C1917] hover:underline cursor-pointer"
                                >
                                    Save Draft
                                </button>
                                
                                {step < 5 ? (
                                    <button
                                        type="button"
                                        onClick={() => setStep(step + 1)}
                                        className="flex items-center gap-1.5 bg-[#EAB308] text-white hover:bg-[#CA8A04] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Next <ArrowRight className="w-3.5 h-3.5"/>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={handleSubmitForVerification}
                                        className="flex items-center gap-1.5 bg-[#16A34A] text-white hover:bg-[#15803D] px-6 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                                        Submit Verification
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkerOnboarding;
