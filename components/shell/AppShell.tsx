'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import AppSidebar, { type NavSection, type SidebarPromo } from '@/components/shell/AppSidebar';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface AppShellProps {
  sections: NavSection[];
  brandSuffix: string;
  homeHref: string;
  promo?: SidebarPromo;
  headerRight: React.ReactNode;
  children: React.ReactNode;
}

// Port of the template's FullLayout: fixed 270px sidebar on xl, sticky header, Sheet sidebar on mobile.
export default function AppShell({ sections, brandSuffix, homeHref, promo, headerRight, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsSticky(window.scrollY > 50);
    const onResize = () => {
      if (window.innerWidth >= 1280) setMobileOpen(false);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="tw-admin flex min-h-screen w-full">
      <div className="fixed inset-y-0 left-0 z-30 hidden xl:block">
        <AppSidebar sections={sections} brandSuffix={brandSuffix} homeHref={homeHref} promo={promo} />
      </div>

      <div className="flex w-full min-w-0 flex-col xl:ml-[270px]">
        <header className={cn('sticky top-0 z-20 transition-shadow', isSticky ? 'bg-white shadow-dashboard' : 'bg-white/80 backdrop-blur')}>
          <nav className="flex items-center justify-between px-4 py-4 sm:px-6" aria-label="Top bar">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-lightprimary hover:text-primary xl:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </button>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">{headerRight}</div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1400px] grow px-4 py-6 sm:px-6 lg:py-[30px]">{children}</main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[270px] max-w-[270px] p-0">
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden>
          <AppSidebar
            sections={sections}
            brandSuffix={brandSuffix}
            homeHref={homeHref}
            promo={promo}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
