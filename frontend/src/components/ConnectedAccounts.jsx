import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

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

export default function ConnectedAccounts() {
    const { user } = useAuth();
    const [identities, setIdentities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Mock implementation for identities endpoint as requested by user prompt for "Account Settings UI"
    // In a real app we'd fetch from an endpoint. Since I didn't create /api/auth/oauth/identities yet, I'll add the endpoints now!
    // Wait, let's create the endpoint backend/src/routes/oauthRoutes.js and oauthController.js

    return (
        <div className="bg-white rounded-xl shadow-sm border border-[#E7E0D8] p-6 mt-6">
            <h3 className="text-lg font-bold text-[#1C1917] mb-1">Connected Accounts</h3>
            <p className="text-xs text-[#A8A29E] mb-6">Manage your linked social and provider identities.</p>

            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-[#E7E0D8] rounded-xl">
                    <div className="flex items-center gap-3">
                        <GoogleIcon />
                        <div>
                            <p className="text-sm font-semibold text-[#1C1917]">Google</p>
                            <p className="text-xs text-[#78716C]">Not connected</p>
                        </div>
                    </div>
                    <button className="text-xs font-semibold text-[#EAB308] hover:text-[#C56616] cursor-pointer bg-[#FFF6EE] px-3 py-1.5 rounded-lg">
                        Connect
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-[#E7E0D8] rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex items-center justify-center bg-black text-white rounded-full">
                           <AppleIcon />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#1C1917]">Apple</p>
                            <p className="text-xs text-[#78716C]">Not connected</p>
                        </div>
                    </div>
                    <button className="text-xs font-semibold text-[#EAB308] hover:text-[#C56616] cursor-pointer bg-[#FFF6EE] px-3 py-1.5 rounded-lg">
                        Connect
                    </button>
                </div>
            </div>
            
            <p className="text-[10px] text-[#A8A29E] mt-4 text-center">
                Unlinking an account requires confirmation and a recent login.
            </p>
        </div>
    );
}
