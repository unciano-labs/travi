'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Ban, XCircle, Banknote, ShieldCheck } from 'lucide-react';
import { approvePayout, markPayoutPaid, rejectPayout } from '@/actions/admin';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import InputDialog from '@/components/admin/InputDialog';
import { formatDateTime, formatPHP } from '@/lib/format';

export interface AdminPayout {
  id: string;
  amount: number;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approverName: string | null;
  partnerName: string;
  partnerPerson: string | null;
  partnerEmail: string | null;
  method: string | null;
  bankName: string | null;
  accountName: string | null;
  accountMasked: string | null;
}

interface PayoutsClientProps {
  initialPayouts: AdminPayout[];
  currentAdminId: string;
  dualApprovalThreshold: number | null;
}

type DialogState = { kind: 'approve' | 'pay' | 'reject'; payout: AdminPayout } | null;

const STATUS_LABEL: Record<string, string> = { processing: 'approved' };

function StatusIcon({ status }: { status: string }) {
  if (status === 'paid') return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
  if (status === 'rejected') return <Ban className="size-3.5" aria-hidden="true" />;
  if (status === 'processing') return <ShieldCheck className="size-3.5" aria-hidden="true" />;
  return <Clock className="size-3.5" aria-hidden="true" />;
}

export function PayoutsClient({ initialPayouts, currentAdminId, dualApprovalThreshold }: PayoutsClientProps) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const needsApproval = (p: AdminPayout) => dualApprovalThreshold !== null && p.amount >= dualApprovalThreshold;
  const patch = (id: string, changes: Partial<AdminPayout>) =>
    setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p)));

  const approve = async () => {
    if (dialog?.kind !== 'approve') return;
    if (approving) return;
    const target = dialog.payout;
    setApproving(true);
    const res = await approvePayout(target.id);
    setApproving(false);
    setDialog(null);
    if (res.success) {
      patch(target.id, { status: 'processing', approvedBy: currentAdminId, approverName: 'You', approvedAt: new Date().toISOString() });
      setNotice('Payout approved. A different admin must now send the money and mark it paid.');
    } else {
      setNotice(res.error);
    }
  };

  function renderActions(p: AdminPayout) {
    if (p.status !== 'pending' && p.status !== 'processing') return null;
    const approvalPending = p.status === 'pending' && needsApproval(p);
    const iApproved = p.status === 'processing' && p.approvedBy === currentAdminId;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {approvalPending ? (
          <Button type="button" variant="lightprimary" size="sm" onClick={() => setDialog({ kind: 'approve', payout: p })}>
            <ShieldCheck /> Approve
          </Button>
        ) : (
          <Button
            type="button"
            variant="lightsuccess"
            size="sm"
            disabled={iApproved}
            title={iApproved ? 'You approved this payout: a different admin must mark it paid.' : undefined}
            onClick={() => setDialog({ kind: 'pay', payout: p })}
          >
            <CheckCircle2 /> Mark Paid
          </Button>
        )}
        <Button type="button" variant="lighterror" size="sm" onClick={() => setDialog({ kind: 'reject', payout: p })}>
          <XCircle /> Reject
        </Button>
        {iApproved && <span className="w-full text-right text-[11px] text-muted-foreground">Waiting for another admin</span>}
      </div>
    );
  }

  const statusCell = (p: AdminPayout) => (
    <div className="flex flex-col items-center gap-1">
      <StatusBadge status={p.status} label={<><StatusIcon status={p.status} />{STATUS_LABEL[p.status] ?? p.status}</>} />
      {p.status === 'processing' && p.approverName && (
        <span className="text-[10px] text-muted-foreground">by {p.approverName}</span>
      )}
      {p.status === 'pending' && needsApproval(p) && (
        <span className="text-[10px] text-warningemphasis">Needs 2 admins</span>
      )}
      {(p.status === 'paid' || p.status === 'rejected') && (
        <span className="whitespace-nowrap text-[10px] text-muted-foreground">{formatDateTime(p.updatedAt)}</span>
      )}
      {p.adminNotes && (
        <span className="max-w-[160px] truncate text-center font-mono text-[10px] text-muted-foreground" title={p.adminNotes}>
          {p.adminNotes}
        </span>
      )}
    </div>
  );

  const methodText = (p: AdminPayout) => (
    <>
      <p className="font-semibold uppercase text-foreground">{p.method ?? '—'}{p.bankName ? ` · ${p.bankName}` : ''}</p>
      <p className="font-mono text-xs text-muted-foreground">{p.accountMasked ?? '—'}{p.accountName ? ` · ${p.accountName}` : ''}</p>
    </>
  );

  return (
    <>
      {notice && (
        <Alert variant="lightinfo" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{notice}</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setNotice(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <h5 className="card-title">Withdrawal Requests</h5>
          <p className="text-sm text-muted-foreground">{payouts.length} total</p>
        </div>
        {payouts.length === 0 ? (
          <EmptyState icon={Banknote} title="No payout requests found." />
        ) : (
          <>
            <div className="space-y-4 p-4 md:hidden">
              {payouts.map((p) => (
                <LazyMobileCard
                  key={p.id}
                  headerTitle={p.partnerName}
                  headerSubtitle={p.partnerEmail}
                  headerBadge={statusCell(p)}
                  rows={[
                    { label: 'Amount', value: <span className="font-semibold">{formatPHP(p.amount)}</span> },
                    { label: 'Requested', value: formatDateTime(p.createdAt) },
                    { label: 'Method', value: methodText(p), fullWidth: true },
                  ]}
                  actions={renderActions(p)}
                />
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Date</TableHead>
                    <TableHead className="px-6">Partner</TableHead>
                    <TableHead className="px-6">Method & Details</TableHead>
                    <TableHead className="px-6 text-right">Amount</TableHead>
                    <TableHead className="px-6 text-center">Status</TableHead>
                    <TableHead className="px-6 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap px-6 text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                      <TableCell className="px-6">
                        <p className="font-semibold text-foreground">{p.partnerName}</p>
                        <p className="text-xs text-muted-foreground">{p.partnerEmail}</p>
                        {p.partnerPerson && <p className="mt-0.5 text-xs text-muted-foreground">{p.partnerPerson}</p>}
                      </TableCell>
                      <TableCell className="px-6">{methodText(p)}</TableCell>
                      <TableCell className="px-6 text-right font-semibold text-foreground">{formatPHP(p.amount)}</TableCell>
                      <TableCell className="px-6 text-center">{statusCell(p)}</TableCell>
                      <TableCell className="px-6 text-right">{renderActions(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardBox>

      <ConfirmModal
        isOpen={dialog?.kind === 'approve'}
        title="Approve payout?"
        message={
          dialog?.kind === 'approve'
            ? `Approve ${formatPHP(dialog.payout.amount)} to ${dialog.payout.partnerName}. A different admin must then send the money and mark it paid.`
            : ''
        }
        confirmText={approving ? 'Approving…' : 'Approve'}
        onConfirm={approve}
        onCancel={() => { if (!approving) setDialog(null); }}
      />

      <InputDialog
        open={dialog?.kind === 'pay'}
        title="Mark payout as paid"
        description={
          dialog?.kind === 'pay'
            ? `Only after you have sent ${formatPHP(dialog.payout.amount)} to ${dialog.payout.partnerName} (${dialog.payout.method?.toUpperCase() ?? 'saved method'} ${dialog.payout.accountMasked ?? ''}).`
            : undefined
        }
        label="Bank / e-wallet reference number"
        placeholder="e.g. INSTAPAY-123456"
        maxLength={100}
        confirmText="Mark Paid"
        onClose={() => setDialog(null)}
        onSubmit={async (reference) => {
          if (dialog?.kind !== 'pay') return null;
          const res = await markPayoutPaid(dialog.payout.id, reference);
          if (!res.success) return res.error;
          patch(dialog.payout.id, { status: 'paid', adminNotes: `Reference ID: ${reference}` });
          return null;
        }}
      />

      <InputDialog
        open={dialog?.kind === 'reject'}
        title="Reject payout"
        description="The amount goes back to the partner's available balance and they are emailed the reason."
        label="Reason"
        placeholder="e.g. Invalid account details"
        multiline
        minLength={0}
        confirmText="Reject Payout"
        destructive
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => {
          if (dialog?.kind !== 'reject') return null;
          const res = await rejectPayout(dialog.payout.id, reason || undefined);
          if (!res.success) return res.error;
          patch(dialog.payout.id, { status: 'rejected', adminNotes: reason || null });
          return null;
        }}
      />
    </>
  );
}
