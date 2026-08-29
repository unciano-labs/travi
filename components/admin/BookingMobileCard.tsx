import { Calendar } from 'lucide-react';

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

export default function BookingMobileCard({ booking, onClick, getStatusColor }: BookingMobileCardProps) {
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-brand/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded inline-block">
          {booking.booking_ref}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${getStatusColor(booking.status)}`}>
          {booking.status}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="font-bold text-slate-900 line-clamp-1">
            {booking.tour_schedule?.tour?.title || 'Unknown Tour'}
          </div>
          <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> 
            {new Date(booking.tour_schedule?.start_date || '').toLocaleDateString()}
          </div>
        </div>

        <div>
          <div className="font-medium text-slate-700 text-sm">
            {booking.traveler?.full_name || 'No Name'}
          </div>
          <div className="text-slate-500 text-xs">
            {booking.traveler?.email}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
        <div className="text-sm">
          <span className="text-slate-500">Pax:</span>{' '}
          <span className="font-medium text-slate-900">{booking.seats}</span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500">Total:</span>{' '}
          <span className="font-bold text-emerald-600">₱{booking.total_amount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
