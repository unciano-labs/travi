'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Banknote, Download, Landmark, Percent, ReceiptText, RotateCcw, ShieldAlert, Wallet, Clock } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { peso } from '@/lib/finance-format';

export interface FinanceSummary {
  gmv: number;
  paymentsCount: number;
  platformFees: number;
  mdr: number;
  refunds: number;
  refundsCount: number;
  escrowLiability: number;
  availableLiability: number;
  pendingPayouts: number;
  pendingPayoutsCount: number;
  needsReviewAmount: number;
  needsReviewCount: number;
  ledgerDriftCount: number;
}

interface FinanceClientProps {
  summary: FinanceSummary | null;
  from: string;
  to: string;
  rangeError: string | null;
}

const EXPORTS: { kind: string; label: string }[] = [
  { kind: 'bookings', label: 'Bookings' },
  { kind: 'payments', label: 'Payments' },
  { kind: 'refunds', label: 'Refunds' },
  { kind: 'payouts', label: 'Payouts' },
  { kind: 'ledger', label: 'Ledger' },
];

// Date-range filter, KPI cards and CSV export links for /admin/finance.
export default function FinanceClient({ summary, from, to, rangeError }: FinanceClientProps) {
  const router = useRouter();
  const [range, setRange] = useState({ from, to });
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    router.push(`/admin/finance?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <CardBox>
        <form onSubmit={apply} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="finance-from">From</Label>
            <Input id="finance-from" type="date" value={range.from} max={range.to || undefined}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-to">To</Label>
            <Input id="finance-to" type="date" value={range.to} min={range.from || undefined}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
          <Button type="submit">Apply</Button>
          <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-xs">
            Flows (GMV, fees, refunds) use the selected Manila dates. Balances and pending items are as of now.
          </p>
        </form>
        {rangeError && (
          <Alert variant="lightwarning">
            <AlertTriangle />
            <AlertDescription>{rangeError} Showing the default range instead.</AlertDescription>
          </Alert>
        )}
      </CardBox>

      {!summary ? (
        <CardBox>
          <EmptyState icon={Landmark} title="Finance figures are unavailable." description="The finance summary could not be loaded. Try again shortly." />
        </CardBox>
      ) : (
        <>
          {summary.ledgerDriftCount > 0 && (
            <Alert variant="lighterror">
              <ShieldAlert />
              <AlertTitle>Ledger drift detected</AlertTitle>
              <AlertDescription>
                {summary.ledgerDriftCount} wallet{summary.ledgerDriftCount === 1 ? '' : 's'} have balances that do not match the sum of
                their ledger rows (<code>wallet_ledger_drift()</code>). Reconcile before paying out.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="GMV collected" value={peso(summary.gmv)} icon={ReceiptText} tone="primary"
              hint={`${summary.paymentsCount.toLocaleString()} applied payment${summary.paymentsCount === 1 ? '' : 's'}`} />
            <StatCard title="Platform fees" value={peso(summary.platformFees)} icon={Percent} tone="success" hint="Gross, before refunds" />
            <StatCard title="PayMongo fees (MDR)" value={peso(summary.mdr)} icon={Landmark} tone="secondary" hint="All payments in range" />
            <StatCard title="Refunds" value={peso(summary.refunds)} icon={RotateCcw} tone="error"
              hint={`${summary.refundsCount.toLocaleString()} refund${summary.refundsCount === 1 ? '' : 's'}`} />
            <StatCard title="Escrow liability" value={peso(summary.escrowLiability)} icon={Wallet} tone="info" hint="Held for upcoming / recent trips" />
            <StatCard title="Available liability" value={peso(summary.availableLiability)} icon={Banknote} tone="warning" hint="Partners can withdraw" />
            <StatCard title="Pending payouts" value={peso(summary.pendingPayouts)} icon={Clock} tone="warning" href="/admin/payouts"
              hint={`${summary.pendingPayoutsCount.toLocaleString()} awaiting payment`} />
            <StatCard title="Needs review" value={peso(summary.needsReviewAmount)} icon={ShieldAlert}
              tone={summary.needsReviewCount > 0 ? 'error' : 'success'}
              hint={`${summary.needsReviewCount.toLocaleString()} payment${summary.needsReviewCount === 1 ? '' : 's'} below`} />
          </div>
        </>
      )}

      <CardBox>
        <div>
          <h5 className="card-title">CSV exports</h5>
          <p className="text-sm text-muted-foreground">
            For the selected range ({from} to {to}). Account numbers are masked to the last 4 digits. Up to 50,000 rows per file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map((e) => (
            <Button key={e.kind} asChild variant="lightprimary" size="sm">
              <a href={`/api/admin/export/${e.kind}?${query}`} download>
                <Download /> {e.label}
              </a>
            </Button>
          ))}
        </div>
      </CardBox>
    </div>
  );
}
