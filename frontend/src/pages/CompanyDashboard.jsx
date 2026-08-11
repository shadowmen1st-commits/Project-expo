import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../config/api';
import { useAuth } from '../context/AuthContext';
import CompanySidebar from '../components/CompanySidebar';
import WorkerMultiSelect from '../components/WorkerMultiSelect';
import { 
    TrendingUp, 
    Users, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    CreditCard, 
    ArrowUpRight, 
    Briefcase,
    Building2,
    Calendar,
    Plus,
    FileText,
    Percent,
    Lock,
    Bell,
    Wallet,
    Edit3,
    Filter,
    X,
    Search
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { CATEGORY_LIST, getJobTitlesForCategory, isValidCategoryAndTitle } from '../config/jobCategories';

export default function CompanyDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [companyInfo, setCompanyInfo] = useState(null);
    const [stats, setStats] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [payments, setPayments] = useState([]);
    const [reports, setReports] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showLockModal, setShowLockModal] = useState(false);
    const [lockedFeatureName, setLockedFeatureName] = useState('');

    // Form & Filter states
    const [editingJob, setEditingJob] = useState(null);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterTitle, setFilterTitle] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterSearch, setFilterSearch] = useState('');

    const [newJob, setNewJob] = useState({
        title: '',
        description: '',
        category: '',
        requiredSkills: '',
        workersRequired: 1,
        location: '',
        address: '',
        workingDate: '',
        startTime: '09:00',
        endTime: '18:00',
        payRate: '',
        paymentType: 'DAILY',
        duration: '1 day',
        experienceRequired: 0,
        genderPreference: 'ANY',
        instructions: ''
    });

    const [newTeam, setNewTeam] = useState({
        name: '',
        leaderId: '',
        members: []
    });
    const [editingTeam, setEditingTeam] = useState(null);

    const [newAssignment, setNewAssignment] = useState({
        jobId: '',
        workerIds: '',
        teamId: ''
    });

    const [newAttendance, setNewAttendance] = useState({
        jobId: '',
        workerId: '',
        date: '',
        startTime: '09:00',
        endTime: '18:00',
        status: 'PRESENT',
        hoursWorked: 8
    });

    const [depositAmount, setDepositAmount] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [meRes, dashRes, jobsRes, appRes, workerRes, teamRes, attendRes, walletRes, payRes, repRes, notifRes] = await Promise.all([
                axios.get('/company/me'),
                axios.get('/company/dashboard'),
                axios.get('/company/jobs'),
                axios.get('/company/applications'),
                axios.get('/company/workers'),
                axios.get('/company/teams'),
                axios.get('/company/attendance'),
                axios.get('/company/wallet'),
                axios.get('/company/payments'),
                axios.get('/company/reports'),
                axios.get('/company/notifications')
            ]);

            setCompanyInfo(meRes.data.profile);
            setStats(dashRes.data.data);
            setJobs(jobsRes.data.jobs);
            setApplications(appRes.data.applications);
            setWorkers(workerRes.data.workers);
            setTeams(teamRes.data.teams);
            setAttendance(attendRes.data.attendance);
            setWallet(walletRes.data.wallet);
            setPayments(payRes.data.payments);
            setReports(repRes.data.data);
            setNotifications(notifRes.data.notifications);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to retrieve dashboard data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'verification') {
            navigate('/company/verification');
        }
    }, [activeTab]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleCreateJob = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newJob.category) {
            setError('Please select a category.');
            return;
        }

        if (!newJob.title) {
            setError('Please select a job title.');
            return;
        }

        if (!isValidCategoryAndTitle(newJob.category, newJob.title)) {
            setError('Please select a valid job title for this category.');
            return;
        }

        if (Number(newJob.workersRequired) < 1) {
            setError('Workers Required must be at least 1.');
            return;
        }

        if (newJob.endTime <= newJob.startTime) {
            setError('End time must be after start time.');
            return;
        }

        try {
            const data = {
                ...newJob,
                payRate: Number(newJob.payRate) * 100, // to paise
                workersRequired: Number(newJob.workersRequired),
                requiredSkills: typeof newJob.requiredSkills === 'string'
                    ? newJob.requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
                    : newJob.requiredSkills,
                applicationDeadline: newJob.workingDate
            };
            await axios.post('/company/jobs', data);
            setSuccess('Job created successfully.');
            setNewJob({
                title: '',
                description: '',
                category: '',
                requiredSkills: '',
                workersRequired: 1,
                location: '',
                address: '',
                workingDate: '',
                startTime: '09:00',
                endTime: '18:00',
                payRate: '',
                paymentType: 'DAILY',
                duration: '1 day',
                experienceRequired: 0,
                genderPreference: 'ANY',
                instructions: ''
            });
            fetchData();
            setActiveTab('jobs');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create job.');
        }
    };

    const handleOpenEditJob = (job) => {
        setEditingJob({
            ...job,
            payRate: job.payRate ? job.payRate / 100 : '',
            workingDate: job.workingDate ? new Date(job.workingDate).toISOString().split('T')[0] : '',
            requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : job.requiredSkills || ''
        });
    };

    const handleUpdateJob = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!editingJob.category) {
            setError('Please select a category.');
            return;
        }

        if (!editingJob.title) {
            setError('Please select a job title.');
            return;
        }

        if (!isValidCategoryAndTitle(editingJob.category, editingJob.title)) {
            setError('Please select a valid job title for this category.');
            return;
        }

        if (Number(editingJob.workersRequired) < 1) {
            setError('Workers Required must be at least 1.');
            return;
        }

        if (editingJob.endTime <= editingJob.startTime) {
            setError('End time must be after start time.');
            return;
        }

        try {
            const data = {
                ...editingJob,
                payRate: Number(editingJob.payRate) * 100,
                workersRequired: Number(editingJob.workersRequired),
                requiredSkills: typeof editingJob.requiredSkills === 'string'
                    ? editingJob.requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
                    : editingJob.requiredSkills
            };
            await axios.put(`/company/jobs/${editingJob._id}`, data);
            setSuccess('Job updated successfully.');
            setEditingJob(null);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update job.');
        }
    };

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        try {
            if (!newTeam.name || !newTeam.name.trim()) {
                setError('Team name is required.');
                return;
            }
            if (!newTeam.leaderId) {
                setError('Please select a team leader.');
                return;
            }
            const membersToSend = newTeam.members.includes(newTeam.leaderId)
                ? newTeam.members
                : [newTeam.leaderId, ...newTeam.members];

            await axios.post('/company/teams', {
                name: newTeam.name.trim(),
                leaderId: newTeam.leaderId,
                members: membersToSend
            });
            setSuccess('Team created successfully.');
            setNewTeam({ name: '', leaderId: '', members: [] });
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create team. Please select valid team leader and members.');
        }
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        if (!editingTeam) return;
        try {
            if (!editingTeam.name || !editingTeam.name.trim()) {
                setError('Team name is required.');
                return;
            }
            if (!editingTeam.leaderId) {
                setError('Please select a team leader.');
                return;
            }
            const membersToSend = editingTeam.members.includes(editingTeam.leaderId)
                ? editingTeam.members
                : [editingTeam.leaderId, ...editingTeam.members];

            await axios.put(`/company/teams/${editingTeam._id}`, {
                name: editingTeam.name.trim(),
                leaderId: editingTeam.leaderId,
                members: membersToSend
            });
            setSuccess('Team updated successfully.');
            setEditingTeam(null);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update team.');
        }
    };

    const handleDeleteTeam = async (teamId, teamName) => {
        if (!window.confirm(`Are you sure you want to delete "${teamName}"? Workers will remain intact.`)) {
            return;
        }
        try {
            await axios.delete(`/company/teams/${teamId}`);
            setSuccess('Team deleted successfully.');
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete team.');
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            const data = {
                jobId: newAssignment.jobId,
                workerIds: newAssignment.workerIds ? newAssignment.workerIds.split(',').map(id => id.trim()).filter(Boolean) : undefined,
                teamId: newAssignment.teamId || undefined
            };
            await axios.post('/company/assignments', data);
            setSuccess('Workers assigned successfully.');
            setActiveTab('workers');
        } catch (err) {
            setError(err.response?.data?.message || 'Assignment failed.');
        }
    };

    const handleAttendanceSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/company/attendance', newAttendance);
            setSuccess('Attendance recorded successfully.');
            setActiveTab('attendance');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to post attendance.');
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        try {
            const amount = Number(depositAmount) * 100; // to paise
            await axios.post('/company/wallet/add', { amount });
            setSuccess('Money deposited successfully.');
            setDepositAmount('');
            fetchData();
        } catch (err) {
            setError('Failed to deposit money.');
        }
    };

    const handleApplicationAction = async (id, action) => {
        try {
            await axios.patch(`/company/applications/${id}/${action}`);
            setSuccess(`Application ${action}ed successfully.`);
            fetchData();
        } catch (err) {
            setError('Action failed.');
        }
    };

    const handleReleasePayment = async (assignmentId) => {
        try {
            await axios.post('/company/payments/release', { assignmentId });
            setSuccess('Payment released successfully.');
            fetchData();
        } catch (err) {
            setError('Release failed. Insufficient funds or invalid assignment.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[#4B5563] text-sm font-semibold">Loading Company Panel...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FFFCF5] text-[#171717] flex font-sans">
            <CompanySidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={handleLogout} 
                companyName={companyInfo?.companyName} 
                verificationStatus={companyInfo?.verificationStatus}
                onLockedClick={(name) => { setLockedFeatureName(name); setShowLockModal(true); }}
            />

            <main className="flex-1 p-8 overflow-y-auto max-h-screen">
                {/* Header Bar */}
                <div className="flex justify-between items-center border-b border-[#FFF7D6] pb-4 mb-6 text-sm">
                    <div className="flex items-center gap-3">
                        {companyInfo?.verificationStatus === 'VERIFIED' ? (
                            <span className="bg-green-50 border border-green-200 text-green-700 font-extrabold text-[10px] uppercase px-3 py-1 rounded-full flex items-center gap-1">
                                <span>✓</span> VERIFIED COMPANY
                            </span>
                        ) : (
                            <span className="bg-yellow-50 border border-yellow-200 text-yellow-700 font-extrabold text-[10px] uppercase px-3 py-1 rounded-full">
                                {companyInfo?.verificationStatus || 'PENDING'}
                            </span>
                        )}
                        <span className="font-bold text-[#171717]">{companyInfo?.companyName}</span>
                    </div>

                    <div className="flex items-center gap-6 font-semibold">
                        <div className="flex items-center gap-1.5 text-[#171717]">
                            <span className="text-[#A8A29E] text-xs uppercase font-bold">Wallet:</span>
                            <span>₹{((wallet?.availableBalancePaise || stats?.walletBalance || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <button onClick={() => setActiveTab('notifications')} className="relative p-1 text-[#78716C] hover:text-[#171717] cursor-pointer">
                            {notifications.length > 0 && <span className="absolute top-0 right-0 w-2 h-2 bg-orange-600 rounded-full"></span>}
                            <Bell className="w-5 h-5" />
                        </button>
                        <button onClick={() => setActiveTab('profile')} className="font-bold text-sm text-[#F97316] hover:underline cursor-pointer">
                            Profile
                        </button>
                    </div>
                </div>
                {/* Status messages */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                        <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-700">✕</button>
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm font-medium">{success}</span>
                        <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-700">✕</button>
                    </div>
                )}

                {/* Verification Status Banner */}
                {companyInfo && companyInfo.verificationStatus !== 'VERIFIED' && companyInfo.verificationStatus !== 'APPROVED' && (
                    <div className="mb-6 bg-white border border-[#FFF7D6] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-[#FFF7D6] text-[#F97316] rounded-xl flex-shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-[#171717]">
                                    {companyInfo.verificationStatus === 'DRAFT' && 'Verification Incomplete'}
                                    {(companyInfo.verificationStatus === 'PENDING' || companyInfo.verificationStatus === 'UNDER_REVIEW') && 'KYC Verification Under Review'}
                                    {(companyInfo.verificationStatus === 'NEEDS_INFORMATION' || companyInfo.verificationStatus === 'RESUBMISSION_REQUIRED') && 'Action Required: Information Requested'}
                                    {companyInfo.verificationStatus === 'REJECTED' && 'KYC Verification Rejected'}
                                </h3>
                                <p className="text-xs text-[#78716C] mt-0.5">
                                    {(companyInfo.verificationStatus === 'DRAFT' || !companyInfo.verificationStatus) && 'Complete your 5-step company KYC verification to unlock job posting.'}
                                    {(companyInfo.verificationStatus === 'PENDING' || companyInfo.verificationStatus === 'UNDER_REVIEW') && 'Your verification details have been submitted and are being reviewed by the compliance admin.'}
                                    {(companyInfo.verificationStatus === 'NEEDS_INFORMATION' || companyInfo.verificationStatus === 'RESUBMISSION_REQUIRED') && (companyInfo.needsInfoReason || companyInfo.rejectionReason || 'Please provide additional details or document updates.')}
                                    {companyInfo.verificationStatus === 'REJECTED' && (companyInfo.rejectionReason || 'Your application was rejected. Please review feedback.')}
                                </p>
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate('/company/verification')}
                            className="bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all whitespace-nowrap"
                        >
                            {companyInfo.verificationStatus === 'DRAFT' ? 'Start Verification' : 'View Verification Status'}
                        </button>
                    </div>
                )}

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && stats && (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-extrabold text-[#111827] tracking-tight">Business Overview</h1>
                            <p className="text-sm text-[#4B5563] mt-1">Real-time status of your part-time operations & event teams.</p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Active Jobs</p>
                                        <p className="text-3xl font-black mt-2 text-[#111827]">{stats.activeJobs}</p>
                                    </div>
                                    <div className="p-3 bg-orange-50 rounded-xl text-[#F97316]"><Briefcase className="w-5 h-5" /></div>
                                </div>
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Workers Hired</p>
                                        <p className="text-3xl font-black mt-2 text-[#111827]">{stats.workersAssigned}</p>
                                    </div>
                                    <div className="p-3 bg-yellow-50 rounded-xl text-[#EAB308]"><Users className="w-5 h-5" /></div>
                                </div>
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Available Wallet</p>
                                        <p className="text-3xl font-black mt-2 text-[#111827]">₹{(stats.walletBalance / 100).toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 bg-green-50 rounded-xl text-green-600"><Wallet className="w-5 h-5" /></div>
                                </div>
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Total Spent</p>
                                        <p className="text-3xl font-black mt-2 text-[#111827]">₹{(stats.totalSpent / 100).toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><CreditCard className="w-5 h-5" /></div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <h3 className="text-lg font-bold mb-4">My Event Postings</h3>
                                {stats.recentJobs.length === 0 ? (
                                    <p className="text-xs text-[#4B5563] italic">No jobs posted yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {stats.recentJobs.map(job => (
                                            <div key={job._id} className="border-b border-[#FEF3C7] pb-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-[#111827]">{job.title}</p>
                                                    <p className="text-xs text-[#4B5563]">{job.location} | ₹{(job.payRate/100).toFixed(0)}/{job.paymentType === 'DAILY' ? 'day' : 'hr'}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${job.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                                <h3 className="text-lg font-bold mb-4">Recent Applications</h3>
                                {stats.recentApplications.length === 0 ? (
                                    <p className="text-xs text-[#4B5563] italic">No active applications.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {stats.recentApplications.map(app => (
                                            <div key={app._id} className="border-b border-[#FEF3C7] pb-3 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-[#111827]">{app.workerId?.name}</p>
                                                    <p className="text-xs text-[#4B5563]">Applied for {app.jobId?.title}</p>
                                                </div>
                                                <span className="text-xs font-semibold text-[#F97316]">{app.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Company Profile Tab */}
                {activeTab === 'profile' && companyInfo && (
                    <div className="bg-white border border-[#FEF3C7] p-8 rounded-3xl max-w-2xl shadow-sm space-y-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-[#111827]">Company Profile</h2>
                            <p className="text-sm text-[#4B5563] mt-1">Official organisation details & verification status.</p>
                        </div>

                        <div className="flex items-center gap-4 pb-4 border-b border-[#FEF3C7]">
                            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center text-[#F97316] font-bold text-2xl">
                                {companyInfo.companyName[0]}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{companyInfo.companyName}</h3>
                                {companyInfo.verificationStatus === 'VERIFIED' ? (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-green-50 border-green-200 text-green-700">
                                        ✓ VERIFIED COMPANY
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-yellow-50 border-yellow-200 text-yellow-700">
                                        {companyInfo.verificationStatus || 'PENDING'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Email</p>
                                <p className="text-sm font-semibold">{companyInfo.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Phone</p>
                                <p className="text-sm font-semibold">{companyInfo.phone}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Business Type</p>
                                <p className="text-sm font-semibold">{companyInfo.businessType}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Website</p>
                                <p className="text-sm font-semibold">{companyInfo.website || 'Not specified'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Address</p>
                                <p className="text-sm font-semibold">{companyInfo.address}, {companyInfo.city}, {companyInfo.state} - {companyInfo.pincode}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold">Description</p>
                                <p className="text-sm font-semibold text-[#4B5563] mt-1">{companyInfo.description}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Post Job Tab */}
                {activeTab === 'post-job' && (
                    <div className="bg-white border border-[#FEF3C7] p-8 rounded-3xl max-w-2xl shadow-sm space-y-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-[#111827]">Post a New Job</h2>
                            <p className="text-sm text-[#4B5563] mt-1">Select a category and dependent job title for your hiring request.</p>
                        </div>

                        <form onSubmit={handleCreateJob} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SearchableSelect 
                                    label="Category"
                                    required
                                    options={CATEGORY_LIST}
                                    value={newJob.category}
                                    onChange={cat => setNewJob({ ...newJob, category: cat, title: '' })}
                                    placeholder="Search category..."
                                />
                                <SearchableSelect 
                                    label="Job Title"
                                    required
                                    options={getJobTitlesForCategory(newJob.category)}
                                    value={newJob.title}
                                    onChange={title => setNewJob({ ...newJob, title })}
                                    placeholder={newJob.category ? "Search job title..." : "Select category first"}
                                    disabled={!newJob.category}
                                    disabledPlaceholder="Select category first"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Workers Required</label>
                                    <input 
                                        type="number" 
                                        min={1}
                                        value={newJob.workersRequired}
                                        onChange={e => setNewJob({ ...newJob, workersRequired: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Pay Rate (INR)</label>
                                    <input 
                                        type="number" 
                                        placeholder="800" 
                                        value={newJob.payRate}
                                        onChange={e => setNewJob({ ...newJob, payRate: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Pay Type</label>
                                    <select 
                                        value={newJob.paymentType}
                                        onChange={e => setNewJob({ ...newJob, paymentType: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    >
                                        <option value="DAILY">Daily Rate</option>
                                        <option value="HOURLY">Hourly Rate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={newJob.workingDate}
                                        onChange={e => setNewJob({ ...newJob, workingDate: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Location / Area</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Noida Sector 62" 
                                        value={newJob.location}
                                        onChange={e => setNewJob({ ...newJob, location: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Detailed Address</label>
                                    <input 
                                        type="text" 
                                        placeholder="Event center full address details" 
                                        value={newJob.address}
                                        onChange={e => setNewJob({ ...newJob, address: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={newJob.startTime}
                                        onChange={e => setNewJob({ ...newJob, startTime: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={newJob.endTime}
                                        onChange={e => setNewJob({ ...newJob, endTime: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Required Skills (Comma separated)</label>
                                <input 
                                    type="text" 
                                    placeholder="Crowd Management, Ticketing" 
                                    value={newJob.requiredSkills}
                                    onChange={e => setNewJob({ ...newJob, requiredSkills: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Job Description</label>
                                <textarea 
                                    rows={3}
                                    value={newJob.description}
                                    onChange={e => setNewJob({ ...newJob, description: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    required
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full btn-primary-gradient font-bold py-3 rounded-xl cursor-pointer mt-4"
                            >
                                Publish Job Posting
                            </button>
                        </form>
                    </div>
                )}

                {/* My Jobs Tab */}
                {activeTab === 'jobs' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-extrabold text-[#111827]">Active Job Postings</h2>
                                <p className="text-sm text-[#4B5563]">Manage and edit your posted jobs</p>
                            </div>
                            <button
                                onClick={() => setActiveTab('post-job')}
                                className="inline-flex items-center gap-1.5 bg-[#F97316] text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-[#EA580C] cursor-pointer transition-colors shadow-xs"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Post New Job</span>
                            </button>
                        </div>

                        {/* Job Search & Filter Bar */}
                        <div className="bg-white border border-[#FEF3C7] p-4 rounded-2xl shadow-xs space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">Search Jobs</label>
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#9CA3AF]" />
                                        <input
                                            type="text"
                                            value={filterSearch}
                                            onChange={e => setFilterSearch(e.target.value)}
                                            placeholder="Search title or area..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#FEF3C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                                        />
                                    </div>
                                </div>
                                <SearchableSelect 
                                    label="Filter Category"
                                    options={['', ...CATEGORY_LIST]}
                                    value={filterCategory}
                                    onChange={cat => {
                                        setFilterCategory(cat);
                                        setFilterTitle('');
                                    }}
                                    placeholder="All Categories"
                                />
                                <SearchableSelect 
                                    label="Filter Job Title"
                                    options={['', ...getJobTitlesForCategory(filterCategory)]}
                                    value={filterTitle}
                                    onChange={t => setFilterTitle(t)}
                                    placeholder={filterCategory ? "All Job Titles" : "Select category first"}
                                    disabled={!filterCategory}
                                    disabledPlaceholder="Select category first"
                                />
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716C] mb-1">Status</label>
                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="w-full py-2 px-3 text-xs bg-white border border-[#FEF3C7] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] font-medium"
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                        <option value="CANCELLED">CANCELLED</option>
                                    </select>
                                </div>
                            </div>

                            {(filterSearch || filterCategory || filterTitle || filterStatus !== 'ALL') && (
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => {
                                            setFilterSearch('');
                                            setFilterCategory('');
                                            setFilterTitle('');
                                            setFilterStatus('ALL');
                                        }}
                                        className="text-xs text-[#F97316] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <X className="w-3 h-3" /> Reset Filters
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Jobs Grid */}
                        {jobs.filter(job => {
                            if (filterCategory && job.category !== filterCategory) return false;
                            if (filterTitle && job.title !== filterTitle) return false;
                            if (filterStatus !== 'ALL' && job.status !== filterStatus) return false;
                            if (filterSearch) {
                                const q = filterSearch.toLowerCase();
                                const mTitle = job.title?.toLowerCase().includes(q);
                                const mCat = job.category?.toLowerCase().includes(q);
                                const mLoc = job.location?.toLowerCase().includes(q);
                                if (!mTitle && !mCat && !mLoc) return false;
                            }
                            return true;
                        }).length === 0 ? (
                            <p className="text-sm text-[#4B5563] italic py-8 text-center bg-white rounded-2xl border border-[#FEF3C7]">No matching jobs found.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {jobs.filter(job => {
                                    if (filterCategory && job.category !== filterCategory) return false;
                                    if (filterTitle && job.title !== filterTitle) return false;
                                    if (filterStatus !== 'ALL' && job.status !== filterStatus) return false;
                                    if (filterSearch) {
                                        const q = filterSearch.toLowerCase();
                                        const mTitle = job.title?.toLowerCase().includes(q);
                                        const mCat = job.category?.toLowerCase().includes(q);
                                        const mLoc = job.location?.toLowerCase().includes(q);
                                        if (!mTitle && !mCat && !mLoc) return false;
                                    }
                                    return true;
                                }).map(job => (
                                    <div key={job._id} className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-extrabold text-lg text-[#111827]">{job.title}</h3>
                                                <p className="text-xs text-[#F97316] font-semibold">{job.category}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                                    job.status === 'ACTIVE' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-gray-50 border border-gray-200 text-gray-700'
                                                }`}>
                                                    {job.status}
                                                </span>
                                                <button
                                                    onClick={() => handleOpenEditJob(job)}
                                                    title="Edit Job"
                                                    className="p-1.5 rounded-lg bg-[#FAF6F0] hover:bg-[#FEF3C7] text-[#78716C] hover:text-[#F97316] transition-colors cursor-pointer"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-xs text-[#4B5563] line-clamp-2">{job.description}</p>

                                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#FEF3C7] pt-3">
                                            <div>
                                                <span className="text-[#9CA3AF] block uppercase tracking-wider text-[9px]">Workers Required</span>
                                                <span className="font-bold text-[#111827]">{job.workersRequired} Workers</span>
                                            </div>
                                            <div>
                                                <span className="text-[#9CA3AF] block uppercase tracking-wider text-[9px]">Pay Rate</span>
                                                <span className="font-bold text-[#111827]">₹{job.payRate/100} / {job.paymentType === 'DAILY' ? 'Day' : 'Hr'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[#9CA3AF] block uppercase tracking-wider text-[9px]">Date</span>
                                                <span className="font-bold text-[#111827]">{new Date(job.workingDate).toLocaleDateString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-[#9CA3AF] block uppercase tracking-wider text-[9px]">Location</span>
                                                <span className="font-bold text-[#111827]">{job.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Applications Tab */}
                {activeTab === 'applications' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-extrabold text-[#111827]">Application Manager</h2>
                        {applications.length === 0 ? (
                            <p className="text-sm text-[#4B5563] italic">No worker applications received yet.</p>
                        ) : (
                            <div className="bg-white border border-[#FEF3C7] rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#FFFBEB] text-[#4B5563] text-xs uppercase border-b border-[#FEF3C7]">
                                            <th className="p-4">Worker</th>
                                            <th className="p-4">Applied Job</th>
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#FEF3C7] text-sm">
                                        {applications.map(app => (
                                            <tr key={app._id} className="hover:bg-[#FFFBEB]/50">
                                                <td className="p-4">
                                                    <div className="font-bold">{app.workerId?.name}</div>
                                                    <div className="text-xs text-[#4B5563]">{app.workerId?.email} | {app.workerId?.phone}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-xs">{app.jobId?.title}</div>
                                                    <div className="text-[10px] text-[#9CA3AF]">{app.jobId?.location}</div>
                                                </td>
                                                <td className="p-4 text-xs">
                                                    {new Date(app.appliedAt).toLocaleDateString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-semibold">{app.status}</span>
                                                </td>
                                                <td className="p-4 text-right space-x-2">
                                                    {app.status === 'PENDING' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleApplicationAction(app._id, 'shortlist')}
                                                                className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold px-3 py-1 rounded-lg hover:bg-yellow-100 cursor-pointer"
                                                            >
                                                                Shortlist
                                                            </button>
                                                            <button 
                                                                onClick={() => handleApplicationAction(app._id, 'reject')}
                                                                className="text-xs bg-red-50 border border-red-200 text-red-700 font-bold px-3 py-1 rounded-lg hover:bg-red-100 cursor-pointer"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {(app.status === 'PENDING' || app.status === 'SHORTLISTED') && (
                                                        <button 
                                                            onClick={() => handleApplicationAction(app._id, 'select')}
                                                            className="text-xs bg-green-50 border border-green-200 text-green-700 font-bold px-3 py-1 rounded-lg hover:bg-green-100 cursor-pointer"
                                                        >
                                                            Select Worker
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Workers Tab */}
                {activeTab === 'workers' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-extrabold text-[#111827]">Assigned Workforce</h2>
                        {workers.length === 0 ? (
                            <p className="text-sm text-[#4B5563] italic">No workers currently assigned.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {workers.map(w => (
                                    <div key={w._id} className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-extrabold text-base text-[#111827]">{w.workerId?.name}</h3>
                                                <p className="text-xs text-[#4B5563]">{w.workerId?.email} | {w.workerId?.phone}</p>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                w.status === 'COMPLETED' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-orange-50 border border-orange-200 text-orange-700'
                                            }`}>
                                                {w.status}
                                            </span>
                                        </div>

                                        <div className="bg-[#FFFBEB] p-3 rounded-xl border border-[#FEF3C7] text-xs">
                                            <p className="font-bold text-[#111827]">Assigned Job: {w.jobId?.title}</p>
                                            <p className="text-[#4B5563] mt-0.5">Pay Rate: ₹{w.jobId?.payRate/100} ({w.jobId?.location})</p>
                                        </div>

                                        {w.status !== 'COMPLETED' && (
                                            <button 
                                                onClick={() => handleReleasePayment(w._id)}
                                                className="w-full text-xs bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                                            >
                                                Approve Work & Release Payment
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Teams Tab */}
                {activeTab === 'teams' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-extrabold text-[#111827]">Workforce Teams</h2>
                                <p className="text-sm text-[#4B5563]">Create and manage team structures for rapid event staffing</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Create Team Form Card */}
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm space-y-4 h-fit">
                                <h3 className="font-bold text-sm text-[#111827] uppercase tracking-wider">Create New Team</h3>
                                <form onSubmit={handleCreateTeam} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-[#111827] mb-1">
                                            Team Name <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Noida Marshals A" 
                                            value={newTeam.name}
                                            onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                                            className="w-full input-field-style rounded-xl px-3 py-2 text-xs border border-[#FEF3C7]"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-[#111827] mb-1">
                                            Team Leader <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={newTeam.leaderId}
                                            onChange={e => {
                                                const lId = e.target.value;
                                                const updatedMembers = lId && !newTeam.members.includes(lId) 
                                                    ? [...newTeam.members, lId] 
                                                    : newTeam.members;
                                                setNewTeam({ ...newTeam, leaderId: lId, members: updatedMembers });
                                            }}
                                            className="w-full bg-white border border-[#FEF3C7] rounded-xl px-3 py-2 text-xs focus:border-[#F97316]"
                                            required
                                        >
                                            <option value="">[ Select Worker ▼ ]</option>
                                            {workers.map(w => (
                                                <option key={w._id} value={w._id}>
                                                    {w.name} {w.phone ? `(${w.phone})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <WorkerMultiSelect
                                            label="Team Members"
                                            workers={workers}
                                            selectedWorkerIds={newTeam.members}
                                            onChange={ids => {
                                                const updated = newTeam.leaderId && !ids.includes(newTeam.leaderId)
                                                    ? [newTeam.leaderId, ...ids]
                                                    : ids;
                                                setNewTeam({ ...newTeam, members: updated });
                                            }}
                                            placeholder="Select workers ▼"
                                        />
                                    </div>
                                    <button 
                                        type="submit"
                                        className="w-full bg-[#F97316] text-white hover:bg-orange-600 font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-sm"
                                    >
                                        Create Team
                                    </button>
                                </form>
                            </div>

                            {/* Teams list */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {teams.length === 0 ? (
                                    <div className="bg-white border border-[#FEF3C7] p-8 rounded-2xl col-span-2 text-center space-y-2">
                                        <p className="text-sm text-[#4B5563] italic">No teams created yet.</p>
                                        <p className="text-xs text-[#9CA3AF]">Select a leader and workers above to create your first team.</p>
                                    </div>
                                ) : (
                                    teams.map(team => (
                                        <div key={team._id} className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-extrabold text-base text-[#111827]">{team.name}</h3>
                                                        {team.leaderId && (
                                                            <p className="text-xs text-[#F97316] font-bold mt-1 flex items-center gap-1.5">
                                                                <span className="bg-orange-100 text-[#F97316] text-[10px] uppercase font-black px-2 py-0.5 rounded-md">Leader</span>
                                                                {team.leaderId.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => setEditingTeam({
                                                                _id: team._id,
                                                                name: team.name,
                                                                leaderId: team.leaderId?._id || team.leaderId || '',
                                                                members: team.members.map(m => m._id || m)
                                                            })}
                                                            className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteTeam(team._id, team.name)}
                                                            className="text-xs text-red-600 hover:text-red-800 font-bold cursor-pointer"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 border-t border-[#FEF3C7] pt-3 mt-3">
                                                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Members ({team.members?.length || 0})</p>
                                                    <ul className="space-y-1">
                                                        {team.members?.map(m => (
                                                            <li key={m._id} className="text-xs flex justify-between items-center bg-gray-50 px-2.5 py-1 rounded-lg">
                                                                <span className="font-semibold text-[#111827]">
                                                                    • {m.name} {m._id === (team.leaderId?._id || team.leaderId) ? '(Leader)' : ''}
                                                                </span>
                                                                <span className="text-[#4B5563] text-[11px]">{m.phone || m.email}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Assign Tab */}
                {activeTab === 'assign' && (
                    <div className="bg-white border border-[#FEF3C7] p-8 rounded-3xl max-w-lg shadow-sm space-y-6">
                        <div>
                            <h2 className="text-2xl font-extrabold text-[#111827]">Direct Worker Assignment</h2>
                            <p className="text-sm text-[#4B5563] mt-1">Directly assign individual workers or predefined teams to a posted event job.</p>
                        </div>

                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Target Job</label>
                                <select 
                                    value={newAssignment.jobId}
                                    onChange={e => setNewAssignment({ ...newAssignment, jobId: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    required
                                >
                                    <option value="">Select a Job</option>
                                    {jobs.filter(j => j.status === 'ACTIVE').map(job => (
                                        <option key={job._id} value={job._id}>{job.title} ({job.location})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="border-t border-[#FEF3C7] pt-4">
                                <p className="text-xs text-[#9CA3AF] uppercase font-bold mb-3">Choose Assignment Method</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider mb-1">Method A: Assign Workers (IDs comma separated)</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. worker_user_id_1, worker_user_id_2" 
                                            value={newAssignment.workerIds}
                                            onChange={e => setNewAssignment({ ...newAssignment, workerIds: e.target.value, teamId: '' })}
                                            className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        />
                                    </div>

                                    <div className="text-center font-bold text-xs text-[#9CA3AF]">OR</div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider mb-1">Method B: Assign Entire Team</label>
                                        <select 
                                            value={newAssignment.teamId}
                                            onChange={e => setNewAssignment({ ...newAssignment, teamId: e.target.value, workerIds: '' })}
                                            className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        >
                                            <option value="">Select a Team</option>
                                            {teams.map(team => (
                                                <option key={team._id} value={team._id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                className="w-full btn-primary-gradient font-bold py-3 rounded-xl cursor-pointer mt-4"
                            >
                                Dispatch Assignment
                            </button>
                        </form>
                    </div>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-extrabold text-[#111827]">Attendance Log</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Record Attendance Form Card */}
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm space-y-4 h-fit">
                                <h3 className="font-bold text-sm text-[#111827] uppercase tracking-wider">Log Worker Attendance</h3>
                                <form onSubmit={handleAttendanceSubmit} className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-[#4B5563] mb-1">Job</label>
                                        <select 
                                            value={newAttendance.jobId}
                                            onChange={e => setNewAttendance({ ...newAttendance, jobId: e.target.value })}
                                            className="w-full input-field-style rounded-lg px-3 py-1.5 text-xs border border-[#FEF3C7]"
                                            required
                                        >
                                            <option value="">Select Job</option>
                                            {jobs.map(j => (
                                                <option key={j._id} value={j._id}>{j.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-[#4B5563] mb-1">Worker User ID</label>
                                        <input 
                                            type="text" 
                                            placeholder="Worker MongoDB User ID" 
                                            value={newAttendance.workerId}
                                            onChange={e => setNewAttendance({ ...newAttendance, workerId: e.target.value })}
                                            className="w-full input-field-style rounded-lg px-3 py-1.5 text-xs border border-[#FEF3C7]"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-[#4B5563] mb-1">Date</label>
                                        <input 
                                            type="date" 
                                            value={newAttendance.date}
                                            onChange={e => setNewAttendance({ ...newAttendance, date: e.target.value })}
                                            className="w-full input-field-style rounded-lg px-3 py-1.5 text-xs border border-[#FEF3C7]"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-[#4B5563] mb-1">Status</label>
                                            <select 
                                                value={newAttendance.status}
                                                onChange={e => setNewAttendance({ ...newAttendance, status: e.target.value })}
                                                className="w-full input-field-style rounded-lg px-3 py-1.5 text-xs border border-[#FEF3C7]"
                                            >
                                                <option value="PRESENT">Present</option>
                                                <option value="ABSENT">Absent</option>
                                                <option value="LATE">Late</option>
                                                <option value="PARTIAL">Partial</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase text-[#4B5563] mb-1">Hours Worked</label>
                                            <input 
                                                type="number" 
                                                value={newAttendance.hoursWorked}
                                                onChange={e => setNewAttendance({ ...newAttendance, hoursWorked: Number(e.target.value) })}
                                                className="w-full input-field-style rounded-lg px-3 py-1.5 text-xs border border-[#FEF3C7]"
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        type="submit"
                                        className="w-full bg-[#F97316] text-white hover:bg-orange-600 font-bold py-2 rounded-xl text-xs cursor-pointer"
                                    >
                                        Submit Log
                                    </button>
                                </form>
                            </div>

                            {/* Attendance Table */}
                            <div className="bg-white border border-[#FEF3C7] rounded-2xl overflow-hidden shadow-sm col-span-2">
                                {attendance.length === 0 ? (
                                    <div className="p-6 text-sm text-[#4B5563] italic">No attendance marked yet.</div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#FFFBEB] text-[#4B5563] text-xs uppercase border-b border-[#FEF3C7]">
                                                <th className="p-4">Worker</th>
                                                <th className="p-4">Job</th>
                                                <th className="p-4">Date</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4">Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#FEF3C7] text-sm">
                                            {attendance.map(a => (
                                                <tr key={a._id} className="hover:bg-[#FFFBEB]/50">
                                                    <td className="p-4 font-bold">{a.workerId?.name}</td>
                                                    <td className="p-4 text-xs">{a.jobId?.title}</td>
                                                    <td className="p-4 text-xs">{new Date(a.date).toLocaleDateString()}</td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            a.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>{a.status}</span>
                                                    </td>
                                                    <td className="p-4 text-xs">{a.hoursWorked} hrs</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Wallet & Payments Tab */}
                {activeTab === 'wallet' && wallet && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white border border-[#FEF3C7] p-8 rounded-3xl shadow-sm space-y-6 h-fit">
                            <div>
                                <h2 className="text-xl font-extrabold">Company Wallet</h2>
                                <p className="text-xs text-[#4B5563] mt-1">Pre-fund your balance to cover event marshals & escrow charges.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between border-b border-[#FEF3C7] pb-2">
                                    <span className="text-xs text-[#4B5563]">Available Balance:</span>
                                    <span className="font-black text-[#111827]">₹{((wallet?.availableBalancePaise || 0) / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-b border-[#FEF3C7] pb-2">
                                    <span className="text-xs text-[#4B5563]">Held in Escrow:</span>
                                    <span className="font-black text-orange-600">₹{((wallet?.escrowAmountPaise || 0) / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs text-[#4B5563]">Total Spent:</span>
                                    <span className="font-black text-blue-600">₹{((wallet?.totalSpentPaise || 0) / 100).toFixed(2)}</span>
                                </div>
                            </div>

                            <form onSubmit={handleDeposit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-1">Add Money (INR)</label>
                                    <input 
                                        type="number" 
                                        placeholder="5000" 
                                        value={depositAmount}
                                        onChange={e => setDepositAmount(e.target.value)}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <button 
                                    type="submit"
                                    className="w-full btn-primary-gradient font-bold py-2 rounded-xl text-xs cursor-pointer"
                                  >
                                    Deposit Simulated Funds
                                </button>
                            </form>
                        </div>

                        {/* Transaction history */}
                        <div className="bg-white border border-[#FEF3C7] p-8 rounded-3xl shadow-sm col-span-2">
                            <h3 className="font-bold text-lg mb-4">Transaction Ledger</h3>
                            {(!wallet?.transactionHistory || wallet.transactionHistory.length === 0) ? (
                                <p className="text-xs text-[#4B5563] italic">No transaction history.</p>
                            ) : (
                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                    {wallet.transactionHistory.map((t, idx) => (
                                        <div key={idx} className="border-b border-[#FEF3C7] pb-3 flex justify-between items-center text-xs">
                                            <div>
                                                <p className="font-bold text-[#111827]">{t.description}</p>
                                                <p className="text-[10px] text-[#9CA3AF]">{new Date(t.createdAt).toLocaleString()}</p>
                                            </div>
                                            <span className={`font-black text-sm ${t.type === 'CREDIT' ? 'text-green-600' : 'text-[#DC2626]'}`}>
                                                {t.type === 'CREDIT' ? '+' : '-'}₹{(t.amountPaise / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Payments list tab */}
                {activeTab === 'payments' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-extrabold text-[#111827]">Payment Records</h2>
                        {payments.length === 0 ? (
                            <p className="text-sm text-[#4B5563] italic">No payments recorded yet.</p>
                        ) : (
                            <div className="bg-white border border-[#FEF3C7] rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#FFFBEB] text-[#4B5563] text-xs uppercase border-b border-[#FEF3C7]">
                                            <th className="p-4">Worker</th>
                                            <th className="p-4">Job</th>
                                            <th className="p-4">Paid Amount</th>
                                            <th className="p-4">Worker Earning</th>
                                            <th className="p-4">Commission</th>
                                            <th className="p-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#FEF3C7] text-sm">
                                        {payments.map(p => (
                                            <tr key={p._id} className="hover:bg-[#FFFBEB]/50">
                                                <td className="p-4 font-bold">{p.workerId?.name}</td>
                                                <td className="p-4 text-xs">{p.jobId?.title}</td>
                                                <td className="p-4 font-bold">₹{(p.amountPaise/100).toFixed(2)}</td>
                                                <td className="p-4 text-green-600 font-semibold">₹{(p.workerEarningPaise/100).toFixed(2)}</td>
                                                <td className="p-4 text-[#EAB308] font-semibold">₹{(p.platformCommissionPaise/100).toFixed(2)}</td>
                                                <td className="p-4">
                                                    <span className="text-xs font-semibold text-green-700">{p.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Reports & Analytics Tab */}
                {activeTab === 'reports' && reports && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-extrabold text-[#111827]">Reports & Analytics</h2>
                            <p className="text-sm text-[#4B5563] mt-1">Aggregated statistics and workforce metrics.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm text-center">
                                <FileText className="w-8 h-8 text-[#F97316] mx-auto mb-2" />
                                <h3 className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Total Jobs Posted</h3>
                                <p className="text-3xl font-black mt-2 text-[#111827]">{reports.totalJobs}</p>
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm text-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                <h3 className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Completed Jobs</h3>
                                <p className="text-3xl font-black mt-2 text-[#111827]">{reports.completedJobs}</p>
                            </div>
                            <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm text-center">
                                <Percent className="w-8 h-8 text-[#EAB308] mx-auto mb-2" />
                                <h3 className="text-xs text-[#4B5563] uppercase tracking-wider font-semibold">Average Job Cost</h3>
                                <p className="text-3xl font-black mt-2 text-[#111827]">₹{(reports.averageJobCost/100).toFixed(0)}</p>
                            </div>
                        </div>

                        <div className="bg-white border border-[#FEF3C7] p-6 rounded-2xl shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Job Status Distribution</h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span>Active / Open</span>
                                        <span>{reports.activeJobs}</span>
                                    </div>
                                    <div className="w-full bg-[#FFFBEB] h-2 rounded-full overflow-hidden border border-[#FEF3C7]">
                                        <div 
                                            className="bg-[#F97316] h-full" 
                                            style={{ width: `${reports.totalJobs > 0 ? (reports.activeJobs / reports.totalJobs) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span>Completed</span>
                                        <span>{reports.completedJobs}</span>
                                    </div>
                                    <div className="w-full bg-[#FFFBEB] h-2 rounded-full overflow-hidden border border-[#FEF3C7]">
                                        <div 
                                            className="bg-green-600 h-full" 
                                            style={{ width: `${reports.totalJobs > 0 ? (reports.completedJobs / reports.totalJobs) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-semibold mb-1">
                                        <span>Cancelled</span>
                                        <span>{reports.cancelledJobs}</span>
                                    </div>
                                    <div className="w-full bg-[#FFFBEB] h-2 rounded-full overflow-hidden border border-[#FEF3C7]">
                                        <div 
                                            className="bg-red-500 h-full" 
                                            style={{ width: `${reports.totalJobs > 0 ? (reports.cancelledJobs / reports.totalJobs) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-extrabold text-[#111827]">Company Notifications</h2>
                        {notifications.length === 0 ? (
                            <p className="text-sm text-[#4B5563] italic">No notifications received.</p>
                        ) : (
                            <div className="space-y-3">
                                {notifications.map(notif => (
                                    <div key={notif._id} className="bg-white border border-[#FEF3C7] p-4 rounded-xl shadow-sm flex items-start gap-3">
                                        <Bell className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-sm text-[#111827]">{notif.title}</p>
                                            <p className="text-xs text-[#4B5563] mt-0.5">{notif.messageSafe}</p>
                                            <span className="text-[9px] text-[#9CA3AF] mt-1 block">{new Date(notif.createdAt).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Lock feature modal */}
            {/* Edit Job Modal */}
            {editingJob && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white border border-[#FEF3C7] rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-[#FEF3C7]">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#111827]">Edit Job Posting</h3>
                                <p className="text-xs text-[#4B5563] mt-0.5">Update category, title, or job requirements</p>
                            </div>
                            <button
                                onClick={() => setEditingJob(null)}
                                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateJob} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <SearchableSelect 
                                    label="Category"
                                    required
                                    options={CATEGORY_LIST}
                                    value={editingJob.category}
                                    onChange={cat => setEditingJob({ ...editingJob, category: cat, title: '' })}
                                    placeholder="Search category..."
                                />
                                <SearchableSelect 
                                    label="Job Title"
                                    required
                                    options={getJobTitlesForCategory(editingJob.category)}
                                    value={editingJob.title}
                                    onChange={title => setEditingJob({ ...editingJob, title })}
                                    placeholder={editingJob.category ? "Search job title..." : "Select category first"}
                                    disabled={!editingJob.category}
                                    disabledPlaceholder="Select category first"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Workers Required</label>
                                    <input 
                                        type="number" 
                                        min={1}
                                        value={editingJob.workersRequired}
                                        onChange={e => setEditingJob({ ...editingJob, workersRequired: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Pay Rate (INR)</label>
                                    <input 
                                        type="number" 
                                        value={editingJob.payRate}
                                        onChange={e => setEditingJob({ ...editingJob, payRate: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Pay Type</label>
                                    <select 
                                        value={editingJob.paymentType}
                                        onChange={e => setEditingJob({ ...editingJob, paymentType: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    >
                                        <option value="DAILY">Daily Rate</option>
                                        <option value="HOURLY">Hourly Rate</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={editingJob.workingDate}
                                        onChange={e => setEditingJob({ ...editingJob, workingDate: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={editingJob.startTime}
                                        onChange={e => setEditingJob({ ...editingJob, startTime: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={editingJob.endTime}
                                        onChange={e => setEditingJob({ ...editingJob, endTime: e.target.value })}
                                        className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Location / Area</label>
                                <input 
                                    type="text" 
                                    value={editingJob.location}
                                    onChange={e => setEditingJob({ ...editingJob, location: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Job Description</label>
                                <textarea 
                                    rows={3}
                                    value={editingJob.description}
                                    onChange={e => setEditingJob({ ...editingJob, description: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingJob(null)}
                                    className="w-1/2 py-2.5 rounded-xl border border-gray-300 font-bold text-xs hover:bg-gray-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 py-2.5 rounded-xl bg-[#F97316] text-white font-bold text-xs hover:bg-[#EA580C] cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Team Modal */}
            {editingTeam && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-[#FEF3C7] shadow-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-extrabold text-[#111827]">Edit Team</h3>
                            <button 
                                onClick={() => setEditingTeam(null)} 
                                className="text-gray-400 hover:text-gray-600 font-extrabold text-lg cursor-pointer"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-[#111827] mb-1">
                                    Team Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editingTeam.name}
                                    onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                                    className="w-full input-field-style rounded-xl px-4 py-2 text-sm border border-[#FEF3C7]"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-[#111827] mb-1">
                                    Team Leader <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={editingTeam.leaderId}
                                    onChange={e => {
                                        const lId = e.target.value;
                                        const updated = lId && !editingTeam.members.includes(lId)
                                            ? [...editingTeam.members, lId]
                                            : editingTeam.members;
                                        setEditingTeam({ ...editingTeam, leaderId: lId, members: updated });
                                    }}
                                    className="w-full bg-white border border-[#FEF3C7] rounded-xl px-4 py-2 text-sm focus:border-[#F97316]"
                                    required
                                >
                                    <option value="">[ Select Worker ▼ ]</option>
                                    {workers.map(w => (
                                        <option key={w._id} value={w._id}>
                                            {w.name} {w.phone ? `(${w.phone})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <WorkerMultiSelect
                                    label="Team Members"
                                    workers={workers}
                                    selectedWorkerIds={editingTeam.members}
                                    onChange={ids => {
                                        const updated = editingTeam.leaderId && !ids.includes(editingTeam.leaderId)
                                            ? [editingTeam.leaderId, ...ids]
                                            : ids;
                                        setEditingTeam({ ...editingTeam, members: updated });
                                    }}
                                    placeholder="Select workers ▼"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingTeam(null)}
                                    className="w-1/2 py-2.5 rounded-xl border border-gray-200 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-1/2 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-orange-600 cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showLockModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl border border-[#FFF7D6] p-8 max-w-sm w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-[#FFF7D6] text-[#F97316] rounded-full flex items-center justify-center mx-auto">
                            <Lock className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-[#171717]">Feature Locked</h3>
                            <p className="text-sm text-[#78716C]">
                                Company verification is required to access this feature.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowLockModal(false)}
                                className="bg-[#FFFCF5] hover:bg-[#FFF7D6] border border-[#FFF7D6] text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex-1"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => {
                                    setShowLockModal(false);
                                    navigate('/company/verification');
                                }}
                                className="bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex-1"
                            >
                                Complete Verification
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
