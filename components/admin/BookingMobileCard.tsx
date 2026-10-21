import { Calendar } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

interface Booking {
  id: string;
  booking_ref: string;
  seats: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'canceled' | 'refunded' | 'completed';
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
  getStatusColor: (status: Booking['status']) => string;
}

// `getStatusColor` stays in the props contract; the badge colour now comes from the shared StatusBadge.
export default function BookingMobileCard({ booking, onClick }: BookingMobileCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-border p-4 hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-1 rounded inline-block">
          {booking.booking_ref}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="font-semibold text-foreground line-clamp-1">
            {booking.tour_schedule?.tour?.title || 'Unknown Tour'}
          </div>
          <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            {new Date(booking.tour_schedule?.start_date || '').toLocaleDateString()}
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
          <span className="font-semibold text-success">₱{booking.total_amount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
