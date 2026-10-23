'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarX2, Loader2 } from 'lucide-react';
import {
  cancelSchedule,
  getScheduleCancellationPreview,
  type ScheduleCancellationBooking,
} from '@/actions/schedules';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatPHP } from '@/lib/format';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';


type Failed = { bookingId: string; bookingRef: string | null; error: string };

/**
 * Organizer "Cancel schedule" (BIZ-04): lists the bookings that will be canceled or refunded, then
 * calls cancelSchedule(). Partial failures are listed with a retry (the action is idempotent).
 */
export default function CancelScheduleDialog({
  open,
  onOpenChange,
  scheduleId,
  tourId,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  tourId: string;
  onCancelled?: () => void;
}) {
  const router = useRouter();
  const [bookings, setBookings] = useState<ScheduleCancellationBooking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let active = true;
    getScheduleCancellationPreview(scheduleId, tourId).then((res) => {
      if (!active) return;
      if (res.success) {
        setBookings(res.bookings);
        setLoadError(null);
      } else {
        setLoadError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, [open, scheduleId, tourId]);

  const paid = bookings?.filter((b) => b.status === 'confirmed') ?? [];
  const unpaid = bookings?.filter((b) => b.status === 'pending') ?? [];
  const refundTotal = paid.reduce((sum, b) => sum + b.totalAmount, 0);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelSchedule({ scheduleId, tourId, reason: reason.trim() || undefined });
      if (res.success) {
        setFailed([]);
        setDone(
          res.canceled + res.refunded === 0
            ? 'The schedule is cancelled.'
            : `The schedule is cancelled. ${res.refunded} paid booking${res.refunded === 1 ? ' was' : 's were'} refunded and ${res.canceled} unpaid booking${res.canceled === 1 ? ' was' : 's were'} canceled. Travelers have been notified.`
        );
        router.refresh();
        onCancelled?.();
      } else {
        setError(res.error);
        setFailed('failed' in res && res.failed ? res.failed : []);
        router.refresh();
      }
    });
  };

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setBookings(null);
      setDone(null);
      setError(null);
      setFailed([]);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarX2 className="size-5 text-error" aria-hidden="true" /> Cancel schedule
          </DialogTitle>
          <DialogDescription>
            Travelers can no longer book this date. Every paid booking is refunded in full to the original payment
            method, unpaid bookings are canceled, and everyone is notified. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <Alert variant="lightsuccess">
            <AlertDescription>{done}</AlertDescription>
          </Alert>
        ) : loadError ? (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : bookings === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-primary" aria-label="Loading affected bookings" />
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No travelers have booked this date, so nobody needs a refund.</p>
            ) : (
              <>
                <p className="text-sm text-bodytext">
                  <span className="font-semibold text-foreground">{paid.length}</span> paid booking{paid.length === 1 ? '' : 's'} will be
                  refunded ({formatPHP(refundTotal)} in total) and <span className="font-semibold text-foreground">{unpaid.length}</span> unpaid
                  booking{unpaid.length === 1 ? '' : 's'} will be canceled.
                </p>
                <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-label="Affected bookings">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{b.travelerName || 'Traveler'}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {b.bookingRef ?? b.id.slice(0, 8)} · {b.seats} pax
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{formatPHP(b.totalAmount)}</span>
                        <StatusBadge status={b.status} label={b.status === 'confirmed' ? 'paid → refund' : 'unpaid → cancel'} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor={`cancel-reason-${scheduleId}`}>Reason (optional, kept in the audit log)</Label>
              <Textarea
                id={`cancel-reason-${scheduleId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g. Typhoon warning for the area"
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertTitle>Not finished</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              {failed.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {failed.map((f) => (
                    <li key={f.bookingId}>
                      <span className="font-mono">{f.bookingRef ?? f.bookingId.slice(0, 8)}</span>: {f.error}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="neutral" onClick={() => close(false)} disabled={pending}>
            {done ? 'Close' : 'Keep schedule'}
          </Button>
          {!done && (
            <Button type="button" variant="error" onClick={handleConfirm} disabled={pending || bookings === null || Boolean(loadError)}>
              {pending && <Loader2 className="animate-spin" />}
              {failed.length > 0 ? 'Retry refunds' : 'Cancel schedule'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
