'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { adminCancelBooking } from '@/actions/bookings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Admin "Cancel & refund" (OPS-06): confirmed bookings are refunded in full or in part and canceled;
 * pending (unpaid) bookings are just canceled.
 */
export default function AdminCancelBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: { id: string; bookingRef: string; status: string; totalAmount: number } | null;
  onClose: () => void;
  onDone: (bookingId: string, refundAmount: number | null) => void;
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const paid = booking?.status === 'confirmed';
  const partialAmount = Number(amount);
  const amountValid = mode === 'full' || (partialAmount > 0 && booking !== null && partialAmount <= booking.totalAmount);
  const canSubmit = Boolean(booking) && reason.trim().length >= 5 && (!paid || amountValid);

  const reset = () => {
    setMode('full');
    setAmount('');
    setReason('');
    setError(null);
  };

  const close = () => {
    if (pending) return;
    reset();
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !canSubmit) return;
    setError(null);
    startTransition(async () => {
      const res = await adminCancelBooking({
        bookingId: booking.id,
        reason: reason.trim(),
        amount: paid && mode === 'partial' ? Math.round(partialAmount * 100) / 100 : undefined,
      });
      if (res.success) {
        reset();
        onDone(booking.id, res.refundAmount);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <Dialog open={Boolean(booking)} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{paid ? 'Cancel & refund booking' : 'Cancel unpaid booking'}</DialogTitle>
            <DialogDescription>
              Booking <span className="font-mono">{booking?.bookingRef}</span>.{' '}
              {paid
                ? `The traveler paid ${peso(booking?.totalAmount ?? 0)}. The refund goes back through PayMongo and the organizer's escrow is reduced in proportion.`
                : 'Nothing was paid, so no refund is needed. The seats are released.'}{' '}
              The traveler is notified. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {paid && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Refund amount</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="refund-mode" checked={mode === 'full'} onChange={() => setMode('full')} />
                Full refund ({peso(booking?.totalAmount ?? 0)})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="refund-mode" checked={mode === 'partial'} onChange={() => setMode('partial')} />
                Partial refund
              </label>
              {mode === 'partial' && (
                <div className="space-y-1 pl-6">
                  <Label htmlFor="admin-refund-amount">Amount (₱)</Label>
                  <Input
                    id="admin-refund-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    max={booking?.totalAmount}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-invalid={amount !== '' && !amountValid}
                    required
                  />
                </div>
              )}
            </fieldset>
          )}

          <div className="space-y-2">
            <Label htmlFor="admin-cancel-reason">Reason (kept in the audit log)</Label>
            <Textarea
              id="admin-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              required
              placeholder="e.g. Traveler hospitalized; refund approved by support"
            />
          </div>

          {error && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="neutral" onClick={close} disabled={pending}>
              Keep booking
            </Button>
            <Button type="submit" variant="error" disabled={!canSubmit || pending}>
              {pending && <Loader2 className="animate-spin" />}
              {paid ? 'Cancel & refund' : 'Cancel booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
