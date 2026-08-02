import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Settings, BarChart3, ListFilter, Users, ShoppingBag, DollarSign, ZoomIn, ZoomOut, RotateCw, Check, X, ShieldAlert, ArrowUpRight, Clock, FileText } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import AdminReviewsPanel from '../components/AdminReviewsPanel';
import AdminSupportPanel from '../components/AdminSupportPanel';import AdminChatModerationPanel from '../components/AdminChatModerationPanel';

export const AdminDashboard = () => {
    const { logout } = useAuth();
    const [activeSection, setActiveSection] = useState('analytics');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [metrics, setMetrics] = useState(null);
    const [pendingWorkers, setPendingWorkers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [commissionRules, setCommissionRules] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [payoutRequests, setPayoutRequests] = useState([]);

    const [catName, setCatName] = useState('');
    const [catDesc, setCatDesc] = useState('');
    const [catIcon] = useState('Zap');
    const [catCommission, setCatCommission] = useState(10);

    const [ruleScope, setRuleScope] = useState('GLOBAL');
    const [ruleName, setRuleName] = useState('');
    const [rulePercent, setRulePercent] = useState(10);
    const [rulePriority, setRulePriority] = useState(3);
    const [ruleCatId, setRuleCatId] = useState('');
    const [ruleWorkerId, setRuleWorkerId] = useState('');
    const [ruleMinCapRupees, setRuleMinCapRupees] = useState(0);
    const [ruleMaxCapRupees, setRuleMaxCapRupees] = useState('');

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewCustomRupees, setPreviewCustomRupees] = useState(1000);
    const [previewResults, setPreviewResults] = useState([]);
    const [conflictWarning, setConflictWarning] = useState('');

    const [selectedReview, setSelectedReview] = useState(null);
    const [decryptedNumber, setDecryptedNumber] = useState('');
    const [reviewReason, setReviewReason] = useState('');
    const [zoomScale, setZoomScale] = useState(1);
    const [rotateDeg, setRotateDeg] = useState(0);

    const [ledgerAccounts, setLedgerAccounts] = useState([]);
    const [ledgerTransactions, setLedgerTransactions] = useState([]);

    const fetchAnalytics = async () => {
        const res = await api.get('/admin/analytics');
        if (res.data.success) setMetrics(res.data.metrics);
    };

    const fetchVerificationQueue = async () => {
        const res = await api.get('/admin/workers/pending');
        if (res.data.success) {
            setPendingWorkers((res.data.data || []).filter(item => item?.profile?.userId));
        }
    };

    const fetchCategoriesList = async () => {
        const res = await api.get('/admin/categories/all');
        if (res.data.success) setCategories(res.data.categories || []);
    };

    const fetchCommissionRulesList = async () => {
        const res = await api.get('/v1/pricing/admin/commission-rules');
        if (res.data.success) setCommissionRules(res.data.rules || res.data.data || []);
    };

    useEffect(() => {
        let active = true;
        const loadDashboard = async () => {
            setLoading(true);
            setError('');
            const tasks = [fetchAnalytics(), fetchVerificationQueue(), fetchCategoriesList(), fetchCommissionRulesList()];
            const results = await Promise.allSettled(tasks);
            if (!active) return;
            const rejected = results.find(result => result.status === 'rejected');
            if (rejected) setError(rejected.reason?.response?.data?.message || 'Some dashboard data could not be loaded.');
            setLoading(false);
        };
        loadDashboard();
        return () => { active = false; };
    }, []);

    const fetchLedgerData = async () => {
        try {
            const resAcc = await api.get('/admin/ledger/accounts');
            if (resAcc.data.success) {
                setLedgerAccounts(resAcc.data.accounts || []);
            }
            const resTx = await api.get('/admin/ledger/transactions');
            if (resTx.data.success) {
                setLedgerTransactions(resTx.data.transactions || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (activeSection === 'ledger') {
            fetchLedgerData();
        }
    }, [activeSection]);

    const fetchAuditLogsList = async () => {
        try {
            const res = await api.get('/admin/audit-logs');
            if (res.data.success) {
                setAuditLogs(res.data.logs || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchPayoutsList = async () => {
        try {
            const res = await api.get('/admin/payouts');
            if (res.data.success) {
                setPayoutRequests(res.data.data || res.data.requests || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!catName || !catDesc) return;
        try {
            const res = await api.post('/admin/categories', {
                name: catName,
                description: catDesc,
                icon: catIcon,
                defaultCommission: Number(catCommission),
            });
            if (res.data.success) {
                setSuccess('Service Category created successfully.');
                setCatName('');
                setCatDesc('');
                fetchCategoriesList();
            }
        } catch (err) {
            setError('Failed to create category.');
        }
    };



    const handleCreateCommissionRule = async (e) => {
        e.preventDefault();
        setConflictWarning('');
        setError('');
        setSuccess('');
        try {
            const res = await api.post('/v1/pricing/admin/commission-rules', {
                name: ruleName,
                scope: ruleScope,
                serviceCategoryId: ruleScope === 'CATEGORY' ? ruleCatId : undefined,
                workerId: ruleScope === 'WORKER' ? ruleWorkerId : undefined,
                percentageBps: Math.round(Number(rulePercent) * 100), // e.g. 10% = 1000 bps
                minimumCommissionPaise: Number(ruleMinCapRupees) * 100,
                maximumCommissionPaise: ruleMaxCapRupees ? Number(ruleMaxCapRupees) * 100 : undefined,
                priority: Number(rulePriority),
                effectiveFrom: new Date().toISOString(),
            });

            if (res.data.success) {
                setSuccess('Commission rule override configured.');
                setRuleName('');
                setRuleMinCapRupees(0);
                setRuleMaxCapRupees('');
                fetchCommissionRulesList();
            }
        } catch (err) {
            if (err.response?.status === 409) {
                setConflictWarning(err.response.data.message || 'Conflicting active commission rule exists.');
            } else {
                setError(err.response?.data?.message || 'Failed to create commission override.');
            }
        }
    };

    const handleRunLivePreview = async (sampleAmounts = [500, 1000, 2500, previewCustomRupees]) => {
        try {
            const res = await api.post('/v1/pricing/admin/commission-rules/preview', {
                percentageBps: Math.round(Number(rulePercent) * 100),
                fixedAmountPaise: 0,
                minimumCommissionPaise: Number(ruleMinCapRupees) * 100,
                maximumCommissionPaise: ruleMaxCapRupees ? Number(ruleMaxCapRupees) * 100 : undefined,
                sampleAmountsRupees: sampleAmounts,
            });
            if (res.data.success) {
                setPreviewResults(res.data.previews);
                setPreviewModalOpen(true);
            }
        } catch (err) {
            setError('Failed to generate live preview.');
        }
    };

    const handleViewDecryptedDoc = async (docId) => {
        try {
            const res = await api.get(`/admin/documents/view/${docId}`);
            if (res.data.success) {
                setDecryptedNumber(res.data.documentNumber);
            }
        } catch (err) {
            setError('Failed to decrypt document identifier.');
        }
    };

    const handleVerifyAction = async (workerId, action) => {
        if (!reviewReason) {
            setError('A verification reason is mandatory.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post(`/admin/workers/verify/${workerId}`, {
                action,
                reason: reviewReason,
            });
            if (res.data.success) {
                setSuccess(`Worker verification ${action.toLowerCase()} complete.`);
                setSelectedReview(null);
                setReviewReason('');
                setDecryptedNumber('');
                fetchVerificationQueue();
                fetchAnalytics();
                fetchAuditLogsList();
            }
        } catch (err) {
            setError('Failed to process worker verification.');
        } finally {
            setLoading(false);
        }
    };

    const handleProcessPayout = async (txnId, action) => {
        try {
            const res = await api.post(`/admin/payouts/${txnId}/${action}`);
            if (res.data.success) {
                setSuccess(`Payout action completed: ${action}.`);
                fetchPayoutsList();
                fetchAnalytics();
            }
        } catch (err) {
            setError('Failed to process payout.');
        }
    };

    const chartData = [
        { name: 'Mon', Revenue: 4000, Commission: 400 },
        { name: 'Tue', Revenue: 5500, Commission: 550 },
        { name: 'Wed', Revenue: 6200, Commission: 620 },
        { name: 'Thu', Revenue: 7800, Commission: 780 },
        { name: 'Fri', Revenue: 9500, Commission: 950 },
        { name: 'Sat', Revenue: 11000, Commission: 1100 },
        { name: 'Sun', Revenue: 14000, Commission: 1400 },
    ];

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] flex flex-col lg:flex-row font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 border-r border-[#E7E0D8] bg-white px-6 py-6 flex flex-col justify-between shrink-0 shadow-sm">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl logo-gradient flex items-center justify-center font-black text-white text-base shadow-sm">
                            H
                        </div>
                        <span className="font-extrabold text-[#1C1917] text-xl tracking-tight">HyperLocal<span className="text-[#E87A1E]">.</span></span>
                        <span className="bg-[#FEF2F2] text-[#DC2626] text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-[#FCA5A5]">
                            Admin
                        </span>
                    </div>

                    <nav className="space-y-1.5">
                        <button onClick={() => { setActiveSection('analytics'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'analytics' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <BarChart3 className="w-4 h-4"/>
                            Platform Analytics
                        </button>
                        <button onClick={() => { setActiveSection('queue'); setError(''); setSuccess(''); }} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'queue' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <div className="flex items-center gap-3">
                                <UserCheck className="w-4 h-4"/>
                                Verification Queue
                            </div>
                            {pendingWorkers.length > 0 && (
                                <span className="bg-[#DC2626]/10 text-[#DC2626] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#DC2626]/20">
                                    {pendingWorkers.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => { setActiveSection('categories'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'categories' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <Settings className="w-4 h-4"/>
                            Service Categories
                        </button>
                        <button onClick={() => { setActiveSection('commissions'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'commissions' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <ListFilter className="w-4 h-4"/>
                            Commission Overrides
                        </button>
                        <button onClick={() => { setActiveSection('payouts'); setError(''); setSuccess(''); }} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'payouts' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <div className="flex items-center gap-3">
                                <DollarSign className="w-4 h-4"/>
                                Payout Approvals
                            </div>
                            {payoutRequests.length > 0 && (
                                <span className="bg-[#D97706]/10 text-[#D97706] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#D97706]/20">
                                    {payoutRequests.length}
                                </span>
                            )}
                        </button>
                        <button onClick={() => { setActiveSection('audit'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'audit' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <ShieldCheck className="w-4 h-4"/>
                            System Audit Logs
                        </button>
                        <button onClick={() => { setActiveSection('ledger'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'ledger' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <FileText className="w-4 h-4"/>
                            Platform Ledger
                        </button>
                        <button onClick={() => { setActiveSection('reviews'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'reviews' ? 'bg-[#E87A1E] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FFF5EA] hover:text-[#1C1917]'}`}>
                            <ShieldAlert className="w-4 h-4"/> Review Moderation
                        </button>
                        <button onClick={()=>setActiveSection('support')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${activeSection==='support'?'bg-[#E87A1E] text-white':'text-[#78716C]'}`}><Users className="w-4 h-4"/>Support Operations</button>
                        <button onClick={()=>setActiveSection('chat-moderation')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${activeSection==='chat-moderation'?'bg-[#E87A1E] text-white':'text-[#78716C]'}`}><ShieldAlert className="w-4 h-4"/>Chat Moderation</button>
                    </nav>
                </div>

                <button onClick={logout} className="bg-[#FAF6F0] hover:bg-[#FFF5EA] border border-[#E7E0D8] rounded-xl py-2 px-4 text-[#44403C] text-xs font-semibold cursor-pointer">
                    Sign Out Dashboard
                </button>
            </aside>

            {/* Main Body */}
            <main className="flex-grow flex flex-col h-screen overflow-hidden">
                <UserCategoryBanner />
                <div className="flex-grow p-6 lg:p-8 overflow-y-auto space-y-6">
                    {success && (
                        <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] text-sm p-4 rounded-xl flex items-center justify-between">
                            <span>{success}</span>
                            <button onClick={() => setSuccess('')} className="text-[#16A34A] font-bold text-xs cursor-pointer"><X className="w-4 h-4"/></button>
                        </div>
                    )}

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-sm p-4 rounded-xl flex items-center justify-between">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="text-[#DC2626] font-bold text-xs cursor-pointer"><X className="w-4 h-4"/></button>
                        </div>
                    )}

                    {/* Analytics Section */}
                    {activeSection === 'analytics' && metrics && (
                        <div className="space-y-6">
                            <h1 className="text-xl font-extrabold text-[#1C1917]">Platform Metrics Dashboard</h1>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FFF5EA] text-[#E87A1E]"><Users className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Total Users</span>
                                        <span className="text-lg font-black text-[#1C1917]">{(metrics.totalCustomers || 0) + (metrics.totalWorkers || 0)}</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FFF5EA] text-[#E87A1E]"><ShoppingBag className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Active Orders</span>
                                        <span className="text-lg font-black text-[#1C1917]">{metrics.activeBookings || 0}</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#F0FDF4] text-[#16A34A]"><DollarSign className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Gross Value</span>
                                        <span className="text-lg font-black text-[#1C1917]">₹{((metrics.grossBookingValue || 0) / 100).toFixed(0)}</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FFF5EA] text-[#D97706]"><DollarSign className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Rev Commission</span>
                                        <span className="text-lg font-black text-[#1C1917]">₹{((metrics.platformCommission || 0) / 100).toFixed(0)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 shadow-sm">
                                <h3 className="font-bold text-[#1C1917] text-sm mb-4">Revenue & Commissions Growth Trend</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D8"/>
                                            <XAxis dataKey="name" stroke="#78716C" fontSize={11}/>
                                            <YAxis stroke="#78716C" fontSize={11}/>
                                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E7E0D8' }}/>
                                            <Legend />
                                            <Line type="monotone" dataKey="Revenue" stroke="#E87A1E" activeDot={{ r: 8 }}/>
                                            <Line type="monotone" dataKey="Commission" stroke="#D97706"/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Verification Queue Section */}
                    {activeSection === 'queue' && (
                        <div className="space-y-6">
                            <h1 className="text-xl font-extrabold text-[#1C1917]">Worker Onboarding Verification Queue</h1>
                            
                            {pendingWorkers.length === 0 ? (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 text-center text-[#78716C] text-sm shadow-sm">
                                    No workers currently pending verification review.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {pendingWorkers.map((review) => (
                                        <div key={review.profile._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 rounded-xl bg-[#FFF5EA] border border-[#FDBA74] flex items-center justify-center font-bold text-[#E87A1E] text-sm">
                                                        {review.profile.userId?.name[0]}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-[#1C1917] text-sm">{review.profile.userId?.name}</h3>
                                                        <span className="text-[10px] text-[#78716C]">{review.profile.userId?.email}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[#78716C] line-clamp-2 max-w-lg">{review.profile.bio}</p>
                                            </div>

                                            <button onClick={() => setSelectedReview(review)} className="btn-primary-gradient font-bold text-xs py-2 px-4 rounded-xl cursor-pointer">
                                                Audit Documents
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedReview && (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-6 shadow-md">
                                    <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3">
                                        <h3 className="font-bold text-[#1C1917] text-base">KYC Document Auditor: {selectedReview.profile.userId?.name}</h3>
                                        <button onClick={() => { setSelectedReview(null); setDecryptedNumber(''); }} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer">Close Auditor</button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <span className="text-xs font-semibold text-[#44403C] uppercase tracking-wider block">Submitted Credentials</span>
                                            
                                            <div className="space-y-3">
                                                {selectedReview.documents.map((doc) => (
                                                    <div key={doc._id} className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-4 flex items-center justify-between">
                                                        <div>
                                                            <span className="block font-bold text-[#1C1917] text-xs">{doc.documentType}</span>
                                                            <span className="block text-[10px] text-[#A8A29E] mt-0.5">Masked: {doc.documentNumberMasked}</span>
                                                            {decryptedNumber && (<span className="block text-[10px] text-[#E87A1E] font-bold mt-1">Decrypted: {decryptedNumber}</span>)}
                                                        </div>
                                                        <button onClick={() => handleViewDecryptedDoc(doc._id)} className="bg-white border border-[#E7E0D8] hover:border-[#E87A1E] text-[#44403C] font-bold text-[9px] py-1.5 px-3 rounded-lg cursor-pointer">
                                                            Decrypt ID
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="border border-[#E7E0D8] bg-[#FAF6F0] rounded-3xl p-5 relative overflow-hidden h-64 flex items-center justify-center">
                                                <div className="absolute top-3 right-3 flex gap-2 z-10">
                                                    <button onClick={() => setZoomScale(Math.min(zoomScale + 0.2, 2))} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><ZoomIn className="w-3.5 h-3.5"/></button>
                                                    <button onClick={() => setZoomScale(Math.max(zoomScale - 0.2, 0.5))} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><ZoomOut className="w-3.5 h-3.5"/></button>
                                                    <button onClick={() => setRotateDeg(rotateDeg + 90)} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><RotateCw className="w-3.5 h-3.5"/></button>
                                                </div>
                                                <img src={selectedReview.documents[0]?.frontFile} alt="Doc Preview" style={{ transform: `scale(${zoomScale}) rotate(${rotateDeg}deg)`, transition: 'transform 0.2s ease-in-out' }} className="max-h-full max-w-full rounded-lg object-contain"/>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <span className="text-xs font-semibold text-[#44403C] uppercase tracking-wider block">Auditor Decision Board</span>
                                            
                                            <div className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-5 space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-2">Internal Verification Notes</label>
                                                    <textarea rows={4} value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Provide mandatory decision notes..." className="w-full bg-white border border-[#E7E0D8] focus:border-[#E87A1E] rounded-xl py-3 px-4 text-[#1C1917] text-xs outline-none resize-none" required/>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <button onClick={() => handleVerifyAction(selectedReview.profile.userId?._id, 'APPROVED')} disabled={loading} className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">
                                                        Approve Profile
                                                    </button>
                                                    <button onClick={() => handleVerifyAction(selectedReview.profile.userId?._id, 'REJECTED')} disabled={loading} className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer">
                                                        Reject Profile
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Service Categories Section */}
                    {activeSection === 'categories' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <h1 className="text-xl font-extrabold text-[#1C1917]">Active Service Categories</h1>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {categories.map((cat) => (
                                        <div key={cat._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center justify-between shadow-sm">
                                            <div>
                                                <h3 className="font-bold text-[#1C1917] text-sm">{cat.name}</h3>
                                                <p className="text-[#78716C] text-xs mt-1">{cat.description}</p>
                                                <span className="inline-block bg-[#FFF5EA] text-[#E87A1E] text-[9px] font-semibold px-2 py-0.5 rounded-full mt-2 border border-[#FDBA74]">
                                                    Commission: {cat.defaultCommission}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleCreateCategory} className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-4 shadow-sm">
                                <h3 className="font-bold text-[#1C1917] text-sm pb-2 border-b border-[#E7E0D8]">Add Service Category</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Name</label>
                                        <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Caretaker" className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Description</label>
                                        <textarea rows={2} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Brief description..." className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none resize-none" required/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Commission (%)</label>
                                        <input type="number" value={catCommission} onChange={(e) => setCatCommission(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                    </div>
                                    <button type="submit" className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer mt-2">
                                        Create Category
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Commission Rules Section */}
                    {activeSection === 'commissions' && (
                        <div className="space-y-6">
                            {conflictWarning && (
                                <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 flex-shrink-0"/>
                                        <span className="font-bold">{conflictWarning}</span>
                                    </div>
                                    <button onClick={() => setConflictWarning('')} className="text-[#DC2626] font-bold text-xs"><X className="w-4 h-4"/></button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h1 className="text-xl font-extrabold text-[#1C1917]">Commission Tier Rules & Overrides</h1>
                                        <button onClick={() => handleRunLivePreview()} className="bg-white border border-[#E87A1E] text-[#E87A1E] hover:bg-[#FFF5EA] font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer">
                                            Live Calculation Preview
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {commissionRules.length === 0 ? (
                                            <div className="bg-white border border-[#E7E0D8] rounded-2xl p-6 text-center text-[#78716C] text-xs shadow-sm">
                                                No active commission rules configured. Using system fallback default.
                                            </div>
                                        ) : (
                                            commissionRules.map((rule) => (
                                                <div key={rule._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center justify-between shadow-sm">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-[#1C1917] text-sm">{rule.name}</h3>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rule.scope === 'WORKER' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#86EFAC]' : rule.scope === 'CATEGORY' ? 'bg-[#FFF5EA] text-[#E87A1E] border-[#FDBA74]' : 'bg-[#FAF6F0] text-[#78716C] border-[#E7E0D8]'}`}>
                                                                Scope: {rule.scope}
                                                            </span>
                                                            <span className="bg-[#FAF6F0] text-[#78716C] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#E7E0D8]">
                                                                Priority: P{rule.priority}
                                                            </span>
                                                        </div>
                                                        <p className="text-[#78716C] text-xs mt-1">
                                                            {rule.scope === 'WORKER' ? `Worker: ${rule.workerId?.name || 'Assigned Worker'}` : rule.scope === 'CATEGORY' ? `Category: ${rule.serviceCategoryId?.name || 'Category'}` : 'System-wide Global Default'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xl font-black text-[#1C1917]">{(rule.percentageBps / 100).toFixed(1)}%</span>
                                                        <span className="block text-[10px] text-[#A8A29E]">Platform Cut</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleCreateCommissionRule} className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-4 shadow-sm">
                                    <h3 className="font-bold text-[#1C1917] text-sm pb-2 border-b border-[#E7E0D8]">Create Commission Rule</h3>
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Rule Scope</label>
                                            <div className="grid grid-cols-3 gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#E7E0D8] text-[10px] font-bold">
                                                {['GLOBAL', 'CATEGORY', 'WORKER'].map((s) => (
                                                    <button type="button" key={s} onClick={() => setRuleScope(s)} className={`py-1.5 rounded-lg cursor-pointer ${ruleScope === s ? 'bg-[#E87A1E] text-white' : 'text-[#78716C]'}`}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Rule Name</label>
                                            <input type="text" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Senior Care Override" className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required/>
                                        </div>

                                        {ruleScope === 'CATEGORY' && (
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Target Category</label>
                                                <select value={ruleCatId} onChange={(e) => setRuleCatId(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required>
                                                    <option value="">Select Category</option>
                                                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Commission (%)</label>
                                                <input type="number" step="0.1" value={rulePercent} onChange={(e) => setRulePercent(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Priority (1-5)</label>
                                                <input type="number" min="1" max="5" value={rulePriority} onChange={(e) => setRulePriority(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required/>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Min Cap (₹)</label>
                                                <input type="number" value={ruleMinCapRupees} onChange={(e) => setRuleMinCapRupees(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Max Cap (₹)</label>
                                                <input type="number" value={ruleMaxCapRupees} onChange={(e) => setRuleMaxCapRupees(e.target.value)} placeholder="No Max" className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                            </div>
                                        </div>

                                        <button type="submit" className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer mt-2">
                                            Save Commission Rule
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Live Calculation Preview Modal */}
                            {previewModalOpen && (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-4 shadow-md">
                                    <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3">
                                        <h3 className="font-bold text-[#1C1917] text-sm">Live Backend Calculation Preview</h3>
                                        <button onClick={() => setPreviewModalOpen(false)} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer"><X className="w-4 h-4"/></button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-semibold text-[#44403C]">Custom Sample Amount (₹):</label>
                                        <input type="number" value={previewCustomRupees} onChange={(e) => setPreviewCustomRupees(Number(e.target.value))} className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-1.5 px-3 text-xs w-32 outline-none"/>
                                        <button onClick={() => handleRunLivePreview([500, 1000, 2500, previewCustomRupees])} className="btn-primary-gradient text-xs font-bold py-1.5 px-3 rounded-xl cursor-pointer">
                                            Recalculate
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                        {previewResults.map((p, idx) => (
                                            <div key={idx} className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-4 space-y-1.5">
                                                <div className="text-xs font-extrabold text-[#1C1917]">Base: ₹{p.sampleRupees}</div>
                                                <div className="text-[11px] text-[#DC2626] font-semibold">Commission: ₹{p.commissionRupees}</div>
                                                <div className="text-[11px] text-[#16A34A] font-semibold">Worker Earning: ₹{p.workerEarningRupees}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Platform Ledger Section */}
                    {activeSection === 'ledger' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h1 className="text-xl font-extrabold text-[#1C1917]">Double-Entry Platform Ledger</h1>
                                <button onClick={async () => {
                                    try {
                                        const res = await api.post('/admin/ledger/reconcile-all');
                                        if (res.data.success) {
                                            setSuccess('All worker wallets reconciled and verified successfully.');
                                            fetchLedgerData();
                                        }
                                    } catch (err) {
                                        setError('Reconciliation sweep failed.');
                                    }
                                }} className="bg-white border border-[#E87A1E] text-[#E87A1E] hover:bg-[#FFF5EA] font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer">
                                    Reconcile All Wallets
                                </button>
                            </div>

                            {/* Accounts Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {ledgerAccounts.map((acc) => (
                                    <div key={acc._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 shadow-sm space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-[10px] text-[#A8A29E] font-bold uppercase tracking-wider">{acc.accountType}</span>
                                                <h4 className="font-extrabold text-[#1C1917] text-sm mt-0.5">{acc.name}</h4>
                                            </div>
                                            <span className="bg-[#FAF6F0] text-[#78716C] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E7E0D8]">
                                                {acc.normalBalance}
                                            </span>
                                        </div>
                                        <div className="pt-2 flex justify-between items-baseline border-t border-[#F5EFE6]">
                                            <span className="text-xs text-[#78716C]">Balance:</span>
                                            <span className="text-base font-black text-[#1C1917]">₹{(acc.cachedBalancePaise / 100).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Transactions Table */}
                            <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 shadow-sm space-y-4">
                                <h3 className="font-bold text-[#1C1917] text-sm">Ledger Journal Entries</h3>
                                {ledgerTransactions.length === 0 ? (
                                    <p className="text-xs text-[#78716C]">No journal entries posted yet.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-[#E7E0D8] text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">
                                                    <th className="py-2.5 px-4">Txn Number</th>
                                                    <th className="py-2.5 px-4">Event</th>
                                                    <th className="py-2.5 px-4">Type</th>
                                                    <th className="py-2.5 px-4">Status</th>
                                                    <th className="py-2.5 px-4">Amount</th>
                                                    <th className="py-2.5 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ledgerTransactions.map((tx) => (
                                                    <tr key={tx._id} className="border-b border-[#F5EFE6] text-xs font-semibold hover:bg-[#FAF6F0]/50">
                                                        <td className="py-3 px-4 font-mono text-[#1C1917]">{tx.transactionNumber}</td>
                                                        <td className="py-3 px-4 text-[#78716C]">{tx.businessEvent}</td>
                                                        <td className="py-3 px-4">
                                                            <span className="bg-[#FAF6F0] text-[#78716C] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E7E0D8]">
                                                                {tx.transactionType}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${tx.status === 'POSTED' ? 'bg-[#F0FDF4] text-[#16A34A]' : tx.status === 'REVERSED' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FFF5EA] text-[#E87A1E]'}`}>
                                                                {tx.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-bold text-[#1C1917]">₹{(tx.totalDebitPaise / 100).toFixed(2)}</td>
                                                        <td className="py-3 px-4 text-right">
                                                            {tx.status === 'POSTED' && (
                                                                <button onClick={async () => {
                                                                    const reason = prompt('Please enter a reason for this corrective reversal:');
                                                                    if (!reason) return;
                                                                    try {
                                                                        const res = await api.post(`/admin/ledger/reverse/${tx._id}`, { reason });
                                                                        if (res.data.success) {
                                                                            setSuccess('Transaction reversed successfully.');
                                                                            fetchLedgerData();
                                                                        }
                                                                    } catch (err) {
                                                                        setError(err.response?.data?.message || 'Failed to reverse transaction.');
                                                                    }
                                                                }} className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">
                                                                    Reverse
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
                        </div>
                    )}

                    {/* Payout Approvals Section */}
                    {activeSection === 'payouts' && (
                        <div className="space-y-6">
                            <h1 className="text-xl font-extrabold text-[#1C1917]">Worker Payout Requests</h1>

                            {payoutRequests.length === 0 ? (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 text-center text-[#78716C] text-sm shadow-sm">
                                    No pending payout withdrawal requests.
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-3xl border border-[#E7E0D8] bg-white shadow-sm">
                                    <div className="grid grid-cols-5 bg-[#FAF6F0] border-b border-[#E7E0D8] px-6 py-3 text-[10px] font-bold text-[#A8A29E] uppercase tracking-wider">
                                        <span>Worker</span>
                                        <span>Amount</span>
                                        <span>Bank / UPI ID</span>
                                        <span>Status</span>
                                        <span className="text-right">Actions</span>
                                    </div>
                                    {payoutRequests.map((req) => (
                                        <div key={req._id} className="grid grid-cols-5 items-center px-6 py-4 border-b border-[#E7E0D8] text-xs font-semibold">
                                            <span className="text-[#1C1917]">{req.userId?.name || 'Worker'}</span>
                                            <span className="text-[#16A34A] font-bold">₹{(req.amount / 100).toFixed(2)}</span>
                                            <span className="text-[#78716C]">Masked payout account</span>
                                            <span className="inline-block bg-[#FFF5EA] text-[#E87A1E] text-[10px] font-bold px-2 py-0.5 rounded-full w-max">
                                                {req.status}
                                            </span>
                                            <div className="flex justify-end gap-2">
                                                {req.status === 'UNDER_REVIEW' && <button onClick={() => handleProcessPayout(req._id, 'approve')} className="bg-[#16A34A] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">Approve</button>}
                                                {req.status === 'RESERVED' && <button onClick={() => handleProcessPayout(req._id, 'process')} className="bg-[#E87A1E] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">Submit Provider</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audit Logs Section */}
                    {activeSection === 'reviews' && <AdminReviewsPanel />}
                    {activeSection === 'support' && <AdminSupportPanel />}
                    {activeSection === 'chat-moderation' && <AdminChatModerationPanel />}

                    {/* Audit Logs Section */}
                    {activeSection === 'audit' && (
                        <div className="space-y-6">
                            <h1 className="text-xl font-extrabold text-[#1C1917]">System Security Audit Trail</h1>

                            {auditLogs.length === 0 ? (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 text-center text-[#78716C] text-sm shadow-sm">
                                    No security audit logs recorded yet.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {auditLogs.map((log) => (
                                        <div key={log._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-xl bg-[#FFF5EA] text-[#E87A1E]">
                                                    <ShieldCheck className="w-4 h-4"/>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-[#1C1917] text-xs">{log.action}</h4>
                                                    <p className="text-[#78716C] text-[11px] mt-0.5">{log.details || log.reason || 'System action executed.'}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-[#A8A29E] font-medium">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
