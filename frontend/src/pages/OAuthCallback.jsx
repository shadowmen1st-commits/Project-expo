import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { restoreSession, fetchUser } = useAuth();
    const [status, setStatus] = useState('Processing authentication...');

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(location.search);
            const oauthStatus = params.get('oauth');
            const errorCode = params.get('errorCode');
            const token = params.get('token');

            if (oauthStatus === 'success') {
                setStatus('Authentication successful. Redirecting...');
                try {
                    if (token) {
                        localStorage.setItem('accessToken', token);
                    }
                    // Update auth context with new session
                    const getUser = restoreSession || fetchUser;
                    const user = await getUser();
                    
                    // Clear the query params securely from browser history
                    window.history.replaceState({}, document.title, window.location.pathname);

                    if (user?.role === 'CUSTOMER') {
                        navigate('/dashboard', { replace: true });
                    } else if (user?.role === 'WORKER') {
                        if (user?.status === 'ACTIVE') {
                            navigate('/worker', { replace: true });
                        } else {
                            navigate('/onboarding', { replace: true });
                        }
                    } else if (user?.role === 'COMPANY') {
                        navigate('/company', { replace: true });
                    } else if (['ADMIN', 'SUPER_ADMIN'].includes(user?.role)) {
                        navigate('/admin', { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                } catch (error) {
                    console.error('Failed to restore session after OAuth', error);
                    setStatus('Session error. Please try logging in again.');
                    setTimeout(() => navigate('/login', { replace: true }), 2000);
                }
            } else if (oauthStatus === 'failed' || oauthStatus === 'access_denied') {
                setStatus(`Authentication failed: ${errorCode || 'Unknown error'}`);
                setTimeout(() => navigate('/login', { replace: true }), 3000);
            } else {
                setStatus('Invalid callback state.');
                setTimeout(() => navigate('/login', { replace: true }), 3000);
            }
        };

        handleCallback();
    }, [location.search, navigate, restoreSession, fetchUser]);

    return (
        <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-[#E7E0D8] max-w-sm w-full text-center">
                <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-xl font-bold text-[#1C1917] mb-2">Please wait</h2>
                <p className="text-sm text-[#A8A29E]">{status}</p>
            </div>
        </div>
    );
}
