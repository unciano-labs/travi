'use client';

import dynamic from 'next/dynamic';

export const LazyMobileCard = dynamic(() => import('./GenericMobileCard'), { 
  ssr: false,
  loading: () => <div className="h-32 bg-slate-50 animate-pulse rounded-xl border border-slate-100" />
});
