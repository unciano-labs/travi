'use client';

import { useState } from 'react';
import { ArrowRightLeft, Clock, CheckCircle2, AlertCircle, Ban, History, Banknote, Info, Download, Loader2 } from 'lucide-react';
import { requestPayout, SavedPayoutMethod } from '@/actions/wallet';
import PayoutMethodsManager from '@/components/wallet/PayoutMethodsManager';
import CardBox from '@/components/ui/CardBox';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatPHP } from '@/lib/format';

const TX_TYPE_VARIANTS: Record<string, BadgeVariant> = {
  payment_hold: 'lightWarning',
  escrow_release: 'lightSuccess',
  withdrawal_pending: 'lightPrimary',
};

export function WalletClient({ wallet, transactions, payouts, minPayout, holdingDays }: { wallet: any, transactions: any[], payouts: any[], minPayout: number, holdingDays: number }) {
  const savedMethods: SavedPayoutMethod[] = wallet.saved_payout_methods || [];
  const defaultMethod = savedMethods.find(m => m.isDefault) || savedMethods[0];

  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod?.id || '');
  const [payoutAmount, setPayoutAmount] = useState(wallet.available_balance);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  // Server-enforced minimum (platform_settings.min_payout_amount); shown here for convenience.
  const MIN_WITHDRAWAL = minPayout;

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const method = savedMethods.find(m => m.id === selectedMethodId);
    if (!method) {
      setErrorMsg('Please select a valid payout method.');
      return;
    }
    
    if (payoutAmount < MIN_WITHDRAWAL) {
      setErrorMsg(`Minimum withdrawal amount is ${formatPHP(MIN_WITHDRAWAL)}`);
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmPayout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!confirmPassword) {
      setErrorMsg('Please enter your password to confirm.');
      setShowConfirmModal(false);
      return;
    }

    setIsRequesting(true);
    setShowConfirmModal(false);

    const method = savedMethods.find(m => m.id === selectedMethodId);
    if (!method) return;

    const res = await requestPayout({
      amount: Number(payoutAmount),
      methodId: method.id,
      password: confirmPassword
    });

    setConfirmPassword('');

    if (res.success) {
      setSuccessMsg('Payout requested successfully. An admin will process it shortly.');
      // Keep UI responsive: deduct locally just for immediate feedback (or rely on router.refresh)
      window.location.reload();
    } else {
      setErrorMsg(res.error || 'Failed to request payout.');
      setIsRequesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'rejected': return <Ban className="w-5 h-5 text-error" />;
      default: return <Clock className="w-5 h-5 text-warning" />;
    }
  };

  const exportLedgerToCSV = () => {
    if (!transactions || transactions.length === 0) return;

    const headers = ['Date', 'Description', 'Type', 'Amount'];
    const csvRows = transactions.map(tx => {
      // Escape quotes in description to avoid breaking CSV format
      const description = `"${(tx.description || '').replace(/"/g, '""')}"`;
      const date = `"${formatDateTime(tx.created_at)}"`;
      return `${date},${description},${tx.type},${tx.amount}`;
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedMethod = savedMethods.find(m => m.id === selectedMethodId);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-6">
        <StatCard
          title="Available Balance"
          value={formatPHP(wallet.available_balance)}
          icon={Banknote}
          tone="success"
          hint="Ready for withdrawal"
        />
        <StatCard
          title="Escrow Balance"
          value={formatPHP(wallet.escrow_balance)}
          icon={Clock}
          tone="warning"
          hint={`Funds held for confirmed tours. Released ${holdingDays} day${holdingDays === 1 ? '' : 's'} after the trip ends if there is no dispute.`}
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
      {/* Left Column: Payout request & methods */}
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-5">

        {/* Payout Request Form */}
        <CardBox>
          <div>
            <h5 className="card-title">Request Payout</h5>
            <p className="text-sm text-muted-foreground">Withdraw your available balance to a saved method.</p>
          </div>
          
          {wallet.available_balance <= 0 ? (
            <Alert variant="default">
              <AlertCircle />
              <AlertDescription>You have no available funds to withdraw at this time.</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleRequestPayout} className="flex flex-col gap-5">
              {savedMethods.length === 0 ? (
                <Alert variant="default">
                  <AlertCircle />
                  <AlertDescription>Please add a payout method first to withdraw funds.</AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="wallet-method">Withdrawal Method</Label>
                    <NativeSelect 
                      id="wallet-method"
                      value={selectedMethodId}
                      onChange={(e) => setSelectedMethodId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select a saved method</option>
                      {savedMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.type === 'bank' ? m.details.bankName : m.type.toUpperCase()} - {m.details.accountName} (•••• {m.details.accountNumber.slice(-4)})
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

              <div className="space-y-2">
                <Label htmlFor="wallet-amount">Amount (₱)</Label>
                <Input 
                  id="wallet-amount"
                  type="number" 
                  required
                  min={MIN_WITHDRAWAL}
                  max={wallet.available_balance}
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Min: {formatPHP(MIN_WITHDRAWAL)}</p>
              </div>

              {errorMsg && <p className="text-sm font-medium text-error">{errorMsg}</p>}
              {successMsg && <p className="text-sm font-medium text-successemphasis">{successMsg}</p>}

              <Alert variant="lightinfo">
                <Info />
                <AlertDescription className="text-xs">Payouts are processed within 24-48 hours. Standard bank transfer fees may apply depending on your selected method.</AlertDescription>
              </Alert>

              <Button 
                type="submit" 
                disabled={isRequesting || savedMethods.length === 0 || wallet.available_balance < MIN_WITHDRAWAL}
                className="w-full"
              >
                {isRequesting && <Loader2 className="animate-spin" />}
                {isRequesting ? 'Processing...' : 'Withdraw Funds'}
              </Button>
              </>
              )}
            </form>
          )}
        </CardBox>

        <PayoutMethodsManager walletId={wallet.id} methods={savedMethods} />
      </div>

      {/* Right Column: Ledger & History */}
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
        
        {/* Pending Payouts */}
        {payouts.length > 0 && (
          <CardBox className="gap-0 overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              <h5 className="card-title">Recent Payout Requests</h5>
            </div>
            <div className="divide-y divide-border">
              {payouts.slice(0, 5).map((payout: any) => (
                <div key={payout.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(payout.status)}
                    <div>
                      <p className="font-medium capitalize text-foreground">{payout.status}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {payout.payout_method?.method.toUpperCase()} • {formatDateTime(payout.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-foreground">{formatPHP(payout.amount)}</span>
                </div>
              ))}
            </div>
          </CardBox>
        )}

        {/* Ledger Transactions */}
        <CardBox className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h5 className="card-title">Ledger History</h5>
            </div>
            {transactions.length > 0 && (
              <Button type="button" variant="lightprimary" size="xs" onClick={exportLedgerToCSV}>
                <Download />
                Export CSV
              </Button>
            )}
          </div>
          
          {transactions.length === 0 ? (
            <EmptyState icon={History} title="No transactions yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="px-6 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap px-6 text-muted-foreground">
                      {formatDateTime(tx.created_at)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{tx.description}</TableCell>
                    <TableCell>
                      <Badge variant={TX_TYPE_VARIANTS[tx.type] ?? 'gray'}>
                        {tx.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap px-6 text-right font-semibold ${
                      Number(tx.amount) < 0 ? 'text-error' : 'text-successemphasis'
                    }`}>
                      {formatPHP(tx.amount, { signDisplay: 'exceptZero' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBox>
      </div>
    </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={(open) => { if (!open) setShowConfirmModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Withdrawal</DialogTitle>
            <DialogDescription>Please review the details of your payout request before proceeding.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</span>
              <span className="text-xl font-bold text-foreground">{formatPHP(payoutAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</span>
              <span className="text-sm font-semibold uppercase text-foreground">
                {selectedMethod?.type === 'bank' 
                  ? selectedMethod?.details.bankName 
                  : selectedMethod?.type}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</span>
              <span className="max-w-[150px] truncate text-right font-mono text-sm font-semibold text-foreground">
                {selectedMethod?.details.accountNumber}
              </span>
            </div>
          </div>

          <form onSubmit={confirmPayout} className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="wallet-confirm-password">Security Verification</Label>
              <Input 
                id="wallet-confirm-password"
                type="password"
                required
                placeholder="Enter your account password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              {/* type="button": the original had no type, so this Cancel also submitted the payout form */}
              <Button type="button" variant="neutral" className="flex-1" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Confirm Payout
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
