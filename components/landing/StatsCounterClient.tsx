'use client';

import { useEffect, useState } from 'react';
import { useScrollReveal } from './useScrollReveal';

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const { ref, isRevealed } = useScrollReveal(0.6);

  useEffect(() => {
    if (isRevealed) {
      let start = 0;
      const duration = 1500;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isRevealed, target]);

  return (
    <p ref={ref as React.RefObject<HTMLParagraphElement>} className="text-3xl lg:text-4xl font-extrabold text-brand">
      {count}
      {suffix}
    </p>
  );
}

const GRID_COLS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' };

export default function StatsCounterClient({
  toursCount,
  organizersCount,
  reviewCount,
  satisfactionRate,
}: {
  toursCount: number;
  organizersCount: number;
  reviewCount: number;
  satisfactionRate: number | null;
}) {
  // Show only stats backed by data; hide the section entirely before launch-day data exists.
  const tiles = [
    { key: 'tours', value: toursCount, suffix: '', label: 'Tour Packages', show: toursCount > 0 },
    { key: 'organizers', value: organizersCount, suffix: '', label: 'Local Organizers', show: organizersCount > 0 },
    {
      key: 'satisfaction',
      value: satisfactionRate ?? 0,
      suffix: '%',
      label: `Positive Reviews (${reviewCount})`,
      show: satisfactionRate !== null,
    },
  ].filter((tile) => tile.show);

  if (tiles.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 ${GRID_COLS[tiles.length]} divide-x divide-slate-100`}>
      {tiles.map((tile) => (
        <div key={tile.key} className="py-8 px-6 text-center">
          <Counter target={tile.value} suffix={tile.suffix} />
          <p className="text-xs text-slate-500 mt-1 font-medium">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
