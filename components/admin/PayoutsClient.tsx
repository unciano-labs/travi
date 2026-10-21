'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Ban, Loader2, XCircle, Banknote } from 'lucide-react';
import { markPayoutPaid, rejectPayout } from '@/actions/admin';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function PayoutsClient({ initialPayouts }: { initialPayouts: any[] }) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleMarkPaid = async (id: string, walletId: string) => {
    const refNum = prompt('Please enter the bank/e-wallet reference number or transaction ID for this payout (required):');
    if (!refNum) return;
    
    setProcessingId(id);
    const res = await markPayoutPaid(id, walletId, refNum);
    if (res.success) {
      setPayouts(payouts.map(p => p.id === id ? { ...p, status: 'paid', admin_notes: `Reference ID: ${refNum}` } : p));
    } else {
      alert(res.error || 'Failed to update payout status.');
    }
    setProcessingId(null);
  };

  const handleReject = async (id: string, walletId: string) => {
    const reason = prompt('Reason for rejection? (e.g. Invalid account details)');
    if (reason === null) return; // cancelled
    
    setProcessingId(id);
    const res = await rejectPayout(id, walletId, reason);
    if (res.success) {
      setPayouts(payouts.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
    } else {
      alert(res.error || 'Failed to reject payout.');
    }
    setProcessingId(null);
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
      case 'rejected': return <Ban className="size-3.5" aria-hidden="true" />;
      default: return <Clock className="size-3.5" aria-hidden="true" />;
    }
  };

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h5 className="card-title">Withdrawal Requests</h5>
        <p className="text-sm text-muted-foreground">{payouts.length} total</p>
      </div>
      {payouts.length === 0 ? (
        <EmptyState icon={Banknote} title="No payout requests found." />
      ) : (
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
            {payouts.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap px-6 text-muted-foreground">
                  {new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </TableCell>
                <TableCell className="px-6">
                  {(() => {
                    const profile = p.user_wallets?.user_profiles;
                    const org = Array.isArray(profile?.organizer_profiles) ? profile?.organizer_profiles[0] : profile?.organizer_profiles;
                    const trans = Array.isArray(profile?.transporter_profiles) ? profile?.transporter_profiles[0] : profile?.transporter_profiles;
                    const businessName = org?.company_name || trans?.company_name || org?.display_name || trans?.display_name;
                    const fullName = profile?.full_name || 'Unknown';

                    return (
                      <>
                        <p className="font-semibold text-foreground">
                          {businessName || fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        {businessName && fullName && businessName !== fullName && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{fullName}</p>
                        )}
                      </>
                    );
                  })()}
                </TableCell>
                <TableCell className="px-6">
                  <p className="font-semibold uppercase text-foreground">{p.payout_method?.method}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.payout_method?.account}</p>
                </TableCell>
                <TableCell className="px-6 text-right font-semibold text-foreground">
                  ₱{Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </TableCell>
                <TableCell className="px-6 text-center">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <StatusBadge status={p.status} label={<>{getStatusIcon(p.status)}{p.status}</>} />
                    {(p.status === 'paid' || p.status === 'rejected') && (
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {new Date(p.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                    {p.admin_notes && (
                      <span className="max-w-[120px] truncate text-center font-mono text-[10px] text-muted-foreground" title={p.admin_notes}>
                        {p.admin_notes}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-6 text-right">
                  {p.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="lightsuccess"
                        size="sm"
                        onClick={() => handleMarkPaid(p.id, p.wallet_id)}
                        disabled={processingId === p.id}
                      >
                        {processingId === p.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                        Mark Paid
                      </Button>
                      <Button
                        type="button"
                        variant="lighterror"
                        size="sm"
                        onClick={() => handleReject(p.id, p.wallet_id)}
                        disabled={processingId === p.id}
                      >
                        {processingId === p.id ? <Loader2 className="animate-spin" /> : <XCircle />}
                        Reject
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardBox>
  );
}
