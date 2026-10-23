'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { openDispute } from '@/actions/bookings';
import { DISPUTE_REASON_MAX, DISPUTE_REASON_MIN } from '@/lib/schemas/booking';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Traveler dispute form (BIZ-17): a reason of 20-2000 characters is required. */
export default function DisputeDialog({
  booking,
  onClose,
  onOpened,
}: {
  booking: { id: string; label: string } | null;
  onClose: () => void;
  onOpened: (bookingId: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const length = reason.trim().length;
  const valid = length >= DISPUTE_REASON_MIN && length <= DISPUTE_REASON_MAX;

  const close = () => {
    if (pending) return;
    setReason('');
    setError(null);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || !valid) return;
    setError(null);
    startTransition(async () => {
      const res = await openDispute({ bookingId: booking.id, reason: reason.trim() });
      if (res.success) {
        setReason('');
        onOpened(booking.id);
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
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              {booking ? `Booking ${booking.label}. ` : ''}Tell us what went wrong. The organizer&apos;s payout is held while our
              team reviews your case, and we&apos;ll email you the outcome.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="dispute-reason">What happened?</Label>
            <Textarea
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={6}
              maxLength={DISPUTE_REASON_MAX}
              required
              aria-describedby="dispute-reason-help"
              placeholder="Describe the problem, when it happened, and what you'd like us to do."
            />
            <p id="dispute-reason-help" className={`text-xs ${length > 0 && !valid ? 'text-error' : 'text-muted-foreground'}`}>
              {length < DISPUTE_REASON_MIN
                ? `At least ${DISPUTE_REASON_MIN} characters (${length}/${DISPUTE_REASON_MIN}).`
                : `${length}/${DISPUTE_REASON_MAX} characters.`}
            </p>
          </div>

          {error && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="neutral" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="warning" disabled={!valid || pending}>
              {pending && <Loader2 className="animate-spin" />}
              Open dispute
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
