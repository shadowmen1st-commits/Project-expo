import React, { useState, useEffect } from 'react';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/>
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.62A10 10 0 0 0 12 22Z"/>
        <path fill="#FBBC05" d="M6.41 13.93A6.02 6.02 0 0 1 6.1 12c0-.67.11-1.32.31-1.93V7.45H3.07A10 10 0 0 0 2 12c0 1.64.39 3.19 1.07 4.55l3.34-2.62Z"/>
        <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.45l3.34 2.62C7.2 7.7 9.4 5.94 12 5.94Z"/>
    </svg>
);

const AppleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.79 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z"/>
    </svg>
);

export default function SocialAuthButtons({ mode = 'login', role = 'CUSTOMER', onError }) {
    const [providers, setProviders] = useState({ google: { enabled: false }, apple: { enabled: false } });
    const [isLoading, setIsLoading] = useState(true);
    const [isRedirecting, setIsRedirecting] = useState(false);
    
    // Fallback to empty string to avoid undefined if not provided
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

    useEffect(() => {
        let mounted = true;
        const checkProviders = async () => {
            try {
                const res = await fetch(`${apiUrl}/auth/oauth/providers`);
                if (res.ok) {
                    const data = await res.json();
                    if (mounted) setProviders(data);
                }
            } catch (err) {
                // Silently ignore if backend is down, buttons will just stay disabled
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        checkProviders();
        return () => { mounted = false; };
    }, [apiUrl]);

    const start = async (provider) => {
        if (!providers[provider]?.enabled) {
            onError?.(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is not configured yet.`);
            return;
        }
        
        setIsRedirecting(true);
        try {
            // e.g. /auth/oauth/google/start?mode=SIGNUP&role=CUSTOMER
            const startUrl = `${apiUrl}/auth/oauth/${provider}/start?mode=${mode.toUpperCase()}&role=${role.toUpperCase()}&redirect=/auth/oauth/callback`;
            const res = await fetch(startUrl);
            const data = await res.json();
            
            if (data.success && data.url) {
                window.location.assign(data.url);
            } else {
                setIsRedirecting(false);
                onError?.(data.message || 'Failed to initialize OAuth flow.');
            }
        } catch (err) {
            setIsRedirecting(false);
            onError?.('Failed to connect to the authentication server.');
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="relative flex items-center">
                    <div className="flex-grow border-t border-[#E7E0D8]"/>
                    <span className="mx-3 text-[10px] uppercase tracking-wider text-[#A8A29E]">checking providers...</span>
                    <div className="flex-grow border-t border-[#E7E0D8]"/>
                </div>
            </div>
        );
    }

    const hasAnyProvider = providers.google?.enabled || providers.apple?.enabled;
    if (!hasAnyProvider) return null; // Hide if nothing is enabled

    return (
        <div className="space-y-3">
            <div className="relative flex items-center">
                <div className="flex-grow border-t border-[#E7E0D8]"/>
                <span className="mx-3 text-[10px] uppercase tracking-wider text-[#A8A29E]">or continue with</span>
                <div className="flex-grow border-t border-[#E7E0D8]"/>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                {providers.google?.enabled && (
                    <button
                        type="button"
                        disabled={isRedirecting}
                        onClick={() => start('google')}
                        aria-label="Sign in with Google"
                        className={`flex items-center justify-center gap-2 border border-[#DCD4C8] bg-white hover:bg-[#FAF6F0] rounded-xl py-3 text-sm font-semibold transition-colors ${isRedirecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <GoogleIcon />
                        {isRedirecting ? 'Redirecting...' : 'Google'}
                    </button>
                )}
                
                {providers.apple?.enabled && (
                    <button
                        type="button"
                        disabled={isRedirecting}
                        onClick={() => start('apple')}
                        aria-label="Sign in with Apple"
                        className={`flex items-center justify-center gap-2 border border-[#1C1917] bg-[#1C1917] hover:bg-black text-white rounded-xl py-3 text-sm font-semibold transition-colors ${isRedirecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <AppleIcon />
                        {isRedirecting ? 'Redirecting...' : 'Apple'}
                    </button>
                )}
            </div>
            <p className="text-[10px] text-center text-[#A8A29E]">Secure sign-in redirects to the selected identity provider.</p>
        </div>
    );
}
