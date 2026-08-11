import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { CheckCircle2, Clock, AlertCircle, RefreshCw, Power, ArrowUpRight, Wallet, MapPin, Navigation, User } from 'lucide-react';
import { UserCategoryBanner } from '../components/UserCategoryBanner';
import WorkerReviewsPanel from '../components/WorkerReviewsPanel';
import Chat from '../components/chat/Chat';
import UserProfileModal from '../components/UserProfileModal';
import ProfileAvatar from '../components/ProfileAvatar';

export const WorkerDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [wallet, setWallet] = useState(null);
    const [payoutAccounts, setPayoutAccounts] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [chatBooking,setChatBooking]=useState(null);
    const [uploadedDocs, setUploadedDocs] = useState([]);

    useEffect(() => {
        fetchDashboardDetails();
    }, []);

    const fetchDashboardDetails = async () => {
        setLoading(true);
        try {
            const userId = user?.id || user?._id;
            if (userId) {
                try {
                    const resProf = await api.get('/v1/worker/verification');
                    if (resProf.data.success) {
                        setProfile(resProf.data.data.profile);
                        setUploadedDocs(resProf.data.data.uploadedDocuments || []);
                    }
                } catch (pErr) {
                    console.log('Worker profile draft initialized:', pErr);
                    setProfile({ verificationStatus: 'INCOMPLETE_PROFILE' });
                }
            }
            const resBook = await api.get('/v1/bookings/worker');
            if (resBook.data.success) {
                setBookings(resBook.data.bookings || []);
            }
            const resWall = await api.get('/wallet/details');
            if (resWall.data.success) {
                setWallet(resWall.data);
            }
            const [accountsRes, payoutsRes] = await Promise.all([api.get('/workers/payout-accounts'), api.get('/workers/payouts')]);
            setPayoutAccounts(accountsRes.data.data || []);
            setPayouts(payoutsRes.data.data || []);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleOnline = async () => {
        if (!profile) return;
        try {
            const targetState = !profile.isOnline;
            await api.post('/workers/location', {
                latitude: profile.location?.coordinates[1] || 12.9716,
                longitude: profile.location?.coordinates[0] || 77.5946,
            });
            setProfile({ ...profile, isOnline: targetState });
            setSuccess(`Status changed to ${targetState ? 'ONLINE' : 'OFFLINE'}.`);
        } catch (err) {
            setError('Failed to toggle online status.');
        }
    };

    const handleIntentionAction = async (bookingId, actionPath, payload = {}) => {
        setActionLoading(bookingId);
        setError('');
        setSuccess('');
        try {
            const res = await api.post(`/v1/bookings/${bookingId}/${actionPath}`, payload);
            if (res.data.success) {
                setSuccess(res.data.message || `Booking action ${actionPath} completed.`);
                fetchDashboardDetails();
            }
        } catch (err) {
            setError(err.response?.data?.message || `Failed to perform ${actionPath}.`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleWithdrawalRequest = async (e) => {
        e.preventDefault();
        const amountVal = Number(withdrawAmount);
        const amountPaise = Math.round(amountVal * 100);
        const payoutAccount = payoutAccounts.find((account) => account.isDefault) || payoutAccounts.find((account) => account.verificationStatus === 'VERIFIED');
        if (!Number.isFinite(amountVal) || amountVal <= 0 || amountPaise !== amountVal * 100) {
            setError('Please enter a valid amount.');
            return;
        }
        if (!payoutAccount) { setError('Add and verify a payout account before withdrawing.'); return; }
        try {
            setError('');
            const res = await api.post('/workers/payouts', {
                amountPaise,
                payoutAccountId: payoutAccount.id,
                preferredMode: 'IMPS',
                currency: 'INR',
            }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
            if (res.data.success) {
                setSuccess('Withdrawal request filed successfully.');
                setWithdrawAmount('');
                fetchDashboardDetails();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Withdrawal request failed.');
        }
    };

    const isWorkerApproved = profile?.verificationStatus === 'APPROVED';

    return (
        <div className="min-h-screen bg-[#FAF6F0] text-[#1C1917] font-sans">
            {/* Header */}
            <nav className="border-b border-[#E7E0D8] bg-[#FAF6F0]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl logo-gradient flex items-center justify-center font-black text-white text-base shadow-sm">
                        H
                    </div>
                    <span className="font-extrabold text-[#1C1917] text-xl tracking-tight">HyperLocal<span className="text-[#EAB308]">.</span></span>
                    <span className="bg-[#F0FDF4] text-[#16A34A] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-[#86EFAC]">
                        Worker Workspace
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    {profile && (
                        <button
                            onClick={handleToggleOnline}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${profile.isOnline ? 'bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A]' : 'bg-white border-[#E7E0D8] text-[#78716C]'}`}
                        >
                            <Power className="w-3.5 h-3.5"/>
                            {profile.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </button>
                    )}
                    <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="bg-white hover:bg-[#FEFCE8] text-[#D97706] border border-[#FEF3C7] px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 shadow-sm"
                    >
                        <ProfileAvatar user={user} size="xs" />
                        <span>Profile & Settings</span>
                    </button>
                    <button onClick={logout} className="bg-white hover:bg-[#FEFCE8] text-[#44403C] border border-[#E7E0D8] px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer">
                        Sign Out
                    </button>
                </div>
            </nav>

            <UserCategoryBanner />

            {/* Dashboard Container */}
            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black tracking-tight text-[#1C1917]">
                            Hello, {profile?.fullName || user?.name || 'Worker'}!
                        </h1>
                        <p className="text-xs text-[#78716C]">
                            Monitor your onboarding status, manage verified wallet earnings, and complete bookings.
                        </p>
                    </div>

                    {profile && (
                        <div className="p-6 rounded-3xl border border-[#E7E0D8] bg-white flex flex-col gap-6 shadow-sm">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                {profile.verificationStatus === 'APPROVED' ? (
                                    <CheckCircle2 className="w-8 h-8 text-[#16A34A] flex-shrink-0"/>
                                ) : ['PENDING_APPROVAL', 'UNDER_REVIEW'].includes(profile.verificationStatus) ? (
                                    <Clock className="w-8 h-8 text-[#D97706] flex-shrink-0 animate-pulse"/>
                                ) : (
                                    <AlertCircle className="w-8 h-8 text-[#DC2626] flex-shrink-0"/>
                                )}
                                <div className="flex-grow">
                                    <div className="font-extrabold text-[#1C1917] flex items-center gap-2">
                                        Verification Status: 
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                            profile.verificationStatus === 'APPROVED' ? 'bg-[#16A34A]/10 text-[#16A34A]' :
                                            ['PENDING_APPROVAL', 'UNDER_REVIEW'].includes(profile.verificationStatus) ? 'bg-[#D97706]/10 text-[#D97706]' : 'bg-[#DC2626]/10 text-[#DC2626]'
                                        }`}>
                                            {profile.verificationStatus}
                                        </span>
                                    </div>
                                    <div className="text-[#78716C] text-xs mt-1">
                                        {profile.verificationStatus === 'APPROVED' && 'Your profile is approved and active in local customer search listings.'}
                                        {profile.verificationStatus === 'PENDING_APPROVAL' && 'Your documents have been submitted and are pending admin review.'}
                                        {profile.verificationStatus === 'INCOMPLETE_PROFILE' && 'Please fill in your personal, professional, and required document details.'}
                                        {profile.verificationStatus === 'DRAFT' && 'Your onboarding progress is saved as draft. Click Complete Verification to submit.'}
                                        {profile.verificationStatus === 'CHANGES_REQUIRED' && `Action Required: Admin has requested corrections: ${profile.rejectionReason || 'Please audit uploaded documents.'}`}
                                        {profile.verificationStatus === 'REJECTED' && `Verification Rejected: ${profile.rejectionReason || 'Contact support for details.'}`}
                                        {profile.verificationStatus === 'SUSPENDED' && `Account Suspended: ${profile.suspensionReason || 'Please contact support immediately.'}`}
                                    </div>
                                </div>

                                <div className="text-xs text-[#78716C] min-w-[200px]">
                                    {payoutAccounts.length ? payoutAccounts.map((account) => <div key={account.id} className="font-mono text-[10px]">{account.accountType === 'VPA' ? account.vpaMasked : `Account •••• ${account.accountNumberLast4}`} · {account.verificationStatus}</div>) : 'No payout account configured.'}
                                    <div className="mt-1 text-[10px] text-[#A8A29E]">Withdrawal limits are verified by the server.</div>
                                </div>

                                <button data-testid="worker-verification-action" onClick={() => navigate('/worker/verification')} className="btn-primary-gradient text-xs font-bold py-2 px-4 rounded-xl cursor-pointer w-full md:w-auto text-center">
                                    {{INCOMPLETE_PROFILE:'Complete Verification',DRAFT:'Continue Verification',PENDING_APPROVAL:'View Submitted Verification',CHANGES_REQUIRED:'Update Documents & Resubmit',APPROVED:'View Verification',REJECTED:'View Rejection Details',SUSPENDED:'View Suspension Details'}[profile.verificationStatus] || 'View Verification'}
                                </button>
                            </div>

                            {/* Documents list */}
                            {uploadedDocs.length > 0 && (
                                <div className="pt-4 border-t border-[#E7E0D8]">
                                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#78716C] mb-2">Submitted Credentials & Document Status:</div>
                                    <div className="flex flex-wrap gap-3">
                                        {uploadedDocs.map((doc) => (
                                            <div key={doc.id || doc._id} className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl px-4 py-2 flex items-center justify-between gap-4 text-xs shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[#1C1917]">{doc.documentType}</span>
                                                    <span className="text-[10px] text-[#78716C]">Last 4: •••• {doc.documentNumberLast4}</span>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                                    doc.verificationStatus === 'APPROVED' ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#16A34A]' :
                                                    doc.verificationStatus === 'REJECTED' ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]' :
                                                    'bg-[#FEFCE8] border-[#FEF08A] text-[#EAB308]'
                                                }`}>
                                                    {doc.verificationStatus.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {success && (
                        <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] text-sm p-4 rounded-xl">
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-sm p-4 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[#1C1917]">Your Assigned Bookings</h2>
                            <button onClick={fetchDashboardDetails} className="text-[#EAB308] hover:underline flex items-center gap-1 text-xs cursor-pointer font-semibold">
                                <RefreshCw className="w-3.5 h-3.5"/> Refresh
                            </button>
                        </div>

                        {bookings.length === 0 ? (
                            <div className="bg-white border border-[#E7E0D8] rounded-3xl p-8 text-center text-[#78716C] text-sm shadow-sm">
                                No active service bookings assigned to you.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {bookings.map((booking) => (
                                    <div key={booking.id} className="bg-white border border-[#E7E0D8] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
                                        <div>
                                            <div className="flex items-center justify-between text-xs mb-3">
                                                <span className="font-mono text-[#78716C] font-semibold">{booking.bookingNumber}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${booking.bookingStatus === 'COMPLETED' ? 'bg-[#16A34A]/10 border-[#16A34A]/20 text-[#16A34A]' : booking.bookingStatus === 'CANCELLED' || booking.bookingStatus === 'REJECTED' ? 'bg-[#DC2626]/10 border-[#DC2626]/20 text-[#DC2626]' : 'bg-[#FEFCE8] border-[#FEF08A] text-[#EAB308]'}`}>
                                                    {booking.bookingStatus}
                                                </span>
                                            </div>

                                            <div className="text-xs space-y-1">
                                                <div className="font-bold text-[#1C1917]">Customer: {booking.customer?.name || 'Customer'}</div>
                                                <div className="text-[#78716C]">Category: {booking.category?.name || 'Service'}</div>
                                                <div className="text-[#78716C] flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-[#EAB308] flex-shrink-0"/>
                                                    <span>Address: {booking.serviceAddress}</span>
                                                </div>
                                                <div className="text-[#78716C]">Start: {new Date(booking.scheduledStart).toLocaleString()}</div>
                                                {booking.customerNotes && (
                                                    <div className="text-[11px] text-[#44403C] italic bg-[#FAF6F0] p-2 rounded-lg mt-1">
                                                        Notes: "{booking.customerNotes}"
                                                    </div>
                                                )}
                                                <div className="text-[11px] text-[#44403C] space-y-1 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E7E0D8] mt-2">
                                                    <div className="flex justify-between">
                                                        <span>Service Base Value:</span>
                                                        <span>₹{((booking.baseAmount || 0) / 100).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[#DC2626]">
                                                        <span>Platform Commission:</span>
                                                        <span>-₹{((booking.commissionAmount || 0) / 100).toFixed(2)} ({booking.commissionPercentage || 10}%)</span>
                                                    </div>
                                                    <div className="flex justify-between font-extrabold text-[#EAB308] text-xs pt-1 border-t border-[#E7E0D8]">
                                                        <span>Expected Net Earning:</span>
                                                        <span>₹{((booking.workerEarning || 0) / 100).toFixed(2)}</span>
                                                    </div>
                                                    <div className="text-[9px] text-[#78716C] italic pt-0.5">
                                                        *Expected earning — released only after verified payment and authorised completion.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Intention Action Buttons */}
                                        <div className="flex flex-col gap-2 pt-3 border-t border-[#E7E0D8]">
                                            {['ACCEPTED','CONFIRMED','WORKER_EN_ROUTE','STARTED','COMPLETION_REQUESTED','COMPLETED','DISPUTED'].includes(booking.bookingStatus)&&<button onClick={()=>setChatBooking(booking)} className="w-full bg-white border border-[#EAB308] text-[#EAB308] font-bold text-xs py-2 rounded-xl">Chat with customer</button>}
                                            {['PAYMENT_PENDING', 'PAID', 'REQUESTED'].includes(booking.bookingStatus) && (
                                                <div className="space-y-2">
                                                    {booking.paymentStatus !== 'PAID' && (
                                                        <div className="bg-[#FEFCE8] border border-[#FEF08A] text-[#EAB308] text-[10px] p-2 rounded-xl text-center font-bold">
                                                            Customer payment pending. Action disabled.
                                                        </div>
                                                    )}
                                                    {booking.paymentStatus === 'PAID' && (
                                                        <div className="bg-[#F0FDF4] border border-[#86EFAC] text-[#16A34A] text-[10px] p-2 rounded-xl text-center font-bold">
                                                            Payment verified. Available for action.
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleIntentionAction(booking.id, 'accept')}
                                                            disabled={!isWorkerApproved || booking.paymentStatus !== 'PAID' || actionLoading === booking.id}
                                                            className="w-1/2 btn-primary-gradient font-bold text-xs py-2 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Accept Request
                                                        </button>
                                                        <button
                                                            onClick={() => handleIntentionAction(booking.id, 'reject', { reason: 'Schedule conflict' })}
                                                            disabled={!isWorkerApproved || actionLoading === booking.id}
                                                            className="w-1/2 bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30 font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {['ACCEPTED', 'CONFIRMED'].includes(booking.bookingStatus) && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleIntentionAction(booking.id, 'en-route')}
                                                        disabled={!isWorkerApproved || actionLoading === booking.id}
                                                        className="w-1/2 bg-white border border-[#EAB308] text-[#EAB308] hover:bg-[#FEFCE8] font-bold text-xs py-2 rounded-xl cursor-pointer flex items-center justify-center gap-1"
                                                    >
                                                        <Navigation className="w-3.5 h-3.5"/> En Route
                                                    </button>
                                                    <button
                                                        onClick={() => handleIntentionAction(booking.id, 'start')}
                                                        disabled={!isWorkerApproved || actionLoading === booking.id}
                                                        className="w-1/2 btn-primary-gradient font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                    >
                                                        Start Job
                                                    </button>
                                                </div>
                                            )}

                                            {booking.bookingStatus === 'WORKER_EN_ROUTE' && (
                                                <button
                                                    onClick={() => handleIntentionAction(booking.id, 'start')}
                                                    disabled={!isWorkerApproved || actionLoading === booking.id}
                                                    className="w-full btn-primary-gradient font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                >
                                                    Start Job
                                                </button>
                                            )}

                                            {booking.bookingStatus === 'STARTED' && (
                                                <button
                                                    onClick={() => handleIntentionAction(booking.id, 'request-completion', { notes: 'Job completed by worker' })}
                                                    disabled={!isWorkerApproved || actionLoading === booking.id}
                                                    className="w-full btn-primary-gradient font-bold text-xs py-2 rounded-xl cursor-pointer"
                                                >
                                                    Request Job Completion
                                                </button>
                                            )}

                                            {booking.bookingStatus === 'COMPLETION_REQUESTED' && (
                                                <div className="bg-[#FEFCE8] border border-[#FEF08A] p-2 rounded-xl text-[10px] text-[#EAB308] text-center font-bold">
                                                    Awaiting Customer Confirmation
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Wallet Panel */}
                <div className="space-y-8">
                    {wallet && (
                        <div className="bg-white border border-[#E7E0D8] rounded-3xl p-6 space-y-5 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-[#FEFCE8] rounded-2xl text-[#EAB308] border border-[#FEF08A]">
                                    <Wallet className="w-6 h-6"/>
                                </div>
                                <div>
                                    <h3 className="text-[#78716C] text-xs font-semibold">Available Wallet Balance</h3>
                                    <span className="text-2xl font-black text-[#1C1917]">₹{(wallet.balances.available / 100).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E7E0D8]">
                                <div className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl p-3">
                                    <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Pending Escrow</span>
                                    <span className="text-sm font-bold text-[#D97706]">₹{(wallet.balances.pending / 100).toFixed(2)}</span>
                                </div>
                                <div className="bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl p-3">
                                    <span className="block text-[10px] text-[#A8A29E] font-semibold uppercase">Reserved Hold</span>
                                    <span className="text-sm font-bold text-[#EAB308]">₹{(wallet.balances.reserved / 100).toFixed(2)}</span>
                                </div>
                            </div>

                            {wallet.balances.available > 0 && (
                                <form onSubmit={handleWithdrawalRequest} className="space-y-3 pt-3 border-t border-[#E7E0D8]">
                                    <label className="block text-[10px] font-semibold text-[#44403C] uppercase tracking-wider">Request Payout Withdrawal</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="Amount to withdraw" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full bg-[#FAF6F0] border border-[#E7E0D8] rounded-xl py-2 px-3 text-[#1C1917] text-xs outline-none"/>
                                        <button type="submit" className="btn-primary-gradient font-bold text-xs py-2 px-4 rounded-xl cursor-pointer flex items-center gap-1">
                                            Withdraw <ArrowUpRight className="w-3.5 h-3.5"/>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                    <WorkerReviewsPanel />
                </div>
            </div>
            {chatBooking && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
                    <div className="w-full max-w-xl h-[70vh]">
                        <Chat
                            bookingId={chatBooking.id}
                            worker={chatBooking.customer}
                            participantName={chatBooking.customer?.name || 'Customer'}
                            onClose={() => setChatBooking(null)}
                        />
                    </div>
                </div>
            )}
            <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        </div>
    );
};

export default WorkerDashboard;
