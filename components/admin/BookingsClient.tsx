'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, MapPin, Calendar, User, DollarSign, X, Users, Hash, AlertCircle, CheckCircle } from 'lucide-react';
import { resolveDispute } from '@/actions/bookings';

const BookingMobileCard = dynamic(() => import('./BookingMobileCard'), { 
  ssr: false,
  loading: () => <div className="h-32 bg-slate-50 animate-pulse rounded-xl border border-slate-100" />
});

interface Booking {
  id: string;
  booking_ref: string;
  seats: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'canceled' | 'refunded' | 'completed';
  dispute_status: string;
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

interface BookingsClientProps {
  initialBookings: Booking[];
}

const ITEMS_PER_PAGE = 10;

export default function BookingsClient({ initialBookings }: BookingsClientProps) {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialScheduleId = searchParams.get('schedule_id');

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  
  // Filter logic
  const filtered = bookings.filter((booking) => {
    // Exact schedule filter
    if (initialScheduleId && booking.tour_schedule?.id !== initialScheduleId) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    
    const q = searchQuery.toLowerCase();
    const ref = booking.booking_ref?.toLowerCase() || '';
    const id = booking.id.toLowerCase();
    const tourTitle = booking.tour_schedule?.tour?.title?.toLowerCase() || '';
    const email = booking.traveler?.email?.toLowerCase() || '';
    const name = booking.traveler?.full_name?.toLowerCase() || '';
    const status = booking.status.toLowerCase();
    const dispute = booking.dispute_status?.toLowerCase() || '';
    
    return ref.includes(q) || id.includes(q) || tourTitle.includes(q) || email.includes(q) || name.includes(q) || status.includes(q) || dispute.includes(q);
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'canceled':
      case 'refunded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  const handleResolveDispute = async (bookingId: string, decision: 'refund' | 'deny') => {
    if (!window.confirm(`Are you sure you want to ${decision} this dispute? This action is final.`)) return;
    setLoadingAction(bookingId);
    try {
      const res = await resolveDispute(bookingId, decision);
      if (!res.success) {
        alert(res.error || 'Failed to resolve dispute');
      } else {
        alert('Dispute resolved successfully.');
        // Optionally update local state here instead of waiting for reload
        setSelectedBooking(null);
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
        
        {/* Search Bar */}
        <div className="flex gap-3">
          {initialScheduleId && (
             <div className="flex items-center px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-sm font-bold">
                Filtered by Schedule
             </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search booking ID, tour, or traveler..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            No bookings found matching your search.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((booking) => (
                <BookingMobileCard
                  key={booking.id}
                  booking={booking}
                  onClick={() => setSelectedBooking(booking)}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Booking ID</th>
                  <th className="px-6 py-4">Tour Info</th>
                  <th className="px-6 py-4">Traveler</th>
                  <th className="px-6 py-4">Pax</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-bold text-slate-900 bg-slate-100 inline-block px-2 py-1 rounded">
                        {booking.booking_ref}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 line-clamp-1">{booking.tour_schedule?.tour?.title || 'Unknown Tour'}</div>
                      <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 
                        {new Date(booking.tour_schedule?.start_date || '').toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{booking.traveler?.full_name || 'No Name'}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{booking.traveler?.email}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {booking.seats}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600">
                      ₱{booking.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${getStatusColor(booking.status)}`}>
                          {booking.status}
                        </span>
                        {booking.dispute_status && booking.dispute_status !== 'none' && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                            booking.dispute_status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'
                          }`}>
                            Dispute: {booking.dispute_status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedBooking(booking)}
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
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Booking Details</h2>
              <button onClick={() => setSelectedBooking(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedBooking.tour_schedule?.tour?.title || 'Unknown Tour'}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500 font-mono">
                    <Hash className="w-4 h-4" /> {selectedBooking.booking_ref}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </span>
                  {selectedBooking.dispute_status && selectedBooking.dispute_status !== 'none' && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${
                      selectedBooking.dispute_status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      Dispute: {selectedBooking.dispute_status.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {selectedBooking.dispute_status === 'open' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-3 text-orange-800">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Dispute Open</h4>
                      <p className="text-xs opacity-90 mt-0.5">This booking has an open dispute from the traveler. Funds are held in escrow.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleResolveDispute(selectedBooking.id, 'deny')}
                      disabled={loadingAction === selectedBooking.id}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Deny & Release
                    </button>
                    <button
                      onClick={() => handleResolveDispute(selectedBooking.id, 'refund')}
                      disabled={loadingAction === selectedBooking.id}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Approve Refund
                    </button>
                  </div>
                </div>
              )}

              {/* Grid Details */}
              <div className="bg-slate-50 rounded-xl p-5 grid grid-cols-2 gap-y-6 gap-x-4 border border-slate-100">
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <User className="w-3.5 h-3.5" /> Traveler
                  </span>
                  <div className="font-bold text-slate-900">{selectedBooking.traveler?.full_name || 'No Name'}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{selectedBooking.traveler?.email}</div>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Location
                  </span>
                  <div className="font-medium text-slate-900">{selectedBooking.tour_schedule?.tour?.location || 'Unknown'}</div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Schedule
                  </span>
                  <div className="font-medium text-slate-900 text-sm">
                    {new Date(selectedBooking.tour_schedule?.start_date || '').toLocaleDateString()} - {new Date(selectedBooking.tour_schedule?.end_date || '').toLocaleDateString()}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Booked On
                  </span>
                  <div className="font-medium text-slate-900 text-sm">
                    {new Date(selectedBooking.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" /> Passengers
                  </span>
                  <div className="font-bold text-slate-900 text-xl">{selectedBooking.seats} <span className="text-sm font-medium text-slate-500">pax</span></div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-lg border border-emerald-100/50">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5" /> Total Amount
                  </span>
                  <div className="font-bold text-emerald-600 text-xl">₱{selectedBooking.total_amount.toLocaleString()}</div>
                </div>
              </div>

            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
