import { Calendar } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate, formatPHP } from '@/lib/format';

interface Booking {
  id: string;
  booking_ref: string;
  seats: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'canceled' | 'refunded' | 'completed';
  dispute_status?: string | null;
  created_at: string;
  traveler: {
    full_name: string | null;
    email: string;
  } | null;
  tour_schedule: {
    id: string;
    start_date: string;
    end_date: string;
    tour: {
      title: string;
      location: string;
    } | null;
  } | null;
}

interface BookingMobileCardProps {
  booking: Booking;
  onClick: () => void;
}

export default function BookingMobileCard({ booking, onClick }: BookingMobileCardProps) {
  return (
    <button
      type="button"
      className="block w-full text-left bg-white rounded-lg border border-border p-4 hover:border-primary/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={onClick}
      aria-label={`View booking ${booking.booking_ref}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-1 rounded inline-block">
          {booking.booking_ref}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={booking.status} />
          {booking.dispute_status && booking.dispute_status !== 'none' && (
            <StatusBadge
              status={booking.dispute_status === 'open' ? 'pending' : booking.dispute_status}
              label={`Dispute: ${booking.dispute_status.replaceAll('_', ' ')}`}
            />
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="font-semibold text-foreground line-clamp-1">
            {booking.tour_schedule?.tour?.title || 'Unknown Tour'}
          </div>
          <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            {formatDate(booking.tour_schedule?.start_date)}
          </div>
        </div>

        <div>
          <div className="font-medium text-bodytext text-sm">
            {booking.traveler?.full_name || 'No Name'}
          </div>
          <div className="text-muted-foreground text-xs">
            {booking.traveler?.email}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex justify-between items-center">
        <div className="text-sm">
          <span className="text-muted-foreground">Pax:</span>{' '}
          <span className="font-medium text-foreground">{booking.seats}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Total:</span>{' '}
          <span className="font-semibold text-success">{formatPHP(booking.total_amount)}</span>
        </div>
      </div>
    </button>
  );
}
