import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CardBox from '@/components/ui/CardBox';
import { cn } from '@/lib/utils';

export interface BreadcrumbEntry {
  title: string;
  href?: string;
}

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  actions?: React.ReactNode;
  className?: string;
}

// The template's breadcrumb banner (BreadcrumbComp). Use at the top of every dashboard page.
export default function PageHeader({ title, description, breadcrumbs = [], actions, className }: PageHeaderProps) {
  return (
    <CardBox className={cn('relative mb-6 gap-0 overflow-hidden rounded-md border-none bg-lightsecondary py-5', className)}>
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:pr-40">
        <div className="min-w-0">
          <h1 className="mb-2 text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="mb-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-y-1">
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <li key={`${item.title}-${index}`} className="flex items-center">
                      {item.href && !isLast ? (
                        <Link href={item.href} className="text-sm leading-none text-muted-foreground hover:text-primary hover:underline">
                          {item.title}
                        </Link>
                      ) : (
                        <span className="text-sm leading-none text-muted-foreground" aria-current={isLast ? 'page' : undefined}>
                          {item.title}
                        </span>
                      )}
                      {!isLast && <span className="mx-2.5 rounded-full bg-muted-foreground p-0.5" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="pointer-events-none absolute bottom-0 right-7 hidden sm:block" aria-hidden="true">
        <Image src="/dashboard/customer-support-img.png" alt="" width={145} height={95} />
      </div>
    </CardBox>
  );
}
