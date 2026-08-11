import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Settings, BarChart3, ListFilter, Users, ShoppingBag, DollarSign, ZoomIn, ZoomOut, RotateCw, Check, X, ShieldAlert, ArrowUpRight, Clock, FileText, Building2, Trash2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import AdminReviewsPanel from '../components/AdminReviewsPanel';
import AdminSupportPanel from '../components/AdminSupportPanel';import AdminChatModerationPanel from '../components/AdminChatModerationPanel';
import AdminCompanies from './AdminCompanies';

export const AdminDashboard = ({ initialSection = 'analytics' }) => {
    const { logout } = useAuth();
    const [activeSection, setActiveSection] = useState(initialSection);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [metrics, setMetrics] = useState(null);
    const [pendingWorkers, setPendingWorkers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [commissionRules, setCommissionRules] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [payoutRequests, setPayoutRequests] = useState([]);

    // Category delete modal
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });
    const [deletingCategory, setDeletingCategory] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const [catName, setCatName] = useState('');
    const [catDesc, setCatDesc] = useState('');
    const [catIcon] = useState('Zap');
    const [catCommission, setCatCommission] = useState(10);

    const [ruleScope, setRuleScope] = useState('GLOBAL');
    const [ruleName, setRuleName] = useState('');
    const [rulePercent, setRulePercent] = useState(10);
    const [rulePriority, setRulePriority] = useState(4);
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

    const [queueFilter, setQueueFilter] = useState('PENDING_APPROVAL');
    const [activePreviewDoc, setActivePreviewDoc] = useState(null);
    const [documentPreviewUrl, setDocumentPreviewUrl] = useState('');
    const [documentPreviewMime, setDocumentPreviewMime] = useState('');
    const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
    const [documentPreviewError, setDocumentPreviewError] = useState('');
    const [reviewReasonCode, setReviewReasonCode] = useState('INVALID_DOCUMENT');

    useEffect(() => {
        let objectUrl = '';
        let cancelled = false;
        const loadPreview = async () => {
            setDocumentPreviewUrl('');
            setDocumentPreviewMime('');
            setDocumentPreviewError('');
            setZoomScale(1);
            setRotateDeg(0);
            if (!activePreviewDoc?._id) return;
            setDocumentPreviewLoading(true);
            try {
                const response = await api.get(`/v1/worker/verification/documents/${activePreviewDoc._id}/access`, { responseType: 'blob' });
                if (cancelled) return;
                const mime = response.headers['content-type'] || activePreviewDoc.fileMimeType || response.data.type;
                objectUrl = URL.createObjectURL(new Blob([response.data], { type: mime }));
                setDocumentPreviewMime(mime);
                setDocumentPreviewUrl(objectUrl);
            } catch (err) {
                if (!cancelled) setDocumentPreviewError(err.response?.status === 404 ? 'Document file is missing from private storage.' : 'Unable to load the protected document preview.');
            } finally {
                if (!cancelled) setDocumentPreviewLoading(false);
            }
        };
        loadPreview();
        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [activePreviewDoc?._id]);

    const fetchVerificationQueue = async (status = queueFilter) => {
        try {
            const res = await api.get(`/v1/admin/worker-verifications?status=${status}&limit=50`);
            if (res.data.success) {
                setPendingWorkers(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch verification queue', err);
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
        } else if (activeSection === 'payouts') {
            fetchPayoutsList();
        } else if (activeSection === 'audit') {
            fetchAuditLogsList();
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
                price: Number(catPrice),
                durationHours: Number(catDuration),
                status: catStatus,
            });
            if (res.data.success) {
                setSuccess('Service Category created successfully.');
                setCatName('');
                setCatDesc('');
                setCatPrice(499);
                setCatDuration(2);
                setCatStatus('ACTIVE');
                fetchCategoriesList();
            }
        } catch (err) {
            setError('Failed to create category.');
        }
    };

    const handleToggleCategoryStatus = async (catId, newStatus) => {
        try {
            const res = await api.patch(`/admin/categories/${catId}/status`, { status: newStatus });
            if (res.data.success) {
                showToast(`Category status set to ${newStatus}.`, 'success');
                fetchCategoriesList();
            }
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update status.', 'error');
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    };

    const handleDeleteCategory = async () => {
        if (deletingCategory) return;
        setDeletingCategory(true);
        try {
            const res = await api.delete(`/admin/categories/${deleteModal.id}`);
            if (res.data.success) {
                setDeleteModal({ open: false, id: null, name: '' });
                setCategories(prev => prev.filter(c => c._id !== deleteModal.id));
                showToast('Service category removed successfully.', 'success');
            }
        } catch (err) {
            setDeleteModal({ open: false, id: null, name: '' });
            showToast(err.response?.data?.message || 'Failed to remove category.', 'error');
        } finally {
            setDeletingCategory(false);
        }
    };

    const handleCreateCommissionRule = async (e) => {
        e.preventDefault();
        setConflictWarning('');
        setError('');
        setSuccess('');

        // Client-side guard: category scope needs a selected category
        if (ruleScope === 'CATEGORY' && !ruleCatId) {
            setError('Please select a target category for a CATEGORY-scoped rule.');
            return;
        }
        if (ruleScope === 'WORKER' && !ruleWorkerId) {
            setError('Please enter a Worker ID for a WORKER-scoped rule.');
            return;
        }

        try {
            const res = await api.post('/v1/pricing/admin/commission-rules', {
                name: ruleName,
                scope: ruleScope,
                serviceCategoryId: ruleScope === 'CATEGORY' ? ruleCatId : undefined,
                workerId: ruleScope === 'WORKER' ? ruleWorkerId : undefined,
                percentageBps: Math.round(Number(rulePercent) * 100),
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
                setConflictWarning(
                    (err.response.data.message || 'Conflicting active commission rule exists.') +
                    ' Try a different priority number or adjust the scope.'
                );
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

    const handleDocVerifyAction = async (submissionId, documentId, action) => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            let res;
            if (action === 'APPROVE') {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/documents/${documentId}/approve`);
            } else if (action === 'REQUEST_CHANGES') {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/documents/${documentId}/request-changes`, {
                    reasonCode: reviewReasonCode,
                    comment: reviewReason
                });
            } else {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/documents/${documentId}/reject`, {
                    reasonCode: reviewReasonCode,
                    comment: reviewReason
                });
            }
            if (res.data.success) {
                setSuccess(`Document action ${action.toLowerCase()} complete.`);
                setReviewReason('');
                // Refresh detail view
                const detailRes = await api.get(`/v1/admin/worker-verifications/${submissionId}`);
                setSelectedReview(detailRes.data.data.submission);
                fetchVerificationQueue();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update document status.');
        } finally {
            setLoading(false);
        }
    };

    const handleFinalVerifyAction = async (submissionId, action) => {
        if (action !== 'APPROVE' && !reviewReason) {
            setError('A decision comment is mandatory.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            let res;
            if (action === 'APPROVE') {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/approve`);
            } else if (action === 'REQUEST_CHANGES') {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/request-changes`, {
                    reasonCode: reviewReasonCode,
                    comment: reviewReason
                });
            } else {
                res = await api.post(`/v1/admin/worker-verifications/${submissionId}/reject`, {
                    reasonCode: reviewReasonCode,
                    comment: reviewReason
                });
            }
            if (res.data.success) {
                setSuccess(`Worker verification ${action.toLowerCase()} complete.`);
                setSelectedReview(null);
                setActivePreviewDoc(null);
                setReviewReason('');
                setDecryptedNumber('');
                fetchVerificationQueue();
                fetchAnalytics();
                fetchAuditLogsList();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to complete final verification action.');
        } finally {
            setLoading(false);
        }
    };

    const handleSuspendRestoreWorker = async (workerId, action) => {
        if (action === 'SUSPEND' && !reviewReason) {
            setError('A suspension reason is mandatory.');
            return;
        }
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            let res;
            if (action === 'SUSPEND') {
                res = await api.post(`/v1/admin/workers/${workerId}/suspend`, { reason: reviewReason });
            } else {
                res = await api.post(`/v1/admin/workers/${workerId}/restore`);
            }
            if (res.data.success) {
                setSuccess(`Worker ${action.toLowerCase()}ed successfully.`);
                setSelectedReview(null);
                setReviewReason('');
                fetchVerificationQueue();
                fetchAnalytics();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to perform suspend/restore action.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAction = async (workerId, action) => {
        // Fallback backward compatibility
        return handleFinalVerifyAction(selectedReview?._id, action);
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
                        <span className="font-extrabold text-[#1C1917] text-xl tracking-tight">HyperLocal<span className="text-[#EAB308]">.</span></span>
                        <span className="bg-[#FEF2F2] text-[#DC2626] text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-[#FCA5A5]">
                            Admin
                        </span>
                    </div>

                    <nav className="space-y-1.5">
                        <button onClick={() => { setActiveSection('analytics'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'analytics' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <BarChart3 className="w-4 h-4"/>
                            Platform Analytics
                        </button>
                        <button onClick={() => { setActiveSection('queue'); setError(''); setSuccess(''); }} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'queue' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
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
                        <button onClick={() => { setActiveSection('categories'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'categories' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <Settings className="w-4 h-4"/>
                            Service Categories
                        </button>
                        <button onClick={() => { setActiveSection('commissions'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'commissions' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <ListFilter className="w-4 h-4"/>
                            Commission Overrides
                        </button>
                        <button onClick={() => { setActiveSection('payouts'); setError(''); setSuccess(''); }} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'payouts' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
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
                        <button onClick={() => { setActiveSection('audit'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'audit' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <ShieldCheck className="w-4 h-4"/>
                            System Audit Logs
                        </button>
                        <button onClick={() => { setActiveSection('ledger'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'ledger' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <FileText className="w-4 h-4"/>
                            Platform Ledger
                        </button>
                        <button onClick={() => { setActiveSection('reviews'); setError(''); setSuccess(''); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${activeSection === 'reviews' ? 'bg-[#EAB308] text-white shadow-sm' : 'text-[#78716C] hover:bg-[#FEFCE8] hover:text-[#1C1917]'}`}>
                            <ShieldAlert className="w-4 h-4"/> Review Moderation
                        </button>
                        <button onClick={()=>setActiveSection('support')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${activeSection==='support'?'bg-[#EAB308] text-white':'text-[#78716C]'}`}><Users className="w-4 h-4"/>Support Operations</button>
                        <button onClick={()=>setActiveSection('chat-moderation')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${activeSection==='chat-moderation'?'bg-[#EAB308] text-white':'text-[#78716C]'}`}><ShieldAlert className="w-4 h-4"/>Chat Moderation</button>
                        <button onClick={()=>setActiveSection('companies')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold ${activeSection==='companies'?'bg-[#EAB308] text-white text-xs font-semibold':'text-[#78716C]'}`}><Building2 className="w-4 h-4"/>Company Directory</button>
                    </nav>
                </div>

                <button onClick={logout} className="bg-[#FAF6F0] hover:bg-[#FEFCE8] border border-[#E7E0D8] rounded-xl py-2 px-4 text-[#44403C] text-xs font-semibold cursor-pointer">
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

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FEFCE8] text-[#EAB308]"><Users className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Total Users</span>
                                        <span className="text-lg font-black text-[#1C1917]">{(metrics.totalCustomers || 0) + (metrics.totalWorkers || 0)}</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FEFCE8] text-[#EAB308]"><ShoppingBag className="w-5 h-5"/></div>
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
                                    <div className="p-3 rounded-xl bg-[#FEFCE8] text-[#D97706]"><DollarSign className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Rev Commission</span>
                                        <span className="text-lg font-black text-[#1C1917]">₹{((metrics.platformCommission || 0) / 100).toFixed(0)}</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                                    <div className="p-3 rounded-xl bg-[#FEF2F2] text-[#DC2626]"><UserCheck className="w-5 h-5"/></div>
                                    <div>
                                        <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Pending Verification</span>
                                        <span className="text-lg font-black text-[#1C1917]">{metrics.pendingApprovals || 0}</span>
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
                                            <Line type="monotone" dataKey="Revenue" stroke="#EAB308" activeDot={{ r: 8 }}/>
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
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <h1 className="text-xl font-extrabold text-[#1C1917]">Worker Onboarding Verification Queue</h1>
                                <div className="flex gap-2">
                                    {['PENDING_APPROVAL', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => { setQueueFilter(status); fetchVerificationQueue(status); }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                                queueFilter === status 
                                                    ? 'bg-[#FEFCE8] border-[#EAB308] text-[#EAB308]' 
                                                    : 'bg-white border-[#E7E0D8] text-[#78716C] hover:bg-[#FAF6F0]'
                                            }`}
                                        >
                                            {status.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {pendingWorkers.length === 0 ? (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 text-center text-[#78716C] text-sm shadow-sm">
                                    No submissions found for status '{queueFilter.replace('_', ' ')}'.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {pendingWorkers.map((sub) => (
                                        <div key={sub._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="w-10 h-10 rounded-xl bg-[#FEFCE8] border border-[#FEF08A] flex items-center justify-center font-bold text-[#EAB308] text-sm">
                                                        {sub.profileSnapshot?.fullName ? sub.profileSnapshot.fullName[0] : (sub.workerId?.name ? sub.workerId.name[0] : 'W')}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-[#1C1917] text-sm">{sub.profileSnapshot?.fullName || sub.workerId?.name}</h3>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                                                sub.status === 'APPROVED' ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]' :
                                                                sub.status === 'CHANGES_REQUIRED' ? 'bg-[#FEFCE8] border-[#FEF08A] text-[#EAB308]' :
                                                                sub.status === 'REJECTED' ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]' :
                                                                sub.status === 'SUSPENDED' ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]' :
                                                                'bg-[#FEFCE8] border-[#FEF08A] text-[#EAB308]'
                                                            }`}>
                                                                {sub.status.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-[#78716C]">Version {sub.version} · Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-[#78716C] line-clamp-2 max-w-lg">{sub.profileSnapshot?.bio}</p>
                                            </div>

                                            <button 
                                                onClick={async () => {
                                                    setSelectedReview(sub);
                                                    setDecryptedNumber('');
                                                    if (sub.documentIds && sub.documentIds.length > 0) {
                                                        setActivePreviewDoc(sub.documentIds[0]);
                                                    }
                                                }} 
                                                className="btn-primary-gradient font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                                            >
                                                Audit Documents
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedReview && (
                                <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-6 shadow-md">
                                    <div className="flex items-center justify-between border-b border-[#E7E0D8] pb-3">
                                        <h3 className="font-bold text-[#1C1917] text-base">
                                            KYC Document Auditor: {selectedReview.profileSnapshot?.fullName || selectedReview.workerId?.name}
                                        </h3>
                                        <button onClick={() => { setSelectedReview(null); setDecryptedNumber(''); setActivePreviewDoc(null); }} className="text-[#78716C] hover:text-[#1C1917] cursor-pointer text-xs font-bold border border-[#E7E0D8] rounded-xl px-3 py-1 bg-[#FAF6F0]">
                                            Close Auditor
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        {/* Left Column: Documents List */}
                                        <div className="space-y-4">
                                            <span className="text-xs font-semibold text-[#44403C] uppercase tracking-wider block">Submitted Credentials</span>
                                            
                                            <div className="space-y-3">
                                                {(selectedReview.documentIds || []).map((doc) => (
                                                    <div 
                                                        key={doc._id} 
                                                        onClick={() => setActivePreviewDoc(doc)}
                                                        className={`border rounded-2xl p-4 flex flex-col gap-2 transition-all cursor-pointer ${
                                                            activePreviewDoc?._id === doc._id 
                                                                ? 'border-[#EAB308] bg-[#FEFCE8]' 
                                                                : 'border-[#E7E0D8] bg-[#FAF6F0] hover:bg-white'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-[#1C1917] text-xs">{doc.documentType}</span>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                                doc.verificationStatus === 'APPROVED' ? 'bg-[#16A34A]/10 text-[#16A34A]' :
                                                                doc.verificationStatus === 'CHANGES_REQUIRED' ? 'bg-[#D97706]/10 text-[#D97706]' : 'bg-[#78716C]/10 text-[#78716C]'
                                                            }`}>
                                                                {doc.verificationStatus}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-[#A8A29E] flex items-center justify-between">
                                                            <span>Last 4: •••• {doc.documentNumberLast4}</span>
                                                            {doc.expiryDate && <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>}
                                                        </div>
                                                        {decryptedNumber && activePreviewDoc?._id === doc._id && (
                                                            <span className="block text-[10px] text-[#EAB308] font-mono font-bold mt-1">Decrypted: {decryptedNumber}</span>
                                                        )}
                                                        <div className="flex gap-2 justify-end mt-1">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleViewDecryptedDoc(doc._id); }} 
                                                                className="bg-white border border-[#E7E0D8] hover:border-[#EAB308] text-[#44403C] font-bold text-[9px] py-1 px-2.5 rounded-lg cursor-pointer"
                                                            >
                                                                Decrypt ID
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Center Column: Preview Canvas */}
                                        <div className="space-y-4">
                                            <span className="text-xs font-semibold text-[#44403C] uppercase tracking-wider block">Document Canvas</span>
                                            
                                            {activePreviewDoc ? (
                                                <div className="space-y-3">
                                                    <div className="border border-[#E7E0D8] bg-[#FAF6F0] rounded-3xl p-5 relative overflow-hidden h-64 flex items-center justify-center">
                                                        <div className="absolute top-3 right-3 flex gap-2 z-10">
                                                            <button onClick={() => setZoomScale(Math.min(zoomScale + 0.2, 2))} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><ZoomIn className="w-3.5 h-3.5"/></button>
                                                            <button onClick={() => setZoomScale(Math.max(zoomScale - 0.2, 0.5))} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><ZoomOut className="w-3.5 h-3.5"/></button>
                                                            <button onClick={() => setRotateDeg(rotateDeg + 90)} className="bg-white p-1.5 rounded-lg border border-[#E7E0D8] text-[#1C1917] cursor-pointer shadow-sm"><RotateCw className="w-3.5 h-3.5"/></button>
                                                        </div>
                                                        
                                                        {documentPreviewLoading ? (
                                                            <div className="text-xs font-bold text-[#78716C]">Loading protected preview...</div>
                                                        ) : documentPreviewError ? (
                                                            <div className="text-center text-xs font-bold text-[#DC2626] px-6">{documentPreviewError}</div>
                                                        ) : documentPreviewMime === 'application/pdf' ? (
                                                            <div className="text-center p-4">
                                                                <FileText className="w-12 h-12 text-[#A8A29E] mx-auto mb-2"/>
                                                                <span className="text-xs font-bold text-[#57534E]">PDF Document Uploaded</span>
                                                                <a 
                                                                    href={documentPreviewUrl} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="block text-[10px] text-[#EAB308] font-bold mt-1 underline"
                                                                >
                                                                    Open PDF In New Tab
                                                                </a>
                                                            </div>
                                                        ) : documentPreviewUrl ? (
                                                            <img 
                                                                src={documentPreviewUrl} 
                                                                alt="Doc Preview" 
                                                                style={{ transform: `scale(${zoomScale}) rotate(${rotateDeg}deg)`, transition: 'transform 0.2s ease-in-out' }} 
                                                                className="max-h-full max-w-full rounded-lg object-contain"
                                                            />
                                                        ) : null}
                                                    </div>

                                                    {/* Document decision board */}
                                                    {selectedReview.status === 'PENDING_APPROVAL' && (
                                                        <div className="bg-[#FAF6F0] p-4 border border-[#E7E0D8] rounded-2xl space-y-3">
                                                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#57534E]">Review Selected ({activePreviewDoc.documentType})</div>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => handleDocVerifyAction(selectedReview._id, activePreviewDoc._id, 'APPROVE')}
                                                                    className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold py-2 rounded-xl cursor-pointer"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDocVerifyAction(selectedReview._id, activePreviewDoc._id, 'REQUEST_CHANGES')}
                                                                    className="flex-1 bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold py-2 rounded-xl cursor-pointer"
                                                                >
                                                                    Request Changes
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="border border-[#E7E0D8] bg-[#FAF6F0] rounded-3xl h-64 flex items-center justify-center text-xs text-[#78716C]">
                                                    Select a document to preview
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: Final Board */}
                                        <div className="space-y-4">
                                            <span className="text-xs font-semibold text-[#44403C] uppercase tracking-wider block">Auditor Decision Board</span>
                                            
                                            <div className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-2xl p-5 space-y-4">
                                                <div>
                                                    <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1.5">Reason Code</label>
                                                    <select 
                                                        value={reviewReasonCode} 
                                                        onChange={(e) => setReviewReasonCode(e.target.value)}
                                                        className="w-full bg-white border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"
                                                    >
                                                        <option value="INVALID_DOCUMENT">Invalid Document Photo</option>
                                                        <option value="EXPIRED_DOCUMENT">Document Expired</option>
                                                        <option value="NAME_MISMATCH">Name Mismatch</option>
                                                        <option value="AGE_REQUIREMENT_NOT_MET">Under 18 Years Old</option>
                                                        <option value="INCORRECT_NUMBER">Incorrect Document Identifier</option>
                                                        <option value="SUSPECTED_FRAUD">Suspected Fraudulent Document</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1.5">Mandatory Decision Notes</label>
                                                    <textarea 
                                                        rows={4} 
                                                        value={reviewReason} 
                                                        onChange={(e) => setReviewReason(e.target.value)} 
                                                        placeholder="Write detailed reason notes..." 
                                                        className="w-full bg-white border border-[#E7E0D8] focus:border-[#EAB308] rounded-xl py-2.5 px-4 text-[#1C1917] text-xs outline-none resize-none"
                                                    />
                                                </div>

                                                {selectedReview.status === 'PENDING_APPROVAL' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <button 
                                                            onClick={() => handleFinalVerifyAction(selectedReview._id, 'APPROVE')} 
                                                            disabled={loading} 
                                                            className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                                        >
                                                            Final Approve Profile
                                                        </button>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button 
                                                                onClick={() => handleFinalVerifyAction(selectedReview._id, 'REQUEST_CHANGES')} 
                                                                disabled={loading} 
                                                                className="bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                            >
                                                                Request Corrections
                                                            </button>
                                                            <button 
                                                                onClick={() => handleFinalVerifyAction(selectedReview._id, 'REJECT')} 
                                                                disabled={loading} 
                                                                className="bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                            >
                                                                Reject Profile
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2 pt-2 border-t border-[#E7E0D8]">
                                                        {selectedReview.status === 'APPROVED' ? (
                                                            <button 
                                                                onClick={() => handleSuspendRestoreWorker(selectedReview.workerId?._id || selectedReview.profileSnapshot?.userId, 'SUSPEND')}
                                                                className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                                            >
                                                                Suspend Worker Account
                                                            </button>
                                                        ) : selectedReview.status === 'SUSPENDED' ? (
                                                            <button 
                                                                onClick={() => handleSuspendRestoreWorker(selectedReview.workerId?._id || selectedReview.profileSnapshot?.userId, 'RESTORE')}
                                                                className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                                                            >
                                                                Restore Worker Account
                                                            </button>
                                                        ) : (
                                                            <span className="text-center text-[10px] text-[#A8A29E]">No overrides allowed for this review state.</span>
                                                        )}
                                                    </div>
                                                )}
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
                                <h1 className="text-xl font-extrabold text-[#1C1917]">Service Catalog & Admin Controls</h1>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {categories.map((cat) => (
                                        <div key={cat._id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-sm">
                                            <div>
                                                <div className="flex items-start justify-between mb-1">
                                                    <h3 className="font-bold text-[#1C1917] text-sm">{cat.name}</h3>
                                                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                                                        (cat.status === 'ACTIVE' || (!cat.status && cat.isActive !== false)) ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]' :
                                                        cat.status === 'DRAFT' ? 'bg-[#FEFCE8] border-[#FEF08A] text-[#EAB308]' :
                                                        cat.status === 'INACTIVE' ? 'bg-[#FFEDD5] border-[#FED7AA] text-[#F97316]' :
                                                        'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]'
                                                    }`}>
                                                        {cat.status || (cat.isActive !== false ? 'ACTIVE' : 'INACTIVE')}
                                                    </span>
                                                </div>
                                                <p className="text-[#78716C] text-xs line-clamp-2">{cat.description}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-semibold">
                                                    <span className="bg-[#FEFCE8] text-[#EAB308] px-2 py-0.5 rounded-full border border-[#FEF08A]">
                                                        Commission: {cat.defaultCommission}%
                                                    </span>
                                                    <span className="bg-[#FAF6F0] text-[#1C1917] px-2 py-0.5 rounded-full border border-[#E7E0D8]">
                                                        Price: ₹{cat.price || 499}
                                                    </span>
                                                    <span className="bg-[#FAF6F0] text-[#1C1917] px-2 py-0.5 rounded-full border border-[#E7E0D8]">
                                                        Duration: {cat.durationHours || 2} hrs
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-[#F5F0E8] text-xs">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggleCategoryStatus(cat._id, 'ACTIVE')}
                                                        disabled={cat.status === 'ACTIVE'}
                                                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${cat.status === 'ACTIVE' ? 'opacity-50 border-gray-200 text-gray-400' : 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30'}`}
                                                    >
                                                        Activate
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleCategoryStatus(cat._id, 'INACTIVE')}
                                                        disabled={cat.status === 'INACTIVE'}
                                                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${cat.status === 'INACTIVE' ? 'opacity-50 border-gray-200 text-gray-400' : 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30'}`}
                                                    >
                                                        Deactivate
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleCategoryStatus(cat._id, 'DRAFT')}
                                                        disabled={cat.status === 'DRAFT'}
                                                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${cat.status === 'DRAFT' ? 'opacity-50 border-gray-200 text-gray-400' : 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30'}`}
                                                    >
                                                        Draft
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => setDeleteModal({ open: true, id: cat._id, name: cat.name })}
                                                    className="flex items-center gap-1 text-[#EF4444] hover:bg-[#FEF2F2] text-[10px] font-bold px-2.5 py-1 rounded-lg border border-[#FECACA] hover:border-[#EF4444] transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Archive
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleCreateCategory} className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-4 shadow-sm">
                                <h3 className="font-bold text-[#1C1917] text-sm pb-2 border-b border-[#E7E0D8]">Add New Service Category</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Service Name *</label>
                                        <input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Elderly Care Specialist" className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none" required/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Description *</label>
                                        <textarea rows={2} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Full description of service scope..." className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none resize-none" required/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Price (₹)</label>
                                            <input type="number" value={catPrice} onChange={(e) => setCatPrice(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Duration (Hrs)</label>
                                            <input type="number" value={catDuration} onChange={(e) => setCatDuration(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Commission (%)</label>
                                            <input type="number" value={catCommission} onChange={(e) => setCatCommission(Number(e.target.value))} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider mb-1">Initial Status</label>
                                            <select value={catStatus} onChange={(e) => setCatStatus(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none cursor-pointer">
                                                <option value="ACTIVE">ACTIVE</option>
                                                <option value="DRAFT">DRAFT</option>
                                                <option value="INACTIVE">INACTIVE</option>
                                                <option value="ARCHIVED">ARCHIVED</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full btn-primary-gradient font-bold text-xs py-2.5 rounded-xl cursor-pointer mt-2">
                                        Create Service Category
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
                                        <button onClick={() => handleRunLivePreview()} className="bg-white border border-[#EAB308] text-[#EAB308] hover:bg-[#FEFCE8] font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer">
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
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rule.scope === 'WORKER' ? 'bg-[#F0FDF4] text-[#16A34A] border-[#86EFAC]' : rule.scope === 'CATEGORY' ? 'bg-[#FEFCE8] text-[#EAB308] border-[#FEF08A]' : 'bg-[#FAF6F0] text-[#78716C] border-[#E7E0D8]'}`}>
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
                                                    <button
                                                        type="button" key={s}
                                                        onClick={() => {
                                                            setRuleScope(s);
                                                            // Scope-aware priority defaults to avoid seeded-rule conflicts
                                                            if (s === 'WORKER')    setRulePriority(1);
                                                            else if (s === 'CATEGORY') setRulePriority(2);
                                                            else setRulePriority(4); // GLOBAL seeded rule uses 3
                                                            setConflictWarning('');
                                                        }}
                                                        className={`py-1.5 rounded-lg cursor-pointer ${ruleScope === s ? 'bg-[#EAB308] text-white' : 'text-[#78716C]'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-[#A8A29E] mt-1">
                                                Lower priority number = higher precedence. WORKER(1) &gt; CATEGORY(2) &gt; GLOBAL(3+). Seeded global rule uses P3.
                                            </p>
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
                                }} className="bg-white border border-[#EAB308] text-[#EAB308] hover:bg-[#FEFCE8] font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer">
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
                                                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${tx.status === 'POSTED' ? 'bg-[#F0FDF4] text-[#16A34A]' : tx.status === 'REVERSED' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FEFCE8] text-[#EAB308]'}`}>
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
                                            <span className="inline-block bg-[#FEFCE8] text-[#EAB308] text-[10px] font-bold px-2 py-0.5 rounded-full w-max">
                                                {req.status}
                                            </span>
                                            <div className="flex justify-end gap-2">
                                                {req.status === 'UNDER_REVIEW' && <button onClick={() => handleProcessPayout(req._id, 'approve')} className="bg-[#16A34A] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">Approve</button>}
                                                {req.status === 'RESERVED' && <button onClick={() => handleProcessPayout(req._id, 'process')} className="bg-[#EAB308] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer">Submit Provider</button>}
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
                    {activeSection === 'companies' && <AdminCompanies />}

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
                                                <div className="p-2.5 rounded-xl bg-[#FEFCE8] text-[#EAB308]">
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

            {/* ── Delete Confirmation Modal ────────────────────────────────── */}
            {deleteModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-7 border border-[#E7E0D8] animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5 text-[#EF4444]" />
                            </div>
                            <h2 className="font-extrabold text-[#1C1917] text-base">Remove Service Category?</h2>
                        </div>
                        <p className="text-[#78716C] text-sm leading-relaxed mb-6">
                            Are you sure you want to remove <span className="font-bold text-[#1C1917]">{deleteModal.name}</span>?
                            <br />
                            <span className="text-xs mt-1 block text-[#A8A29E]">Existing jobs or workers using this category may be affected.</span>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal({ open: false, id: null, name: '' })}
                                disabled={deletingCategory}
                                className="flex-1 bg-[#FAF6F0] border border-[#E7E0D8] text-[#44403C] font-bold text-xs py-2.5 rounded-xl hover:bg-[#F0EBE3] transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteCategory}
                                disabled={deletingCategory}
                                className="flex-1 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-70 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                {deletingCategory ? (
                                    <>
                                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
                                        </svg>
                                        Removing...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Remove Category
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast Notification ───────────────────────────────────────── */}
            {toast.show && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-semibold transition-all duration-300 ${
                    toast.type === 'success'
                        ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#86EFAC]'
                        : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                }`}>
                    {toast.type === 'success'
                        ? <Check className="w-4 h-4 flex-shrink-0" />
                        : <X className="w-4 h-4 flex-shrink-0" />
                    }
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
