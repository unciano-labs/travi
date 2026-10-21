'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Only highlight on an exact path match (use for section roots like /admin). */
  exact?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export interface SidebarPromo {
  title: string;
  cta: string;
  href: string;
}

interface AppSidebarProps {
  sections: NavSection[];
  brandSuffix: string;
  homeHref: string;
  promo?: SidebarPromo;
  onNavigate?: () => void;
}

function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  return !item.exact && pathname.startsWith(`${item.href}/`);
}

// Port of the template's vertical sidebar (logo, uppercase section headings, pill nav items, promo card).
export default function AppSidebar({ sections, brandSuffix, homeHref, promo, onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[270px] flex-col border-r border-border bg-sidebar" aria-label="Sidebar">
      <div className="flex h-[70px] shrink-0 items-center px-6">
        <Link href={homeHref} onClick={onNavigate} className="font-display text-2xl font-bold tracking-tight text-dark">
          travi<span className="text-primary">.</span>
          <span className="ml-1.5 align-middle font-dashboard text-xs font-semibold uppercase tracking-wider text-muted-foreground">{brandSuffix}</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-6 pb-6">
        {sections.map((section) => (
          <div key={section.heading} className="mb-2">
            <p className="mb-1 mt-6 text-xs font-bold uppercase leading-[21px] text-sidebar-foreground first:mt-2">{section.heading}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active ? 'bg-primary text-white shadow-sm' : 'text-sidebar-foreground hover:bg-lightprimary hover:text-primary'
                      )}
                    >
                      <Icon className="size-[21px] shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {promo && (
          <div className="mt-9 overflow-hidden">
            <div className="flex w-full rounded-lg bg-lightprimary p-6">
              <div className="w-1/2">
                <h5 className="text-base text-sidebar-foreground">{promo.title}</h5>
                <Link
                  href={promo.href}
                  onClick={onNavigate}
                  className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-medium whitespace-nowrap text-white hover:bg-primaryemphasis"
                >
                  {promo.cta}
                </Link>
              </div>
              <div className="-mt-4 ml-[26px] w-1/2 shrink-0 scale-[1.2]" aria-hidden="true">
                <Image src="/dashboard/rocket.png" alt="" width={90} height={110} />
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
