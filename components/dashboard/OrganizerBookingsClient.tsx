'use client';

import { useState } from 'react';
import { updateBookingStatus } from '@/actions/bookings';
import { Search, Loader2, Calendar, MapPin, Users, Ticket, X, CheckCircle, XCircle } from 'lucide-react';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

interface Booking {
  id: string;
  seats: number;
  total_amount: number;
  status: string;
  created_at: string;
  user_profiles: { full_name: string } | null;
  tour_schedules: {
    start_date: string;
    tours: { title: string; organizer_id: string } | null;
  } | null;
}

interface OrganizerBookingsClientProps {
  initialBookings: Booking[];
}

const ITEMS_PER_PAGE = 10;

export default function OrganizerBookingsClient({ initialBookings }: OrganizerBookingsClientProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    
    const q = searchQuery.toLowerCase();
    const id = b.id.toLowerCase();
    const travelerName = (b.user_profiles?.full_name || 'Anonymous').toLowerCase();
    const tourTitle = (b.tour_schedules?.tours?.title || '').toLowerCase();
    const status = b.status.toLowerCase();

    return id.includes(q) || travelerName.includes(q) || tourTitle.includes(q) || status.includes(q);
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleUpdateStatus = async (bookingId: string, status: 'confirmed' | 'canceled' | 'completed') => {
    setActionLoading(`${bookingId}-${status}`);
    const res = await updateBookingStatus(bookingId, status);
    setActionLoading(null);

    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
      }
    } else {
      alert(res.error || 'Failed to update booking status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-72 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
          />
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredBookings.length === 0 ? (
           <div className="p-12 text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
               <Ticket className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-slate-500 font-medium">No bookings found matching your search.</p>
           </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginatedBookings.map((b) => (
                <LazyMobileCard
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                  headerSubtitle={<span className="font-mono text-[10px]">ID: {b.id.split('-')[0]}...</span>}
                  headerBadge={
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      b.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      b.status === 'canceled' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {b.status}
                    </span>
                  }
                  rows={[
                    {
                      label: 'Tour',
                      value: <div className="line-clamp-1">{b.tour_schedules?.tours?.title}</div>,
                      fullWidth: true
                    },
                    {
                      label: 'Date',
                      value: b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'
                    },
                    {
                      label: 'Pax',
                      value: b.seats
                    },
                    {
                      label: 'Amount',
                      value: <span className="text-emerald-600 font-bold">₱{(b.total_amount || 0).toLocaleString()}</span>
                    }
                  ]}
                  actions={
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                      className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                    >
                      View Details
                    </button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Booking ID</th>
                  <th className="px-6 py-4">Traveler</th>
                  <th className="px-6 py-4">Tour & Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500" title={b.id}>
                      {b.id.split('-')[0]}...
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{b.user_profiles?.full_name || 'Anonymous'}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{b.tour_schedules?.tours?.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'} 
                        <span className="mx-1">•</span>
                        <Users className="w-3 h-3" />
                        {b.seats} Pax
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold tracking-tight">₱{(b.total_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                        b.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                        b.status === 'canceled' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedBooking(b)}
                        className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Booking Details</h2>
              <button onClick={() => setSelectedBooking(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedBooking.user_profiles?.full_name || 'Anonymous Traveler'}</p>
                  <p className="font-mono text-xs text-slate-500 mt-1">ID: {selectedBooking.id}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  selectedBooking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                  selectedBooking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  selectedBooking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  selectedBooking.status === 'canceled' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {selectedBooking.status}
                </span>
              </div>

              {/* Grid Details */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-4 border border-slate-100">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tour</span>
                  <div className="font-medium text-slate-900 text-sm line-clamp-2">{selectedBooking.tour_schedules?.tours?.title}</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Date</span>
                  <div className="font-medium text-slate-900 text-sm">
                    {selectedBooking.tour_schedules?.start_date ? new Date(selectedBooking.tour_schedules.start_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Guests</span>
                  <div className="font-medium text-slate-900 text-sm">{selectedBooking.seats} Pax</div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Total Amount</span>
                  <div className="font-bold text-emerald-600 text-sm">₱{(selectedBooking.total_amount || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Actions */}
              {selectedBooking.status === 'pending' && (
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'canceled')}
                    disabled={!!actionLoading}
                    className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedBooking.id}-canceled` ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Decline Request
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'confirmed')}
                    disabled={!!actionLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === `${selectedBooking.id}-confirmed` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm Booking
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
