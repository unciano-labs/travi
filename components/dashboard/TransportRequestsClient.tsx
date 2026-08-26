'use client';

import { useState } from 'react';
import { 
  Inbox, CheckCircle2, XCircle, Clock, MapPin, Calendar, Users, 
  PhilippinePeso, Bus, Loader2, Phone, Mail, Check
} from 'lucide-react';
import { acceptTransportRequest, declineTransportRequest, completeTransportBooking } from '@/actions/transport-requests';
import { useRouter } from 'next/navigation';

interface TransportRequestsClientProps {
  initialRequests: any[];
}

export default function TransportRequestsClient({ initialRequests }: TransportRequestsClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'declined'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'all') return true;
    return r.status === activeTab;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length;

  const handleAccept = async (requestId: string) => {
    setActionLoading(`accept-${requestId}`);
    const res = await acceptTransportRequest(requestId);
    setActionLoading(null);

    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'accepted' } : r))
      );
      router.refresh();
    } else {
      alert(res.error || 'Failed to accept request.');
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!confirm('Are you sure you want to decline this transport request?')) return;

    setActionLoading(`decline-${requestId}`);
    const res = await declineTransportRequest(requestId);
    setActionLoading(null);

    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'declined' } : r))
      );
      router.refresh();
    } else {
      alert(res.error || 'Failed to decline request.');
    }
  };

  const handleComplete = async (requestId: string) => {
    setActionLoading(`complete-${requestId}`);
    const res = await completeTransportBooking(requestId);
    setActionLoading(null);

    if (res.success) {
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: 'completed' } : r))
      );
      router.refresh();
    } else {
      alert(res.error || 'Failed to complete booking.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transport Requests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Handle incoming transportation bookings and trip assignments from verified Tour Organizers.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'pending'
              ? 'bg-coral text-white shadow-md shadow-coral/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pending
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-white text-coral rounded-full font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'accepted'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Upcoming / Confirmed ({acceptedCount})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Completed Trips
        </button>
        <button
          onClick={() => setActiveTab('declined')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'declined'
              ? 'bg-slate-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Declined
        </button>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-coral/10 text-coral rounded-2xl flex items-center justify-center mx-auto">
            <Inbox className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No requests found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'all'
                ? 'When Tour Organizers need vehicles for their tour schedules, requests will appear here.'
                : `There are currently no requests in the "${activeTab}" category.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isPending = req.status === 'pending';
            const isAccepted = req.status === 'accepted';
            const isCompleted = req.status === 'completed';
            const isDeclined = req.status === 'declined';
            const isCanceled = req.status === 'canceled';

            const isAccepting = actionLoading === `accept-${req.id}`;
            const isDeclining = actionLoading === `decline-${req.id}`;
            const isCompleting = actionLoading === `complete-${req.id}`;

            const organizerName =
              req.organizer?.company_name ||
              req.organizer?.display_name ||
              'Tour Organizer';

            return (
              <div
                key={req.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all p-6 space-y-5"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                      REQ
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{organizerName}</h3>
                        <span className="font-mono text-xs text-slate-400">
                          #{req.id.substring(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Received on {new Date(req.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        isPending
                          ? 'bg-amber-100 text-amber-800'
                          : isAccepted
                          ? 'bg-blue-100 text-blue-800'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isPending && <Clock className="w-3.5 h-3.5" />}
                      {isAccepted && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isCompleted && <Check className="w-3.5 h-3.5" />}
                      {(isDeclined || isCanceled) && <XCircle className="w-3.5 h-3.5" />}
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Vehicle Needed
                    </span>
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Bus className="w-4 h-4 text-coral" />
                      <span>{req.vehicle?.name || 'Assigned Vehicle'}</span>
                    </div>
                    {req.vehicle?.plate_number && (
                      <span className="text-xs font-mono text-slate-500">
                        {req.vehicle.plate_number}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Pickup Date & Time
                    </span>
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span>
                        {new Date(req.pickup_datetime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(req.pickup_datetime).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Route / Locations
                    </span>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="line-clamp-1">{req.pickup_location}</span>
                    </div>
                    <div className="text-xs text-slate-500 pl-6 line-clamp-1">
                      → {req.dropoff_location}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Capacity & Rate
                    </span>
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{req.seats_required} Passengers</span>
                    </div>
                    <div className="text-xs font-bold text-coral flex items-center gap-1">
                      <PhilippinePeso className="w-3.5 h-3.5" />
                      <span>
                        {req.estimated_price
                          ? Number(req.estimated_price).toLocaleString()
                          : 'Standard Rate'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Associated Tour details if available */}
                {req.tour_schedule?.tour && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">Associated Tour:</span>
                      <span>{req.tour_schedule.tour.title}</span>
                      <span className="text-slate-400">({req.tour_schedule.tour.location})</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {req.organizer?.phone && (
                      <a
                        href={`tel:${req.organizer.phone}`}
                        className="flex items-center gap-1 hover:text-coral transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{req.organizer.phone}</span>
                      </a>
                    )}
                    {req.organizer?.user_profiles?.email && (
                      <a
                        href={`mailto:${req.organizer.user_profiles.email}`}
                        className="flex items-center gap-1 hover:text-coral transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{req.organizer.user_profiles.email}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleDecline(req.id)}
                          disabled={isDeclining || isAccepting}
                          className="px-4 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                        >
                          {isDeclining ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Decline Request'
                          )}
                        </button>
                        <button
                          onClick={() => handleAccept(req.id)}
                          disabled={isAccepting || isDeclining}
                          className="flex items-center gap-1.5 px-5 py-2 bg-coral hover:bg-coral/90 text-white font-bold text-xs rounded-xl shadow-md shadow-coral/20 hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          {isAccepting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Accept & Book Vehicle
                        </button>
                      </>
                    )}

                    {isAccepted && (
                      <button
                        onClick={() => handleComplete(req.id)}
                        disabled={isCompleting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                      >
                        {isCompleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Mark Trip Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
