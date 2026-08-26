import { getCachedPlatformStats } from '@/lib/data/stats';
import StatsCounterClient from './StatsCounterClient';

export default async function StatsSection() {
  const stats = await getCachedPlatformStats();

  return (
    <section className="bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <StatsCounterClient
          travelersCount={stats.travelersCount}
          toursCount={stats.toursCount}
          organizersCount={stats.organizersCount}
          satisfactionRate={stats.satisfactionRate}
        />
      </div>
    </section>
  );
}
