import * as React from 'react';
import CardBox from '@/components/ui/CardBox';
import { Skeleton } from '@/components/ui/skeleton';

export function PageHeaderSkeleton({ breadcrumbs = 2, hasAction = true }: { breadcrumbs?: number; hasAction?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        {breadcrumbs > 0 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: breadcrumbs }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-16" />
            ))}
          </div>
        )}
      </div>
      {hasAction && <Skeleton className="h-10 w-32 rounded-md" />}
    </div>
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  const colClass = count === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-6`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <CardBox key={i} className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
            <Skeleton className="size-12 rounded-xl" />
          </div>
        </CardBox>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <CardBox className="p-0 overflow-hidden border-border" aria-hidden="true">
      <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-9 w-60 rounded-md" />
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-none">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className="h-4.5 w-24" />
            ))}
          </div>
        ))}
      </div>
    </CardBox>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6" aria-hidden="true">
      {/* Welcome Banner Skeleton */}
      <div className="col-span-12">
        <CardBox className="p-6 sm:p-8 flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="size-16 rounded-2xl hidden sm:block" />
        </CardBox>
      </div>

      {/* 3 Stat Cards */}
      <div className="col-span-12">
        <StatCardsSkeleton count={3} />
      </div>

      {/* Charts Section */}
      <div className="col-span-12 lg:col-span-8 flex">
        <CardBox className="p-6 w-full space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-60" />
          </div>
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardBox>
      </div>

      <div className="col-span-12 lg:col-span-4 flex">
        <CardBox className="p-6 w-full space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <div className="flex justify-center py-4">
            <Skeleton className="size-48 rounded-full" />
          </div>
        </CardBox>
      </div>

      {/* Table Section */}
      <div className="col-span-12">
        <TableSkeleton rows={4} columns={5} />
      </div>
    </div>
  );
}

export function FormPageSkeleton({ fieldCount = 4 }: { fieldCount?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <CardBox className="p-6 space-y-6 max-w-4xl">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 rounded-md" />
      </CardBox>
    </div>
  );
}

export function TourCardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <CardBox key={i} className="p-0 overflow-hidden">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </CardBox>
      ))}
    </div>
  );
}
