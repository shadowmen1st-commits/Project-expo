import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import ServicesPage from './pages/ServicesPage';
import HowItWorksPage from './pages/HowItWorksPage';
import ForWorkersPage from './pages/ForWorkersPage';
import Login from './pages/Login';
import Register from './pages/Register';
import { CustomerHome } from './pages/CustomerHome';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerOnboarding from './pages/WorkerOnboarding';
import AdminDashboard from './pages/AdminDashboard';
import OAuthCallback from './pages/OAuthCallback';
import SupportPortal from './pages/SupportPortal';
import WorkerVerificationPage from './pages/WorkerVerificationPage';
import AdminWorkerVerificationsPage from './pages/AdminWorkerVerificationsPage';
import CompanyDashboard from './pages/CompanyDashboard';
import CompanyRegister from './pages/CompanyRegister';
import CompanyVerification from './pages/CompanyVerification';
import AdminCompanyVerification from './pages/AdminCompanyVerification';
import LiveTrackingPage from './pages/LiveTrackingPage';
import { XCircle } from 'lucide-react';

/* ─── Route guard ─── */
const ProtectedRoute = ({ children, allowedRoles, }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (<div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center animate-pulse">
            <span className="text-white font-black text-sm">H</span>
          </div>
          <span className="text-slate-400 text-sm font-medium">Loading session…</span>
        </div>
      </div>);
    }
    if (!user)
        return <Navigate to="/login" replace/>;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')
            return <Navigate to="/admin" replace/>;
        if (user.role === 'WORKER')
            return <Navigate to="/worker" replace/>;
        if (user.role === 'COMPANY')
            return <Navigate to="/company" replace/>;
        return <Navigate to="/dashboard" replace/>;
    }
    return <>{children}</>;
};

const CompanyRouteGuard = ({ children, isVerificationPage = false }) => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (user.role !== 'COMPANY') {
        return <Navigate to="/" replace />;
    }
    if (user.status === 'SUSPENDED') {
        return <Navigate to="/company/suspended" replace />;
    }
    return <>{children}</>;
};

function CompanySuspended() {
    return (
        <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center p-8 text-[#171717] font-sans">
            <div className="max-w-md w-full bg-white border border-red-100 rounded-3xl p-8 shadow-sm text-center space-y-6">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <XCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black">Account Suspended</h1>
                <p className="text-sm text-[#78716C]">
                    Your company account has been suspended by the administrator. Please contact our support team to resolve this issue.
                </p>
                <button 
                    onClick={() => window.location.href = '/support'}
                    className="w-full bg-[#F97316] hover:bg-orange-600 text-white font-bold py-3 rounded-xl cursor-pointer"
                >
                    Contact Support
                </button>
            </div>
        </div>
    );
}

/* ─── Routes ─── */
function AppRoutes() {
    return (<Routes>
      {/* ── Public ── */}
      <Route path="/" element={<LandingPage />}/>
      <Route path="/services" element={<ServicesPage />}/>
      <Route path="/how-it-works" element={<HowItWorksPage />}/>
      <Route path="/for-workers" element={<ForWorkersPage />}/>
      <Route path="/pricing" element={<PricingPage />}/>
      <Route path="/login" element={<Login />}/>
      <Route path="/register" element={<Register />}/>
      <Route path="/register/company" element={<CompanyRegister />}/>
      <Route path="/auth/oauth/callback" element={<OAuthCallback />}/>

      {/* ── Customer Dashboard & Tracking ── */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerHome />
          </ProtectedRoute>}/>
      <Route path="/booking/:id/tracking" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'WORKER', 'COMPANY', 'ADMIN', 'SUPER_ADMIN']}>
            <LiveTrackingPage />
          </ProtectedRoute>}/>

      {/* ── Worker Portal ── */}
      <Route path="/worker" element={<ProtectedRoute allowedRoles={['WORKER', 'COMPANY']}>
            <WorkerDashboard />
          </ProtectedRoute>}/>
      <Route path="/worker/verification" element={<ProtectedRoute allowedRoles={['WORKER', 'COMPANY']}><WorkerVerificationPage /></ProtectedRoute>}/>
      <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['WORKER', 'COMPANY']}>
            <WorkerOnboarding />
          </ProtectedRoute>}/>

      {/* ── Support Portal ── */}
      <Route path="/support" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'WORKER', 'COMPANY']}>
            <SupportPortal />
          </ProtectedRoute>}/>

      {/* ── Company Portal ── */}
      <Route path="/company" element={<CompanyRouteGuard><CompanyDashboard /></CompanyRouteGuard>}/>
      <Route path="/company/verification" element={<CompanyRouteGuard isVerificationPage={true}><CompanyVerification /></CompanyRouteGuard>}/>
      <Route path="/company/suspended" element={<CompanySuspended />} />

      <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>}/>
      <Route path="/admin/worker-verifications" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminWorkerVerificationsPage /></ProtectedRoute>}/>
      <Route path="/admin/companies/:id/verification" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}><AdminCompanyVerification /></ProtectedRoute>}/>

      {/* ── Catch-all ── */}
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>);
}
export function App() {
    return (<AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>);
}

function AppContent() {
    const navigate = useNavigate();

    useEffect(() => {
        const backHandler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                if (window.confirm("Do you want to exit the app?")) {
                    CapacitorApp.exitApp();
                }
            }
        });

        return () => {
            backHandler.then(h => h.remove());
        };
    }, []);

    return <AppRoutes />;
}
export default App;
