'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, Clock, Loader2, Truck, XCircle } from 'lucide-react';
import { cancelTransportRequest } from '@/actions/transport-requests';
import { formatManilaDateTime } from '@/lib/datetime';
import type { TransportRequestView, TransportStatus } from '@/lib/schemas/transport';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransportContact, TransportRequestDetails } from '@/components/dashboard/TransportRequestDetails';

type Tab = 'active' | 'completed' | 'closed' | 'all';

const STATUS_ICON: Record<TransportStatus, typeof Clock> = {
  pending: Clock,
  accepted: CheckCircle2,
  completed: Check,
  declined: XCircle,
  canceled: XCircle,
};

function matchesTab(status: TransportStatus, tab: Tab) {
  if (tab === 'all') return true;
  if (tab === 'active') return status === 'pending' || status === 'accepted';
  if (tab === 'closed') return status === 'declined' || status === 'canceled';
  return status === 'completed';
}

export default function OrganizerTransportClient({ initialRequests }: { initialRequests: TransportRequestView[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [confirmCancel, setConfirmCancel] = useState<TransportRequestView | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = requests.filter((r) => matchesTab(r.status, activeTab));
  const activeCount = requests.filter((r) => matchesTab(r.status, 'active')).length;

  async function cancel(request: TransportRequestView) {
    setCancelingId(request.id);
    setError(null);
    const res = await cancelTransportRequest(request.id);
    setCancelingId(null);
    if (res.success) {
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: 'canceled' } : r)));
      startTransition(() => router.refresh());
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <PageHeader
        title="Transport"
        description="Vehicle requests for your tour schedules. Request transport from a schedule; pay the transporter directly."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/organizer' }, { title: 'Transport' }]}
      />

      <div className="space-y-6">
        {error && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <CardBox className="p-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)}>
            <TabsList className="flex-wrap bg-transparent p-0">
              <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="closed">Declined / Canceled</TabsTrigger>
              <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardBox>

        {visible.length === 0 ? (
          <CardBox>
            <EmptyState
              icon={Truck}
              title="No transport requests"
              description={
                activeTab === 'active'
                  ? 'To request a vehicle, open one of your tours, set a schedule\'s transport to "External transporter", and choose Request Transport.'
                  : 'There are no requests in this category.'
              }
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/organizer/tours">Go to My Tours</Link>
                </Button>
              }
            />
          </CardBox>
        ) : (
          <div className="space-y-6">
            {visible.map((req) => {
              const StatusIcon = STATUS_ICON[req.status];
              const canCancel = req.status === 'pending' || req.status === 'accepted';
              const busy = cancelingId === req.id;
              return (
                <CardBox key={req.id} className="gap-5">
                  <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{req.counterparty?.name}</h3>
                        <span className="font-mono text-xs text-muted-foreground">#{req.id.substring(0, 8)}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested {formatManilaDateTime(req.createdAt, { dateStyle: 'medium' })}
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
                    {req.status === 'accepted' ? (
                      <TransportContact party={req.counterparty} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {req.status === 'pending'
                          ? 'Waiting for the transporter. Their contact details appear once they accept.'
                          : ''}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      {req.schedule?.tourId && (
                        <Button asChild variant="neutral" size="sm">
                          <Link href={`/dashboard/organizer/tours/${req.schedule.tourId}/edit?tab=schedules`}>View schedule</Link>
                        </Button>
                      )}
                      {canCancel && (
                        <Button type="button" variant="lighterror" size="sm" onClick={() => setConfirmCancel(req)} disabled={busy}>
                          {busy && <Loader2 className="animate-spin" />}
                          Cancel request
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

      <ConfirmModal
        isOpen={confirmCancel !== null}
        title="Cancel this transport request?"
        message={
          confirmCancel?.status === 'accepted'
            ? 'The transporter will be notified and the vehicle dates will be released. You can request another vehicle from the schedule.'
            : 'The transporter will be notified. You can request another vehicle from the schedule.'
        }
        confirmText="Cancel request"
        cancelText="Keep request"
        isDestructive
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => {
          const request = confirmCancel;
          setConfirmCancel(null);
          if (request) void cancel(request);
        }}
      />
    </>
  );
}
