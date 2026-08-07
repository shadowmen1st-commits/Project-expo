import React from 'react';
import { useAuth } from '../context/AuthContext';

export const UserCategoryBanner = () => {
    const { user } = useAuth();
    if (!user) return null;

    const roleStyles = {
        CUSTOMER: {
            bg: 'bg-[#FEFCE8]',
            text: 'text-[#EAB308]',
            border: 'border-[#FEF08A]',
            label: 'Customer Mode',
            message: 'You are viewing the app as a Customer. Book local services easily.',
        },
        WORKER: {
            bg: 'bg-[#F0FDF4]',
            text: 'text-[#16A34A]',
            border: 'border-[#86EFAC]',
            label: 'Worker Mode',
            message: 'You are viewing the app as a Worker. Manage your bookings and earnings.',
        },
        ADMIN: {
            bg: 'bg-[#FEF2F2]',
            text: 'text-[#DC2626]',
            border: 'border-[#FCA5A5]',
            label: 'Admin Mode',
            message: 'You have Administrator privileges. Manage platform settings.',
        },
        SUPER_ADMIN: {
            bg: 'bg-[#FEF2F2]',
            text: 'text-[#DC2626]',
            border: 'border-[#FCA5A5]',
            label: 'Super Admin Mode',
            message: 'You have Super Administrator privileges.',
        }
    };

    const style = roleStyles[user.role] || roleStyles.CUSTOMER;

    return (
        <div className={`w-full px-6 py-2 border-b flex items-center justify-between shadow-sm z-30 ${style.bg} ${style.border}`}>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}>
                    {style.label}
                </span>
                <span className="text-xs text-[#44403C] font-medium">
                    {style.message}
                </span>
            </div>
            <div className="hidden sm:block">
                <span className={`text-xs font-semibold ${style.text}`}>
                    {user.name}
                </span>
            </div>
        </div>
    );
};
