import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  key: string;
  time: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
}

const RING: Record<NonNullable<TimelineItem['tone']>, string> = {
  primary: 'border-primary',
  secondary: 'border-secondary',
  success: 'border-success',
  warning: 'border-warning',
  error: 'border-error',
  info: 'border-info',
};

// The template's RecentTransaction timeline.
export default function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('mt-2', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.key} className="flex gap-x-3">
            <div className="w-1/4 shrink-0 text-end">
              <span className="text-xs font-medium text-foreground">{item.time}</span>
            </div>
            <div
              className={cn(
                'relative after:absolute after:bottom-0 after:start-3.5 after:top-7 after:w-px after:-translate-x-[0.5px] after:bg-border',
                isLast && 'after:hidden'
              )}
            >
              <div className="relative z-[1] flex size-7 items-center justify-center">
                <div className={cn('size-3 rounded-full border-2 bg-transparent', RING[item.tone ?? 'primary'])} />
              </div>
            </div>
            <div className="min-w-0 grow pb-6 pt-0.5">
              <p className="font-medium text-foreground">{item.title}</p>
              {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
