'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Inbox, Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import { updateDataRequestStatus } from '@/actions/privacy';
import { updateSupportMessageStatus } from '@/actions/support';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import {
  DATA_REQUEST_LABELS,
  DATA_REQUEST_STATUSES,
  SUPPORT_STATUSES,
  SUPPORT_TOPIC_LABELS,
  type DataRequestStatus,
  type DataRequestType,
  type SupportStatus,
  type SupportTopic,
} from '@/lib/schemas/legal';

export interface AdminDataRequest {
  id: string;
  type: DataRequestType;
  status: DataRequestStatus;
  details: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  userEmail: string | null;
  userName: string | null;
}

export interface AdminSupportMessage {
  id: string;
  name: string;
  email: string;
  topic: SupportTopic;
  bookingRef: string | null;
  message: string;
  status: SupportStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  signedIn: boolean;
}

type Editing =
  | { kind: 'data'; item: AdminDataRequest }
  | { kind: 'support'; item: AdminSupportMessage };

const isActive = (status: string) => status === 'open' || status === 'in_progress';
const label = (status: string) => status.replace(/_/g, ' ');

export default function RequestsClient({
  initialTab,
  initialDataRequests,
  initialSupportMessages,
}: {
  initialTab: 'data' | 'support';
  initialDataRequests: AdminDataRequest[];
  initialSupportMessages: AdminSupportMessage[];
}) {
  const [dataRequests, setDataRequests] = useState(initialDataRequests);
  const [messages, setMessages] = useState(initialSupportMessages);
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const visibleRequests = showClosed ? dataRequests : dataRequests.filter((r) => isActive(r.status));
  const visibleMessages = showClosed ? messages : messages.filter((m) => isActive(m.status));
  const openRequests = dataRequests.filter((r) => isActive(r.status)).length;
  const openMessages = messages.filter((m) => isActive(m.status)).length;

  const edit = (next: Editing) => {
    setEditing(next);
    setStatus(next.item.status);
    setNote('');
    setError(null);
  };

  const save = () => {
    if (!editing) return;
    const current = editing;
    setError(null);
    startSaving(async () => {
      const now = new Date().toISOString();
      if (current.kind === 'data') {
        const res = await updateDataRequestStatus({ requestId: current.item.id, status, note: note || undefined });
        if (!res.success) return setError(res.error);
        const closed = status === 'completed' || status === 'rejected';
        setDataRequests((prev) => prev.map((r) => (r.id === current.item.id
          ? { ...r, status: status as DataRequestStatus, adminNote: note || r.adminNote, resolvedAt: closed ? now : null }
          : r)));
      } else {
        const res = await updateSupportMessageStatus({ messageId: current.item.id, status, note: note || undefined });
        if (!res.success) return setError(res.error);
        const closed = status === 'resolved' || status === 'closed';
        setMessages((prev) => prev.map((m) => (m.id === current.item.id
          ? { ...m, status: status as SupportStatus, adminNote: note || m.adminNote, resolvedAt: closed ? now : null }
          : m)));
      }
      setEditing(null);
    });
  };

  // A closed data request is final; a support message can be re-opened.
  const statusOptions = editing?.kind === 'data'
    ? DATA_REQUEST_STATUSES.filter((s) => s !== 'open' || editing.item.status === 'open')
    : SUPPORT_STATUSES;
  const dataClosed = editing?.kind === 'data' && !isActive(editing.item.status);

  return (
    <>
      <Tabs defaultValue={initialTab} className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList>
            <TabsTrigger value="data"><ShieldCheck className="size-4" aria-hidden="true" /> Data requests ({openRequests})</TabsTrigger>
            <TabsTrigger value="support"><MessageSquare className="size-4" aria-hidden="true" /> Support ({openMessages})</TabsTrigger>
          </TabsList>
          <label className="flex items-center gap-2 text-sm text-bodytext">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-4 accent-primary" />
            Show closed
          </label>
        </div>

        <TabsContent value="data">
          {visibleRequests.length === 0 ? (
            <CardBox><EmptyState icon={Inbox} title={showClosed ? 'No data requests yet.' : 'No open data requests.'} /></CardBox>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleRequests.map((r) => (
                <CardBox key={r.id} className="gap-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-semibold text-foreground">{DATA_REQUEST_LABELS[r.type]}</p>
                      <p className="text-sm text-muted-foreground">{r.userName || '—'} · {r.userEmail || 'unknown email'}</p>
                      <p className="text-xs text-muted-foreground">Filed {formatDateTime(r.createdAt)}{r.resolvedAt ? ` · closed ${formatDateTime(r.resolvedAt)}` : ''}</p>
                    </div>
                    <StatusBadge status={r.status} label={label(r.status)} />
                  </div>
                  {r.details && <p className="whitespace-pre-wrap text-sm text-bodytext">{r.details}</p>}
                  {r.adminNote && <p className="text-sm text-muted-foreground">Note: {r.adminNote}</p>}
                  <div>
                    <Button type="button" size="xs" variant="lightprimary" onClick={() => edit({ kind: 'data', item: r })}>
                      {isActive(r.status) ? 'Update status' : 'View'}
                    </Button>
                  </div>
                </CardBox>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="support">
          {visibleMessages.length === 0 ? (
            <CardBox><EmptyState icon={Inbox} title={showClosed ? 'No support messages yet.' : 'No open support messages.'} /></CardBox>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleMessages.map((m) => (
                <CardBox key={m.id} className="gap-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                        {SUPPORT_TOPIC_LABELS[m.topic]}
                        {m.topic.startsWith('complaint') && <Badge variant="lightError">complaint</Badge>}
                        {m.bookingRef && <Badge variant="gray">{m.bookingRef}</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {m.name} · <a href={`mailto:${m.email}`} className="text-primary hover:underline">{m.email}</a>
                        {m.signedIn ? ' · signed in' : ' · guest'}
                      </p>
                      <p className="text-xs text-muted-foreground">Received {formatDateTime(m.createdAt)}</p>
                    </div>
                    <StatusBadge status={m.status === 'resolved' ? 'completed' : m.status === 'closed' ? 'archived' : m.status} label={label(m.status)} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-bodytext">{m.message}</p>
                  {m.adminNote && <p className="text-sm text-muted-foreground">Note: {m.adminNote}</p>}
                  <div>
                    <Button type="button" size="xs" variant="lightprimary" onClick={() => edit({ kind: 'support', item: m })}>
                      Update status
                    </Button>
                  </div>
                </CardBox>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <Dialog open onOpenChange={(open) => { if (!open && !saving) setEditing(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing.kind === 'data' ? DATA_REQUEST_LABELS[editing.item.type] : SUPPORT_TOPIC_LABELS[editing.item.topic]}</DialogTitle>
              <DialogDescription>
                {editing.kind === 'data'
                  ? 'Completing or rejecting a request emails the user. Keep records the law requires (bookings, payments, payouts, ledger) when deleting an account.'
                  : 'Reply to the sender by email; use the note to record what was done.'}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="lighterror">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {dataClosed ? (
              <p className="text-sm text-bodytext">This request is closed ({label(editing.item.status)}).</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="request-status">Status</Label>
                  <NativeSelect id="request-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {statusOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="request-note">Note {editing.kind === 'data' ? '(shared with the user)' : '(internal)'}</Label>
                  <Textarea id="request-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="neutral" onClick={() => setEditing(null)} disabled={saving}>Close</Button>
              {!dataClosed && (
                <Button type="button" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
