import React, { useState, useEffect } from 'react';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/>
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.62A10 10 0 0 0 12 22Z"/>
        <path fill="#FBBC05" d="M6.41 13.93A6.02 6.02 0 0 1 6.1 12c0-.67.11-1.32.31-1.93V7.45H3.07A10 10 0 0 0 2 12c0 1.64.39 3.19 1.07 4.55l3.34-2.62Z"/>
        <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.93 5.45l3.34 2.62C7.2 7.7 9.4 5.94 12 5.94Z"/>
    </svg>
);

const AppleIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 fill-current" aria-hidden="true">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.79 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z"/>
    </svg>
);

const LockIcon = () => (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0" aria-hidden="true">
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd"/>
    </svg>
);

export default function SocialAuthButtons({ mode = 'login', role = 'CUSTOMER', onError }) {
    const [providers, setProviders] = useState({ google: { enabled: false }, apple: { enabled: false } });
    const [isLoading, setIsLoading] = useState(true);
    const [isRedirecting, setIsRedirecting] = useState(null); // 'google' | 'apple' | null
    const [tooltip, setTooltip] = useState(null); // 'google' | 'apple' | null

    const baseApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
    const apiUrl = baseApiUrl.endsWith('/api') ? baseApiUrl : `${baseApiUrl}/api`;
    const isDev = import.meta.env.DEV;

    useEffect(() => {
        let mounted = true;
        const checkProviders = async () => {
            try {
                const res = await fetch(`${apiUrl}/auth/oauth/providers`);
                if (res.ok) {
                    const data = await res.json();
                    if (mounted) setProviders(data);
                }
            } catch {
                // Backend down — show unconfigured state
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        checkProviders();
        return () => { mounted = false; };
    }, [apiUrl]);

    const start = async (provider) => {
        if (!providers[provider]?.enabled) {
            // Show config tooltip instead of calling onError (which might confuse users)
            setTooltip(prev => prev === provider ? null : provider);
            return;
        }
        setIsRedirecting(provider);
        setTooltip(null);
        try {
            const startUrl = `${apiUrl}/auth/oauth/${provider}/start?mode=${mode.toUpperCase()}&role=${role.toUpperCase()}&redirect=/auth/oauth/callback`;
            const res = await fetch(startUrl);
            const data = await res.json();
            if (data.success && data.url) {
                window.location.assign(data.url);
            } else {
                setIsRedirecting(null);
                onError?.(data.message || 'Failed to initialize OAuth flow.');
            }
        } catch {
            setIsRedirecting(null);
            onError?.('Failed to connect to the authentication server.');
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="relative flex items-center">
                    <div className="flex-grow border-t border-[#E7E0D8]"/>
                    <span className="mx-3 text-[10px] uppercase tracking-wider text-[#A8A29E]">or continue with</span>
                    <div className="flex-grow border-t border-[#E7E0D8]"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {['Google', 'Apple'].map(p => (
                        <div key={p} className="h-12 bg-[#F5F0E8] rounded-xl animate-pulse"/>
                    ))}
                </div>
            </div>
        );
    }

    const googleEnabled = providers.google?.enabled;
    const appleEnabled  = providers.apple?.enabled;

    return (
        <div className="space-y-3">
            {/* Divider */}
            <div className="relative flex items-center">
                <div className="flex-grow border-t border-[#E7E0D8]"/>
                <span className="mx-3 text-[10px] uppercase tracking-wider text-[#A8A29E]">or continue with</span>
                <div className="flex-grow border-t border-[#E7E0D8]"/>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3">
                {/* Google Button */}
                <div className="relative">
                    <button
                        type="button"
                        disabled={isRedirecting !== null}
                        onClick={() => start('google')}
                        aria-label="Sign in with Google"
                        title={googleEnabled ? 'Continue with Google' : 'Google login — credentials not configured'}
                        className={`
                            w-full flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-semibold
                            transition-all duration-200 relative
                            ${googleEnabled
                                ? 'border-[#DCD4C8] bg-white hover:bg-[#FAF6F0] hover:border-[#EAB308] text-[#1C1917] shadow-sm hover:shadow-md'
                                : 'border-[#E7E0D8] bg-[#FAFAFA] text-[#A8A29E] cursor-not-allowed'
                            }
                            ${isRedirecting === 'google' ? 'opacity-70 cursor-wait' : ''}
                            ${isRedirecting !== null && isRedirecting !== 'google' ? 'opacity-40' : ''}
                        `}
                    >
                        <GoogleIcon/>
                        <span>{isRedirecting === 'google' ? 'Redirecting…' : 'Google'}</span>
                        {!googleEnabled && <LockIcon/>}
                    </button>

                    {/* Tooltip for unconfigured Google */}
                    {tooltip === 'google' && !googleEnabled && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-[#1C1917] text-white text-[10px] leading-relaxed rounded-xl p-3 shadow-xl">
                            <p className="font-bold mb-1">🔐 Google OAuth — Not Configured</p>
                            <p className="text-[#DCD4C8]">To enable Google login, set these in <code className="text-[#FEF08A]">backend/.env</code>:</p>
                            <ul className="mt-1.5 space-y-0.5 text-[#FEF08A] font-mono">
                                <li>GOOGLE_OAUTH_ENABLED=true</li>
                                <li>GOOGLE_CLIENT_ID=…</li>
                                <li>GOOGLE_CLIENT_SECRET=…</li>
                            </ul>
                            <p className="text-[#A8A29E] mt-2">Get credentials at <span className="text-[#93C5FD]">console.cloud.google.com</span></p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C1917]"/>
                        </div>
                    )}
                </div>

                {/* Apple Button */}
                <div className="relative">
                    <button
                        type="button"
                        disabled={isRedirecting !== null}
                        onClick={() => start('apple')}
                        aria-label="Sign in with Apple"
                        title={appleEnabled ? 'Continue with Apple' : 'Apple login — credentials not configured'}
                        className={`
                            w-full flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-semibold
                            transition-all duration-200
                            ${appleEnabled
                                ? 'border-[#1C1917] bg-[#1C1917] hover:bg-black text-white shadow-sm hover:shadow-md'
                                : 'border-[#E7E0D8] bg-[#FAFAFA] text-[#A8A29E] cursor-not-allowed'
                            }
                            ${isRedirecting === 'apple' ? 'opacity-70 cursor-wait' : ''}
                            ${isRedirecting !== null && isRedirecting !== 'apple' ? 'opacity-40' : ''}
                        `}
                    >
                        <AppleIcon/>
                        <span>{isRedirecting === 'apple' ? 'Redirecting…' : 'Apple'}</span>
                        {!appleEnabled && <LockIcon/>}
                    </button>

                    {/* Tooltip for unconfigured Apple */}
                    {tooltip === 'apple' && !appleEnabled && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-[#1C1917] text-white text-[10px] leading-relaxed rounded-xl p-3 shadow-xl">
                            <p className="font-bold mb-1">🍎 Apple OAuth — Not Configured</p>
                            <p className="text-[#DCD4C8]">To enable Apple login, set these in <code className="text-[#FEF08A]">backend/.env</code>:</p>
                            <ul className="mt-1.5 space-y-0.5 text-[#FEF08A] font-mono">
                                <li>APPLE_OAUTH_ENABLED=true</li>
                                <li>APPLE_CLIENT_ID=…</li>
                                <li>APPLE_TEAM_ID=…</li>
                                <li>APPLE_KEY_ID=…</li>
                                <li>APPLE_PRIVATE_KEY=…</li>
                            </ul>
                            <p className="text-[#A8A29E] mt-2">Get credentials at <span className="text-[#93C5FD]">developer.apple.com</span></p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C1917]"/>
                        </div>
                    )}
                </div>
            </div>

            {/* Status hint */}
            {(!googleEnabled || !appleEnabled) && (
                <p className="text-[10px] text-center text-[#A8A29E]">
                    {googleEnabled || appleEnabled
                        ? 'Some providers are not yet configured. Click a greyed button for setup instructions.'
                        : isDev
                            ? '🔒 Social login visible but requires OAuth credentials. Click any button for setup guide.'
                            : 'Social login requires OAuth configuration.'
                    }
                </p>
            )}

            {/* Close tooltip on outside click */}
            {tooltip && (
                <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)}/>
            )}
        </div>
    );
}
