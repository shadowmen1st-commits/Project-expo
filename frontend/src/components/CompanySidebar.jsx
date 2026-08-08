import React from 'react';
import { 
    LayoutDashboard, 
    Building2, 
    FilePlus2, 
    Briefcase, 
    UserCheck, 
    Users, 
    GitMerge, 
    UserPlus, 
    Clock, 
    CreditCard, 
    Wallet, 
    BarChart3, 
    Bell, 
    Settings, 
    LogOut,
    ShieldCheck,
    Lock
} from 'lucide-react';

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'verification', label: 'KYC Verification', icon: ShieldCheck },
    { id: 'post-job', label: 'Post Job', icon: FilePlus2, locked: true },
    { id: 'jobs', label: 'My Jobs', icon: Briefcase, locked: true },
    { id: 'applications', label: 'Applications', icon: UserCheck, locked: true },
    { id: 'workers', label: 'Workers', icon: Users, locked: true },
    { id: 'teams', label: 'Teams', icon: GitMerge, locked: true },
    { id: 'assign', label: 'Assign Workers', icon: UserPlus, locked: true },
    { id: 'attendance', label: 'Attendance', icon: Clock, locked: true },
    { id: 'payments', label: 'Payments', icon: CreditCard, locked: true },
    { id: 'wallet', label: 'Wallet', icon: Wallet, locked: true },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, locked: true },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export default function CompanySidebar({ activeTab, setActiveTab, onLogout, companyName, verificationStatus, onLockedClick }) {
    const isVerified = verificationStatus === 'VERIFIED';

    return (
        <aside className="w-64 bg-white border-r border-[#FFF7D6] flex flex-col justify-between h-screen sticky top-0">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FBBF24] to-[#F97316] flex items-center justify-center shadow-sm">
                        <span className="text-[#171717] text-xl font-black">H</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight text-[#171717]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[#F97316] font-extrabold">COMPANY</span>
                    </div>
                </div>

                <div className="mb-4 px-3 py-2 bg-[#FFFCF5] rounded-xl border border-[#FFF7D6] flex justify-between items-center">
                    <div className="truncate pr-1">
                        <p className="text-[9px] text-[#78716C] uppercase font-bold">Organization</p>
                        <p className="text-xs font-bold text-[#171717] truncate">{companyName || 'Apex Events'}</p>
                    </div>
                    {isVerified && (
                        <span className="text-[8px] bg-green-50 text-green-700 font-extrabold px-1.5 py-0.5 rounded-full border border-green-200 flex-shrink-0">
                            ✓ Verified
                        </span>
                    )}
                </div>

                <nav className="space-y-1 overflow-y-auto max-h-[60vh] pr-2">
                    {MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isItemLocked = item.locked && !isVerified;

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (isItemLocked) {
                                        onLockedClick?.(item.label);
                                    } else {
                                        setActiveTab(item.id);
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-all cursor-pointer ${
                                    activeTab === item.id 
                                        ? 'bg-[#FFF7D6] text-[#F97316] font-bold border-l-4 border-[#F97316]' 
                                        : 'text-[#78716C] hover:bg-[#FFFCF5] hover:text-[#171717]'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${activeTab === item.id ? 'text-[#F97316]' : 'text-[#A8A29E]'}`} />
                                    <span>{item.label}</span>
                                </div>
                                {isItemLocked && (
                                    <Lock className="w-3.5 h-3.5 text-[#A8A29E]" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="p-6 border-t border-[#FFF7D6]">
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
