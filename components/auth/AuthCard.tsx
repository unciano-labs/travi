import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Shared template-themed frame for /login, /signup and /auth/* pages.
export default function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="tw-admin relative min-h-screen overflow-hidden bg-lightprimary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex min-h-full items-center justify-center">
        <CardBox className={cn('w-full border-none shadow-dashboard md:w-[450px] p-6 sm:p-8', className)}>
          <div className="text-center mb-6">
            <Link
              href="/"
              className="inline-block font-display text-3xl font-bold tracking-tight text-dark hover:opacity-90 transition-opacity"
            >
              travi<span className="text-primary">.</span>
            </Link>
            <h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>

          {children}
        </CardBox>
      </div>
    </div>
  );
}

export const AUTH_INPUT_CLASS =
  'flex h-10 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary transition-colors';

export const AUTH_BUTTON_CLASS =
  'inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primaryemphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

export function AuthNotice({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const variantMap = {
    error: 'lighterror' as const,
    info: 'lightinfo' as const,
    success: 'lightsuccess' as const,
  };
  const iconMap = {
    error: AlertCircle,
    info: Info,
    success: CheckCircle2,
  };
  const Icon = iconMap[tone];

  return (
    <Alert variant={variantMap[tone]} className="mb-6">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <AlertDescription className="text-left text-sm leading-relaxed">{children}</AlertDescription>
    </Alert>
  );
}
