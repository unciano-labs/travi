'use client';

import { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type Schedule = {
  id: string;
  tour_id: string;
  start_date: string;
  end_date: string;
  capacity: number;
  booked_count: number;
  status: 'open' | 'full' | 'cancelled';
  price_per_person?: number;
  original_price?: number;
};

export default function SchedulesCalendar({ 
  schedules, 
  tourId 
}: { 
  schedules: Schedule[], 
  tourId: string 
}) {
  const router = useRouter();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<any>('month');

  // Map our database schedules to react-big-calendar events
  const events = schedules.map(s => {
    // We add 12 hours to avoid timezone shifting issues where a date becomes the day before
    const start = new Date(s.start_date);
    start.setHours(12, 0, 0, 0);
    
    const end = new Date(s.end_date);
    end.setHours(12, 0, 0, 0);

    return {
      id: s.id,
      title: `${s.booked_count}/${s.capacity} Booked`, // Fallback for views that don't support custom components well
      start,
      end,
      resource: s
    };
  });

  const EventComponent = ({ event }: any) => {
    const s = event.resource as Schedule;
    return (
      <div className="flex flex-col gap-0.5 leading-tight">
        {s.price_per_person && (
          <div className="flex items-center gap-1 font-bold">
            {s.original_price && <span className="text-[10px] text-slate-500 line-through font-normal">₱{s.original_price}</span>}
            <span className="flex items-center gap-0.5">
              <span className="text-[10px] opacity-80">₱</span>{s.price_per_person}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px]">
          <Users className="w-3 h-3" /> {s.booked_count}/{s.capacity}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[800px] bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative calendar-container">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Custom Tailwind Overrides for Big Calendar */
        .rbc-calendar { 
          font-family: inherit; 
          font-size: 0.8rem; /* Smaller font as requested */
        }
        .rbc-event {
          background-color: var(--color-coral, #ff6b6b);
          border-radius: 4px;
          border: none;
          padding: 2px 6px;
          font-weight: 600;
          font-size: 11px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .rbc-event.status-full {
          background-color: #d97706; /* amber-600 */
        }
        .rbc-event.status-cancelled {
          background-color: #dc2626; /* red-600 */
        }
        .rbc-event.is-past {
          background-color: #94a3b8; /* slate-400 */
          opacity: 0.8;
        }
        .rbc-today {
          background-color: #f8fafc; /* slate-50 */
        }
        .rbc-toolbar button {
          border-radius: 6px;
          border-color: #e2e8f0;
          color: #475569;
        }
        .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
          background-color: #f1f5f9;
          box-shadow: none;
          border-color: #cbd5e1;
        }
      `}} />
      
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={['month', 'week', 'agenda']}
        view={view}
        onView={(newView) => setView(newView)}
        date={date}
        onNavigate={(newDate) => setDate(newDate)}
        onSelectEvent={(event) => {
          router.push(`?tab=schedules&view=calendar&editScheduleId=${event.id}`);
        }}
        eventPropGetter={(event) => {
          const s = event.resource as Schedule;
          const isPast = event.end < new Date();
          let className = `status-${s.status}`;
          if (isPast) className += ' is-past';
          
          return {
            className,
          };
        }}
        components={{
          event: EventComponent
        }}
        tooltipAccessor={(event) => {
          const s = event.resource as Schedule;
          let priceStr = '';
          if (s.price_per_person) {
            priceStr = ` (Price: ₱${s.price_per_person}${s.original_price ? `, was ₱${s.original_price}` : ''})`;
          }
          return `${s.status.toUpperCase()} - ${s.booked_count} out of ${s.capacity} seats booked${priceStr}`;
        }}
      />
    </div>
  );
}
