'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CreditCard, User, MapPin, Users, Bus, Calendar, Inbox, Star, Wallet
} from 'lucide-react';
import AppShell from '@/components/shell/AppShell';
import type { NavSection } from '@/components/shell/AppSidebar';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { RoleSwitcher } from '@/components/dashboard/RoleSwitcher';

const ROLE_NAV: Record<'traveler' | 'organizer' | 'transporter', NavSection[]> = {
  traveler: [
    { heading: 'Home', items: [{ name: 'Dashboard', href: '/dashboard/traveler', icon: LayoutDashboard, exact: true }] },
    { heading: 'Trips', items: [{ name: 'My Bookings', href: '/dashboard/traveler/bookings', icon: CreditCard }] },
    { heading: 'Account', items: [{ name: 'Profile', href: '/dashboard/traveler/profile', icon: User }] },
  ],
  organizer: [
    { heading: 'Home', items: [{ name: 'Dashboard', href: '/dashboard/organizer', icon: LayoutDashboard, exact: true }] },
    {
      heading: 'Manage',
      items: [
        { name: 'My Tours', href: '/dashboard/organizer/tours', icon: MapPin },
        { name: 'Bookings', href: '/dashboard/organizer/bookings', icon: Users },
      ],
    },
    {
      heading: 'Account',
      items: [
        { name: 'Wallet', href: '/dashboard/organizer/wallet', icon: Wallet },
        { name: 'Profile', href: '/dashboard/organizer/profile', icon: User },
      ],
    },
  ],
  transporter: [
    { heading: 'Home', items: [{ name: 'Dashboard', href: '/dashboard/transporter', icon: LayoutDashboard, exact: true }] },
    {
      heading: 'Fleet',
      items: [
        { name: 'My Vehicles', href: '/dashboard/transporter/vehicles', icon: Bus },
        { name: 'Availability', href: '/dashboard/transporter/availability', icon: Calendar },
        { name: 'Requests', href: '/dashboard/transporter/requests', icon: Inbox },
        { name: 'Reviews', href: '/dashboard/transporter/reviews', icon: Star },
      ],
    },
    {
      heading: 'Account',
      items: [
        { name: 'Wallet', href: '/dashboard/transporter/wallet', icon: Wallet },
        { name: 'Profile', href: '/dashboard/transporter/profile', icon: User },
      ],
    },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine role based on pathname
  let currentRole: keyof typeof ROLE_NAV = 'traveler';
  if (pathname.includes('/dashboard/organizer')) currentRole = 'organizer';
  if (pathname.includes('/dashboard/transporter')) currentRole = 'transporter';

  return (
    <AppShell
      sections={ROLE_NAV[currentRole]}
      brandSuffix="Panel"
      homeHref={`/dashboard/${currentRole}`}
      promo={{ title: 'Find your next trip', cta: 'Browse Tours', href: '/' }}
      headerRight={
        <>
          <NotificationBell />
          <RoleSwitcher currentRole={currentRole} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
