import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface WelcomeBannerProps {
  name: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

// The template's ProfileWelcome banner. Top of each role's dashboard home.
export default function WelcomeBanner({ name, subtitle, actions, className }: WelcomeBannerProps) {
  const initial = name.trim().charAt(0).toUpperCase() || 'T';
  return (
    <div className={cn('relative flex flex-col gap-4 overflow-hidden rounded-lg bg-lightsecondary p-6 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="relative z-10 flex items-center gap-3 sm:pr-44">
        <div className="flex size-[50px] shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
          {initial}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h5 className="card-title truncate">Welcome back, {name} 👋</h5>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="relative z-10 flex flex-wrap gap-2 sm:mr-44">{actions}</div>}
      <div className="pointer-events-none absolute bottom-0 right-8 hidden sm:block" aria-hidden="true">
        <Image src="/dashboard/customer-support-img.png" alt="" width={145} height={95} priority />
      </div>
    </div>
  );
}
