'use client';

import dynamic from 'next/dynamic';

export const LazyMobileCard = dynamic(() => import('./GenericMobileCard'), { 
  ssr: false,
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg border border-border" />
});
