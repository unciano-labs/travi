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
      title: s.status === 'cancelled' ? 'Cancelled' : `${s.booked_count}/${s.capacity} Booked`, // Fallback for views that don't support custom components well
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
            {s.original_price && <span className="text-[10px] opacity-70 line-through font-normal">₱{s.original_price}</span>}
            <span className="flex items-center gap-0.5">
              <span className="text-[10px] opacity-80">₱</span>{s.price_per_person}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px]">
          {s.status === 'cancelled' ? 'Cancelled' : <><Users className="w-3 h-3" aria-hidden="true" /> {s.booked_count}/{s.capacity}</>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[800px] bg-white rounded-lg relative calendar-container">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Theme overrides for Big Calendar (dashboard tokens from app/globals.css) */
        .rbc-calendar { 
          font-family: inherit; 
          font-size: 0.8rem; /* Smaller font as requested */
          color: var(--color-bodytext);
        }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view,
        .rbc-header, .rbc-month-row + .rbc-month-row, .rbc-day-bg + .rbc-day-bg,
        .rbc-agenda-view table.rbc-agenda-table, .rbc-agenda-view table.rbc-agenda-table tbody > tr > td + td,
        .rbc-agenda-view table.rbc-agenda-table tbody > tr + tr {
          border-color: var(--color-border);
        }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
          border-radius: 8px;
          overflow: hidden;
        }
        .rbc-header {
          padding: 8px 4px;
          font-weight: 600;
          color: var(--color-foreground);
        }
        .rbc-off-range-bg {
          background-color: var(--color-muted);
        }
        .rbc-toolbar .rbc-toolbar-label {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
        }
        .rbc-event {
          background-color: var(--color-primary);
          border-radius: 4px;
          border: none;
          padding: 2px 6px;
          font-weight: 600;
          font-size: 11px;
          box-shadow: none;
        }
        .rbc-event.rbc-selected {
          background-color: var(--color-primaryemphasis);
        }
        .rbc-event.status-full {
          background-color: var(--color-warning);
        }
        .rbc-event.status-cancelled {
          background-color: var(--color-error);
        }
        .rbc-event.is-past {
          background-color: var(--color-muted-foreground);
          opacity: 0.8;
        }
        .rbc-today {
          background-color: var(--color-lightprimary);
        }
        .rbc-toolbar button {
          border-radius: 6px;
          border-color: var(--color-border);
          color: var(--color-bodytext);
          font-weight: 500;
        }
        .rbc-toolbar button:hover, .rbc-toolbar button:focus {
          background-color: var(--color-lightprimary);
          border-color: var(--color-border);
          color: var(--color-primary);
        }
        .rbc-toolbar button:active, .rbc-toolbar button.rbc-active,
        .rbc-toolbar button.rbc-active:hover, .rbc-toolbar button.rbc-active:focus {
          background-color: var(--color-primary);
          box-shadow: none;
          border-color: var(--color-primary);
          color: var(--white);
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
          if (s.status === 'cancelled') return 'CANCELLED - travelers were refunded or canceled';
          return `${s.status.toUpperCase()} - ${s.booked_count} out of ${s.capacity} seats booked${priceStr}`;
        }}
      />
    </div>
  );
}
