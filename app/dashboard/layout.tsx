'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Map, CreditCard, User, LogOut, Menu, X, 
  MapPin, Users, Bus, CalendarCheck, Calendar, Inbox, Star
} from 'lucide-react';
import { logoutUser } from '@/actions/auth';
import { NotificationBell } from '@/components/dashboard/NotificationBell';

import { RoleSwitcher } from '@/components/dashboard/RoleSwitcher';

const ROLE_NAV = {
  traveler: [
    { name: 'Dashboard', href: '/dashboard/traveler', icon: Map },
    { name: 'My Bookings', href: '/dashboard/traveler/bookings', icon: CreditCard },
    { name: 'Profile', href: '/dashboard/traveler/profile', icon: User },
  ],
  organizer: [
    { name: 'Dashboard', href: '/dashboard/organizer', icon: Map },
    { name: 'My Tours', href: '/dashboard/organizer/tours', icon: MapPin },
    { name: 'Bookings', href: '/dashboard/organizer/bookings', icon: Users },
    { name: 'Wallet', href: '/dashboard/organizer/wallet', icon: CreditCard },
    { name: 'Profile', href: '/dashboard/organizer/profile', icon: User },
  ],
  transporter: [
    { name: 'Dashboard', href: '/dashboard/transporter', icon: Map },
    { name: 'My Vehicles', href: '/dashboard/transporter/vehicles', icon: Bus },
    { name: 'Availability', href: '/dashboard/transporter/availability', icon: Calendar },
    { name: 'Requests', href: '/dashboard/transporter/requests', icon: Inbox },
    { name: 'Wallet', href: '/dashboard/transporter/wallet', icon: CreditCard },
    { name: 'Reviews', href: '/dashboard/transporter/reviews', icon: Star },
    { name: 'Profile', href: '/dashboard/transporter/profile', icon: User },
  ]
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Determine role based on pathname
  let currentRole = 'traveler';
  if (pathname.includes('/dashboard/organizer')) currentRole = 'organizer';
  if (pathname.includes('/dashboard/transporter')) currentRole = 'transporter';

  const navigation = ROLE_NAV[currentRole as keyof typeof ROLE_NAV];

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
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <Link href="/" className="font-display font-bold text-xl text-brand-navy">
            TRAVI <span className="text-coral">Panel</span>
          </Link>
          <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={() => setSidebarOpen(false)}>
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
                  ${isActive ? 'bg-coral/10 text-coral' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-coral' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-200 bg-white">
          <form action={logoutUser}>
            <button type="submit" className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
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
            <NotificationBell />
            <RoleSwitcher currentRole={currentRole} />
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
