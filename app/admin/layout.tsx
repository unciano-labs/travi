'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, Bus, Map, 
  CreditCard, Star, Settings, LogOut, Menu, X 
} from 'lucide-react';
import { logoutAdmin } from '@/actions/auth';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Organizers', href: '/admin/organizers', icon: Users },
  { name: 'Transporters', href: '/admin/transporters', icon: Bus },
  { name: 'Tours', href: '/admin/tours', icon: Map },
  { name: 'Bookings', href: '/admin/bookings', icon: CreditCard },
  { name: 'Reviews', href: '/admin/reviews', icon: Star },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-brand-navy text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 bg-brand-navy border-b border-white/10">
          <span className="font-display font-bold text-xl text-white">
            TRAVI <span className="text-coral">Admin</span>
          </span>
          <button className="lg:hidden text-white/70 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive ? 'bg-sky-500/20 text-sky-300' : 'text-slate-300 hover:bg-white/5 hover:text-white'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-sky-300' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-white/10 bg-brand-navy">
          <form action={logoutAdmin}>
            <button type="submit" className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5 text-slate-400" />
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-700 focus:outline-none"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-700">Admin User</p>
                <p className="text-xs text-slate-500">Superadmin</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
