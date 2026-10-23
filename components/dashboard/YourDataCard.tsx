'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Download, FileEdit, Loader2, Trash2 } from 'lucide-react';
import { downloadMyData, submitDataRequest } from '@/actions/privacy';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { manilaDateTime } from '@/lib/finance-format';
import { DATA_REQUEST_LABELS } from '@/lib/schemas/legal';
import type { OwnDataRequest } from '@/lib/legal/privacy';

type RequestKind = 'deletion' | 'correction';

const DIALOG_COPY: Record<RequestKind, { title: string; description: string; placeholder: string; submit: string }> = {
  deletion: {
    title: 'Request account deletion',
    description: 'Our privacy team will verify the request and delete or anonymise your account.',
    placeholder: 'Optional: anything we should know (e.g. upcoming trips, how to reach you).',
    submit: 'Request deletion',
  },
  correction: {
    title: 'Request a correction',
    description: 'Tell us which information is wrong and what it should be. You can edit most details yourself on this page.',
    placeholder: 'Which details are wrong, and what should they be?',
    submit: 'Send request',
  },
};

// "Your data" card on every profile page (RA 10173 rights; LEG-10): export, deletion and correction
// requests, and the status of past requests. Client component: it downloads a file and opens dialogs.
export default function YourDataCard({ initialRequests, retentionNote }: { initialRequests: OwnDataRequest[]; retentionNote: string }) {
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [downloading, startDownload] = useTransition();
  const [dialog, setDialog] = useState<RequestKind | null>(null);
  const [details, setDetails] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const hasActive = (type: RequestKind) => requests.some((r) => r.requestType === type && (r.status === 'open' || r.status === 'in_progress'));

  const download = () => {
    setMessage(null);
    startDownload(async () => {
      const res = await downloadMyData();
      if (!res.success) {
        setMessage({ tone: 'error', text: res.error });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage({ tone: 'success', text: 'Your data was downloaded as a JSON file.' });
    });
  };

  const openDialog = (kind: RequestKind) => {
    setDetails('');
    setDialogError(null);
    setDialog(kind);
  };

  const submit = () => {
    if (!dialog) return;
    const kind = dialog;
    setDialogError(null);
    startSubmit(async () => {
      const res = await submitDataRequest({ type: kind, details: details || undefined });
      if (!res.success) {
        setDialogError(res.error);
        return;
      }
      setRequests((prev) => [
        { id: `new-${Date.now()}`, requestType: kind, status: 'open', details: details || null, adminNote: null, createdAt: new Date().toISOString(), resolvedAt: null },
        ...prev,
      ]);
      setDialog(null);
      setMessage({ tone: 'success', text: 'Request received. We emailed you a confirmation and will be in touch.' });
    });
  };

  const copy = dialog ? DIALOG_COPY[dialog] : null;

  return (
    <CardBox>
      <div>
        <h5 className="card-title">Your data</h5>
        <p className="text-sm text-muted-foreground">
          Under the Data Privacy Act you can get a copy of your personal data, ask us to correct it, or ask us to delete your account.
          See our{' '}
          <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy Notice</Link>.
        </p>
      </div>

      {message && (
        <Alert variant={message.tone === 'success' ? 'lightsuccess' : 'lighterror'}>
          {message.tone === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="lightprimary" onClick={download} disabled={downloading}>
          {downloading ? <Loader2 className="animate-spin" /> : <Download />}
          {downloading ? 'Preparing…' : 'Download my data'}
        </Button>
        <Button type="button" variant="neutral" onClick={() => openDialog('correction')} disabled={hasActive('correction')}>
          <FileEdit /> Request a correction
        </Button>
        <Button type="button" variant="lighterror" onClick={() => openDialog('deletion')} disabled={hasActive('deletion')}>
          <Trash2 /> Request account deletion
        </Button>
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Your requests</p>
          <ul className="divide-y divide-border rounded-md border border-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{DATA_REQUEST_LABELS[r.requestType]}</p>
                  <p className="text-xs text-muted-foreground">Filed {manilaDateTime(r.createdAt)}</p>
                  {r.adminNote && <p className="mt-1 text-xs text-bodytext">Note: {r.adminNote}</p>}
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {copy && (
        <Dialog open onOpenChange={(open) => { if (!open && !submitting) setDialog(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>
            {dialog === 'deletion' && (
              <Alert variant="lightwarning">
                <AlertCircle />
                <AlertDescription>{retentionNote}</AlertDescription>
              </Alert>
            )}
            {dialogError && (
              <Alert variant="lighterror">
                <AlertCircle />
                <AlertDescription>{dialogError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="data-request-details">{dialog === 'correction' ? 'Details *' : 'Details (optional)'}</Label>
              <Textarea
                id="data-request-details"
                rows={4}
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={copy.placeholder}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="neutral" onClick={() => setDialog(null)} disabled={submitting}>Cancel</Button>
              <Button
                type="button"
                variant={dialog === 'deletion' ? 'error' : 'default'}
                onClick={submit}
                disabled={submitting || (dialog === 'correction' && !details.trim())}
              >
                {submitting && <Loader2 className="animate-spin" />}
                {copy.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </CardBox>
  );
}
