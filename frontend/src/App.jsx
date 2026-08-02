import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
        return <Navigate to="/dashboard" replace/>;
    }
    return <>{children}</>;
};
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
      <Route path="/auth/oauth/callback" element={<OAuthCallback />}/>

      {/* ── Customer Dashboard ── */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerHome />
          </ProtectedRoute>}/>

      {/* ── Worker Portal ── */}
      <Route path="/worker" element={<ProtectedRoute allowedRoles={['WORKER']}>
            <WorkerDashboard />
          </ProtectedRoute>}/>
      <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['WORKER']}>
            <WorkerOnboarding />
          </ProtectedRoute>}/>

      {/* ── Support Portal ── */}
      <Route path="/support" element={<ProtectedRoute allowedRoles={['CUSTOMER', 'WORKER']}>
            <SupportPortal />
          </ProtectedRoute>}/>

      {/* ── Admin Panel ── */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>}/>

      {/* ── Catch-all ── */}
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>);
}
export function App() {
    return (<AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>);
}
export default App;
