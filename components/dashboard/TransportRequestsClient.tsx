'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, Clock, Inbox, Loader2, Search, XCircle } from 'lucide-react';
import { acceptTransportRequest, completeTransportBooking, declineTransportRequest } from '@/actions/transport-requests';
import { formatBusinessDate, formatManilaDateTime } from '@/lib/datetime';
import type { TransportRequestView, TransportStatus } from '@/lib/schemas/transport';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransportContact, TransportRequestDetails } from '@/components/dashboard/TransportRequestDetails';

type Tab = 'all' | 'pending' | 'accepted' | 'completed' | 'closed';
type PendingAction = { kind: 'accept' | 'decline' | 'complete'; id: string };

const STATUS_ICON: Record<TransportStatus, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle2,
  completed: Check,
  declined: XCircle,
  canceled: XCircle,
};

interface TransportRequestsClientProps {
  initialRequests: TransportRequestView[];
  /** Manila date (YYYY-MM-DD) from the server, used to enable "Mark trip completed". */
  today: string;
}

function matchesTab(status: TransportStatus, tab: Tab) {
  if (tab === 'all') return true;
  if (tab === 'closed') return status === 'declined' || status === 'canceled';
  return status === tab;
}

export default function TransportRequestsClient({ initialRequests, today }: TransportRequestsClientProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [running, setRunning] = useState<PendingAction | null>(null);
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const q = searchQuery.trim().toLowerCase();
  const filteredRequests = requests.filter((r) => {
    if (!matchesTab(r.status, activeTab)) return false;
    if (!q) return true;
    return [r.counterparty?.name, r.vehicle?.name, r.pickupLocation, r.dropoffLocation, r.id, r.schedule?.tourTitle]
      .some((value) => (value || '').toLowerCase().includes(q));
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length;

  async function run(action: PendingAction, nextStatus: TransportStatus) {
    setRunning(action);
    setError(null);
    const res =
      action.kind === 'accept'
        ? await acceptTransportRequest(action.id)
        : action.kind === 'decline'
          ? await declineTransportRequest(action.id)
          : await completeTransportBooking(action.id);
    setRunning(null);

    if (res.success) {
      setRequests((prev) => prev.map((r) => (r.id === action.id ? { ...r, status: nextStatus } : r)));
      startTransition(() => router.refresh());
    } else {
      setError(res.error);
      if (res.code === 'CONFLICT') startTransition(() => router.refresh());
    }
  }

  return (
    <>
      <PageHeader
        title="Transport Requests"
        description="Respond to vehicle requests from tour organizers. Payment for trips is arranged directly with the organizer."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Requests' }]}
      />

      <div className="space-y-6">
        {error && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <CardBox className="gap-4 p-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
            <TabsList className="flex-wrap bg-transparent p-0">
              <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
              <TabsTrigger value="pending" className="group">
                Pending
                {pendingCount > 0 && (
                  <span className="rounded-full bg-lightwarning px-2 py-0.5 text-xs font-semibold text-warningemphasis group-data-[state=active]:bg-white group-data-[state=active]:text-primary">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="accepted">Upcoming ({acceptedCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="closed">Declined / Canceled</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search requests"
              placeholder="Search by organizer, tour, vehicle, route, or request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardBox>

        {filteredRequests.length === 0 ? (
          <CardBox>
            <EmptyState
              icon={Inbox}
              title="No requests found"
              description={
                activeTab === 'all'
                  ? 'When tour organizers need vehicles for their schedules, requests will appear here.'
                  : 'There are no requests in this category.'
              }
            />
          </CardBox>
        ) : (
          <div className="space-y-6">
            {filteredRequests.map((req) => {
              const busy = running?.id === req.id;
              const StatusIcon = STATUS_ICON[req.status];
              const canComplete = req.status === 'accepted' && today >= req.completableFrom;

              return (
                <CardBox key={req.id} className="gap-5">
                  <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{req.counterparty?.name}</h3>
                        <span className="font-mono text-xs text-muted-foreground">#{req.id.substring(0, 8)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Received {formatManilaDateTime(req.createdAt, { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <StatusBadge
                      status={req.status}
                      label={
                        <>
                          <StatusIcon className="size-3.5" aria-hidden="true" />
                          {req.status.toUpperCase()}
                        </>
                      }
                    />
                  </div>

                  <TransportRequestDetails request={req} />

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <TransportContact party={req.counterparty} />

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {req.status === 'pending' && (
                        <>
                          <Button
                            type="button"
                            variant="lighterror"
                            size="sm"
                            onClick={() => setConfirmDecline(req.id)}
                            disabled={busy}
                          >
                            {busy && running?.kind === 'decline' ? <Loader2 className="animate-spin" /> : null}
                            Decline
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => run({ kind: 'accept', id: req.id }, 'accepted')}
                            disabled={busy}
                          >
                            {busy && running?.kind === 'accept' ? <Loader2 className="animate-spin" /> : <Check />}
                            Accept and book vehicle
                          </Button>
                        </>
                      )}

                      {req.status === 'accepted' &&
                        (canComplete ? (
                          <Button
                            type="button"
                            variant="success"
                            size="sm"
                            onClick={() => run({ kind: 'complete', id: req.id }, 'completed')}
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="animate-spin" /> : <Check />}
                            Mark trip completed
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Can be marked complete from {formatBusinessDate(req.completableFrom)}
                          </span>
                        ))}
                    </div>
                  </div>
                </CardBox>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmDecline !== null}
        title="Decline this request?"
        message="The organizer will be notified and can request another vehicle. This cannot be undone."
        confirmText="Decline request"
        isDestructive
        onCancel={() => setConfirmDecline(null)}
        onConfirm={() => {
          const id = confirmDecline;
          setConfirmDecline(null);
          if (id) void run({ kind: 'decline', id }, 'declined');
        }}
      />
    </>
  );
}
