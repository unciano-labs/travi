import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatTone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const TONES: Record<StatTone, { bg: string; text: string; icon: string }> = {
  primary: { bg: 'bg-lightprimary', text: 'text-primary', icon: 'bg-primary' },
  secondary: { bg: 'bg-lightsecondary', text: 'text-secondaryemphasis', icon: 'bg-secondary' },
  success: { bg: 'bg-lightsuccess', text: 'text-successemphasis', icon: 'bg-success' },
  warning: { bg: 'bg-lightwarning', text: 'text-warningemphasis', icon: 'bg-warning' },
  error: { bg: 'bg-lighterror', text: 'text-error', icon: 'bg-error' },
  info: { bg: 'bg-lightinfo', text: 'text-info', icon: 'bg-info' },
};

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: React.ReactNode;
  href?: string;
  className?: string;
}

// The template's TopCards tile: tinted card, centred icon, label, value.
export default function StatCard({ title, value, icon: Icon, tone = 'primary', hint, href, className }: StatCardProps) {
  const t = TONES[tone];
  const body = (
    <div className={cn('h-full rounded-lg p-6 text-center transition-transform duration-200', t.bg, href && 'hover:scale-[1.03]', className)}>
      <div className="mb-3 flex justify-center">
        <span className={cn('flex size-12 items-center justify-center rounded-full text-white', t.icon)}>
          <Icon className="size-6" aria-hidden="true" />
        </span>
      </div>
      <p className={cn('mb-1 font-semibold', t.text)}>{title}</p>
      <h5 className={cn('mb-0 text-xl font-semibold', t.text)}>{value}</h5>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      {body}
    </Link>
  ) : (
    body
  );
}
