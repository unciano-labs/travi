'use client';

import { useState } from 'react';
import { 
  Inbox, CheckCircle2, XCircle, Clock, MapPin, Calendar, Users, 
  PhilippinePeso, Bus, Loader2, Phone, Mail, Check, Search
} from 'lucide-react';
import { acceptTransportRequest, declineTransportRequest, completeTransportBooking } from '@/actions/transport-requests';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TransportRequestsClientProps {
  initialRequests: any[];
}

export default function TransportRequestsClient({ initialRequests }: TransportRequestsClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'accepted' | 'completed' | 'declined'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredRequests = requests.filter((r) => {
    // 1. Filter by Tab
    if (activeTab !== 'all' && r.status !== activeTab) return false;

    // 2. Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const orgName = (r.organizer?.company_name || r.organizer?.display_name || '').toLowerCase();
      const vehicleName = (r.vehicle?.name || '').toLowerCase();
      const pickup = (r.pickup_location || '').toLowerCase();
      const dropoff = (r.dropoff_location || '').toLowerCase();
      const reqId = r.id.toLowerCase();
      
      if (!orgName.includes(q) && !vehicleName.includes(q) && !pickup.includes(q) && !dropoff.includes(q) && !reqId.includes(q)) {
        return false;
      }
    }
    
    return true;
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
    <>
      <PageHeader
        title="Transport Requests"
        description="Handle incoming transportation bookings and trip assignments from verified Tour Organizers."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Requests' }]}
      />

      <div className="space-y-6">
        <CardBox className="gap-4 p-4">
          {/* Filter Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <TabsList className="bg-transparent p-0">
              <TabsTrigger value="all">All Requests ({requests.length})</TabsTrigger>
              <TabsTrigger value="pending" className="group">
                Pending
                {pendingCount > 0 && (
                  <span className="rounded-full bg-lightwarning px-2 py-0.5 text-xs font-semibold text-warningemphasis group-data-[state=active]:bg-white group-data-[state=active]:text-primary">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="accepted">Upcoming / Confirmed ({acceptedCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed Trips</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search requests"
              placeholder="Search by organizer, vehicle, route, or request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardBox>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <CardBox>
            <EmptyState
              icon={Inbox}
              title="No requests found"
              description={
                activeTab === 'all'
                  ? 'When Tour Organizers need vehicles for their tour schedules, requests will appear here.'
                  : `There are currently no requests in the "${activeTab}" category.`
              }
            />
          </CardBox>
        ) : (
          <div className="space-y-6">
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
                <CardBox key={req.id} className="gap-5">
                  {/* Header row */}
                  <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-lightprimary text-xs font-semibold uppercase text-primary">
                        REQ
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">{organizerName}</h3>
                          <span className="font-mono text-xs text-muted-foreground">
                            #{req.id.substring(0, 8)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
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
                      <StatusBadge
                        status={req.status}
                        label={
                          <>
                            {isPending && <Clock className="size-3.5" />}
                            {isAccepted && <CheckCircle2 className="size-3.5" />}
                            {isCompleted && <Check className="size-3.5" />}
                            {(isDeclined || isCanceled) && <XCircle className="size-3.5" />}
                            {req.status.toUpperCase()}
                          </>
                        }
                      />
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Vehicle Needed
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Bus className="size-4 text-primary" />
                        <span>{req.vehicle?.name || 'Assigned Vehicle'}</span>
                      </div>
                      {req.vehicle?.plate_number && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {req.vehicle.plate_number}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Schedule
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Calendar className="size-4 shrink-0 text-secondary" />
                        <span className="line-clamp-1">
                          {new Date(req.pickup_datetime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'UTC',
                          })}
                          {req.return_datetime && ` - ${new Date(req.return_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`}
                        </span>
                      </div>
                      <div className="pl-6 text-xs text-muted-foreground">
                        <span className="font-semibold">Pickup:</span> {new Date(req.pickup_datetime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        })}
                      </div>
                      <div className="pl-6 text-xs text-muted-foreground">
                        <span className="font-semibold">Return:</span> {req.return_datetime ? (
                          new Date(req.return_datetime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          })
                        ) : (
                          <span className="italic">Not set</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Route / Locations
                      </span>
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <MapPin className="size-4 shrink-0 text-success" />
                        <span className="line-clamp-1">{req.pickup_location}</span>
                      </div>
                      <div className="line-clamp-1 pl-6 text-xs text-muted-foreground">
                        → {req.dropoff_location}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Capacity & Rate
                      </span>
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Users className="size-4 text-muted-foreground" />
                        <span>{req.seats_required} Passengers</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <PhilippinePeso className="size-3.5" />
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
                    <div className="flex items-center justify-between rounded-md bg-muted/50 p-3 text-xs text-bodytext">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">Associated Tour:</span>
                        <span>{req.tour_schedule.tour.title}</span>
                        <span className="text-muted-foreground">({req.tour_schedule.tour.location})</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {req.organizer?.phone && (
                        <a
                          href={`tel:${req.organizer.phone}`}
                          className="flex items-center gap-1 transition-colors hover:text-primary"
                        >
                          <Phone className="size-3.5" />
                          <span>{req.organizer.phone}</span>
                        </a>
                      )}
                      {req.organizer?.user_profiles?.email && (
                        <a
                          href={`mailto:${req.organizer.user_profiles.email}`}
                          className="flex items-center gap-1 transition-colors hover:text-primary"
                        >
                          <Mail className="size-3.5" />
                          <span>{req.organizer.user_profiles.email}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <Button
                            type="button"
                            variant="lighterror"
                            size="sm"
                            onClick={() => handleDecline(req.id)}
                            disabled={isDeclining || isAccepting}
                          >
                            {isDeclining ? <Loader2 className="animate-spin" /> : 'Decline Request'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAccept(req.id)}
                            disabled={isAccepting || isDeclining}
                          >
                            {isAccepting ? <Loader2 className="animate-spin" /> : <Check />}
                            Accept & Book Vehicle
                          </Button>
                        </>
                      )}

                      {isAccepted && (
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          onClick={() => handleComplete(req.id)}
                          disabled={isCompleting}
                        >
                          {isCompleting ? <Loader2 className="animate-spin" /> : <Check />}
                          Mark Trip Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBox>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
