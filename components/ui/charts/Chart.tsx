'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// ApexCharts touches window on import, so it is browser-only (AGENTS.md §3.5).
const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[150px] w-full" />,
});

export default Chart;
