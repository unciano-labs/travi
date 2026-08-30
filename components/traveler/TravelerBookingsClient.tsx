'use client';

import { useState } from 'react';
import { cancelBookingAsTraveler, openDispute } from '@/actions/bookings';
import { XCircle, AlertCircle } from 'lucide-react';

type Booking = {
  id: string;
  seats: number;
  total_amount: number;
  status: string;
  dispute_status: string;
  created_at: string;
  tour_schedules: {
    start_date: string;
    tours: {
      title: string;
    };
  };
};

export default function TravelerBookingsClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will refund your payment to the original payment method.')) return;
    setLoading(bookingId);
    try {
      const res = await cancelBookingAsTraveler(bookingId);
      if (!res.success) {
        alert(res.error || 'Failed to cancel booking');
      } else {
        alert('Booking cancelled successfully.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenDispute = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to open a dispute? We will freeze the funds for this booking and an admin will review the case.')) return;
    setLoading(bookingId);
    try {
      const res = await openDispute(bookingId);
      if (!res.success) {
        alert(res.error || 'Failed to open dispute');
      } else {
        alert('Dispute opened successfully. Please contact support to provide evidence.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {initialBookings.length === 0 ? (
        <div className="p-8 text-center text-slate-500">You haven't booked any tours yet.</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Booking ID</th>
              <th className="px-6 py-4">Tour Package</th>
              <th className="px-6 py-4">Travel Date</th>
              <th className="px-6 py-4">Total Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialBookings.map((b) => {
              const isPastDate = b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date) <= new Date() : false;
              const canCancel = (b.status === 'pending' || b.status === 'confirmed') && !isPastDate;
              // Can only dispute if tour has passed but dispute is not resolved/already open.
              const canDispute = b.status === 'confirmed' && b.dispute_status === 'none' && isPastDate; 
              
              return (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500" title={b.id}>
                    {b.id.split('-')[0]}...
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {b.tour_schedules?.tours?.title}
                    <div className="text-xs text-slate-500 font-normal mt-1">{b.seats} Pax</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">₱{(b.total_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                        b.status === 'completed' ? 'bg-slate-100 text-slate-800' :
                        b.status === 'canceled' || b.status === 'refunded' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {b.status}
                      </span>
                      {b.dispute_status !== 'none' && (
                        <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-orange-100 text-orange-800">
                          Dispute: {b.dispute_status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={loading === b.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      )}
                      {canDispute && (
                        <button
                          onClick={() => handleOpenDispute(b.id)}
                          disabled={loading === b.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors disabled:opacity-50"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Dispute
                        </button>
                      )}
                      {!canCancel && !canDispute && (
                        <span className="text-xs text-slate-400 font-medium px-3 py-1.5">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
