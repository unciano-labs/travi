'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Bus, Map, CreditCard, Star, Settings, Banknote, Bell
} from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import type { NavSection } from '@/components/shell/AppSidebar';
import AdminNotificationBell from '@/components/admin/AdminNotificationBell';
import AdminProfileMenu from '@/components/admin/AdminProfileMenu';

const sections: NavSection[] = [
  { heading: 'Home', items: [{ name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true }] },
  {
    heading: 'Partners',
    items: [
      { name: 'Organizers', href: '/admin/organizers', icon: Users },
      { name: 'Transporters', href: '/admin/transporters', icon: Bus },
    ],
  },
  {
    heading: 'Marketplace',
    items: [
      { name: 'Tours', href: '/admin/tours', icon: Map },
      { name: 'Bookings', href: '/admin/bookings', icon: CreditCard },
      { name: 'Reviews', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    heading: 'Finance',
    items: [{ name: 'Payouts', href: '/admin/payouts', icon: Banknote }],
  },
  {
    heading: 'System',
    items: [
      { name: 'Notifications', href: '/admin/notifications', icon: Bell },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AppShell
      sections={sections}
      brandSuffix="Admin"
      homeHref="/admin"
      promo={{ title: 'Platform fees & escrow', cta: 'Settings', href: '/admin/settings' }}
      headerRight={
        <>
          <AdminNotificationBell />
          <AdminProfileMenu />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
