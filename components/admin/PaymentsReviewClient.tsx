'use client';

import { useState } from 'react';
import { CheckCircle2, RotateCcw, ShieldCheck, FileCheck2 } from 'lucide-react';
import { closeReviewPayment, refundReviewPayment } from '@/actions/admin';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import InputDialog from '@/components/admin/InputDialog';
import { REVIEW_REASON_LABELS, manilaDateTime, peso, shortDate } from '@/lib/finance-format';

export interface ReviewPayment {
  id: string;
  providerPaymentId: string;
  amount: number;
  fee: number;
  reason: string | null;
  source: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  resolutionNote: string | null;
  providerRefundId: string | null;
  refundInProgress: boolean;
  resolverName: string | null;
  bookingRef: string | null;
  bookingStatus: string | null;
  travelerName: string | null;
  tourTitle: string | null;
  startDate: string | null;
}

interface PaymentsReviewClientProps {
  initialOpen: ReviewPayment[];
  recentlyResolved: ReviewPayment[];
}

type DialogState = { kind: 'refund' | 'close'; payment: ReviewPayment } | null;

// Payments PayMongo collected that Travi could not apply (AGENTS.md §6 #6). They never reached escrow,
// so resolving them never changes a wallet.
export default function PaymentsReviewClient({ initialOpen, recentlyResolved }: PaymentsReviewClientProps) {
  const [open, setOpen] = useState(initialOpen);
  const [resolved, setResolved] = useState(recentlyResolved);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refunding, setRefunding] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const markResolved = (payment: ReviewPayment, changes: Partial<ReviewPayment>) => {
    setOpen((prev) => prev.filter((p) => p.id !== payment.id));
    setResolved((prev) => [{ ...payment, ...changes, resolvedAt: new Date().toISOString(), resolverName: 'You' }, ...prev].slice(0, 20));
  };

  const refund = async () => {
    if (dialog?.kind !== 'refund') return;
    if (refunding) return;
    const payment = dialog.payment;
    setRefunding(true);
    const res = await refundReviewPayment(payment.id);
    setRefunding(false);
    setDialog(null);
    if (res.success) {
      markResolved(payment, { resolution: 'refunded', providerRefundId: res.refundId });
      setMessage({ tone: 'success', text: `Refunded ${peso(payment.amount)} (PayMongo ${res.refundId}).` });
    } else {
      setMessage({ tone: 'error', text: res.error });
    }
  };

  const bookingCell = (p: ReviewPayment) => (
    <>
      <p className="font-mono font-semibold text-foreground">{p.bookingRef ?? '—'}</p>
      <p className="text-xs text-muted-foreground">{p.tourTitle ?? 'Unknown tour'}{p.startDate ? ` · ${shortDate(p.startDate)}` : ''}</p>
      {p.travelerName && <p className="text-xs text-muted-foreground">{p.travelerName}</p>}
    </>
  );

  const reasonBadge = (p: ReviewPayment) => (
    <Badge variant="lightWarning">{REVIEW_REASON_LABELS[p.reason ?? ''] ?? p.reason ?? 'Needs review'}</Badge>
  );

  const actions = (p: ReviewPayment) =>
    p.refundInProgress ? (
      <span className="text-xs text-warningemphasis">Refund in progress</span>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="lighterror" size="sm" onClick={() => setDialog({ kind: 'refund', payment: p })}>
          <RotateCcw /> Refund this payment
        </Button>
        <Button type="button" variant="neutral" size="sm" onClick={() => setDialog({ kind: 'close', payment: p })}>
          <FileCheck2 /> Mark resolved
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={message.tone === 'success' ? 'lightsuccess' : 'lighterror'}>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{message.text}</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setMessage(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <h5 className="card-title">Payments needing review</h5>
          <p className="text-sm text-muted-foreground">
            Money PayMongo collected that was not applied to a booking (late, duplicate or wrong amount). Refund it, or close it with a note.
          </p>
        </div>
        {open.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No payments need review." description="Late, duplicate and wrong-amount payments show up here." />
        ) : (
          <>
            <div className="space-y-4 p-4 md:hidden">
              {open.map((p) => (
                <LazyMobileCard
                  key={p.id}
                  headerTitle={p.bookingRef ?? p.providerPaymentId}
                  headerSubtitle={p.tourTitle}
                  headerBadge={reasonBadge(p)}
                  rows={[
                    { label: 'Amount', value: <span className="font-semibold">{peso(p.amount)}</span> },
                    { label: 'Received', value: manilaDateTime(p.createdAt) },
                    { label: 'PayMongo payment', value: <span className="font-mono text-xs">{p.providerPaymentId}</span>, fullWidth: true },
                  ]}
                  actions={actions(p)}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Received</TableHead>
                    <TableHead className="px-6">Booking</TableHead>
                    <TableHead className="px-6">Reason</TableHead>
                    <TableHead className="px-6">PayMongo payment</TableHead>
                    <TableHead className="px-6 text-right">Amount</TableHead>
                    <TableHead className="px-6 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {open.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap px-6 text-muted-foreground">{manilaDateTime(p.createdAt)}</TableCell>
                      <TableCell className="px-6">{bookingCell(p)}</TableCell>
                      <TableCell className="px-6">{reasonBadge(p)}</TableCell>
                      <TableCell className="px-6 font-mono text-xs text-muted-foreground">{p.providerPaymentId}</TableCell>
                      <TableCell className="px-6 text-right font-semibold text-foreground">{peso(p.amount)}</TableCell>
                      <TableCell className="px-6 text-right">{actions(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardBox>

      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <h5 className="card-title">Recently resolved</h5>
          <p className="text-sm text-muted-foreground">Last 20 resolved payment reviews.</p>
        </div>
        {resolved.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No resolved payment reviews yet." />
        ) : (
          <ul className="divide-y divide-border">
            {resolved.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {p.bookingRef ?? p.providerPaymentId} · {peso(p.amount)} ·{' '}
                    {p.resolution === 'refunded' ? `Refunded (${p.providerRefundId})` : 'Closed without refund'}
                  </p>
                  {p.resolutionNote && <p className="truncate text-xs text-muted-foreground" title={p.resolutionNote}>{p.resolutionNote}</p>}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {manilaDateTime(p.resolvedAt)}{p.resolverName ? ` · ${p.resolverName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBox>

      <ConfirmModal
        isOpen={dialog?.kind === 'refund'}
        title="Refund this payment?"
        message={
          dialog?.kind === 'refund'
            ? `PayMongo will refund ${peso(dialog.payment.amount)} (payment ${dialog.payment.providerPaymentId}) to the payer. This cannot be undone.`
            : ''
        }
        confirmText={refunding ? 'Refunding…' : 'Refund'}
        isDestructive
        onConfirm={refund}
        onCancel={() => { if (!refunding) setDialog(null); }}
      />

      <InputDialog
        open={dialog?.kind === 'close'}
        title="Mark resolved without a refund"
        description="Use this when the money was refunded outside Travi or handled another way. The note is kept in the audit log."
        label="Note"
        placeholder="e.g. Refunded in the PayMongo dashboard, ref …"
        multiline
        minLength={3}
        maxLength={1000}
        confirmText="Mark resolved"
        onClose={() => setDialog(null)}
        onSubmit={async (note) => {
          if (dialog?.kind !== 'close') return null;
          const payment = dialog.payment;
          const res = await closeReviewPayment({ paymentId: payment.id, note });
          if (!res.success) return res.error;
          markResolved(payment, { resolution: 'no_refund', resolutionNote: note });
          return null;
        }}
      />
    </div>
  );
}
