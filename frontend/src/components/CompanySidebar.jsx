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
    ShieldCheck
} from 'lucide-react';

const MENU_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'verification', label: 'KYC Verification', icon: ShieldCheck },
    { id: 'post-job', label: 'Post Job', icon: FilePlus2 },
    { id: 'jobs', label: 'My Jobs', icon: Briefcase },
    { id: 'applications', label: 'Applications', icon: UserCheck },
    { id: 'workers', label: 'Workers', icon: Users },
    { id: 'teams', label: 'Teams', icon: GitMerge },
    { id: 'assign', label: 'Assign Workers', icon: UserPlus },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export default function CompanySidebar({ activeTab, setActiveTab, onLogout, companyName }) {
    return (
        <aside className="w-64 bg-white border-r border-[#FEF3C7] flex flex-col justify-between h-screen sticky top-0">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl logo-gradient flex items-center justify-center shadow-md">
                        <span className="text-[#111827] text-xl font-black">H</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight text-[#111827]">
                            HyperLocal<span className="text-[#F97316]">.</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-[#F97316] font-extrabold">COMPANY</span>
                    </div>
                </div>

                <div className="mb-4 px-2 py-1 bg-[#FFFBEB] rounded-lg border border-[#FEF3C7]">
                    <p className="text-[10px] text-[#9CA3AF] uppercase font-semibold">Logged in as</p>
                    <p className="text-xs font-bold text-[#111827] truncate">{companyName || 'Apex Events'}</p>
                </div>

                <nav className="space-y-1 overflow-y-auto max-h-[60vh] pr-2">
                    {MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-all cursor-pointer ${
                                    activeTab === item.id 
                                        ? 'bg-[#FFEDD5] text-[#F97316] font-bold border-l-4 border-[#F97316]' 
                                        : 'text-[#4B5563] hover:bg-[#FFFBEB] hover:text-[#111827]'
                                }`}
                            >
                                <Icon className={`w-4 h-4 ${activeTab === item.id ? 'text-[#F97316]' : 'text-[#9CA3AF]'}`} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="p-6 border-t border-[#FEF3C7]">
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer"
                >
                    <LogOut className="w-4 h-4 text-[#DC2626]" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
