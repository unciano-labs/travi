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

export default function StatsCounterClient({
  travelersCount = 1200,
  toursCount = 85,
  organizersCount = 40,
  satisfactionRate = 98,
}: {
  travelersCount?: number;
  toursCount?: number;
  organizersCount?: number;
  satisfactionRate?: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
      <div className="py-8 px-6 text-center">
        <Counter target={travelersCount} suffix="+" />
        <p className="text-xs text-slate-500 mt-1 font-medium">Happy Travelers</p>
      </div>
      <div className="py-8 px-6 text-center">
        <Counter target={toursCount} suffix="+" />
        <p className="text-xs text-slate-500 mt-1 font-medium">Tour Packages</p>
      </div>
      <div className="py-8 px-6 text-center">
        <Counter target={organizersCount} suffix="+" />
        <p className="text-xs text-slate-500 mt-1 font-medium">Local Organizers</p>
      </div>
      <div className="py-8 px-6 text-center">
        <Counter target={satisfactionRate} suffix="%" />
        <p className="text-xs text-slate-500 mt-1 font-medium">Positive Reviews</p>
      </div>
    </div>
  );
}
