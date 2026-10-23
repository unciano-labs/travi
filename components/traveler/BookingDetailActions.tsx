'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CreditCard, Loader2, Printer, XCircle } from 'lucide-react';
import { cancelBookingAsTraveler } from '@/actions/bookings';
import DisputeDialog from '@/components/traveler/DisputeDialog';
import { formatPHP } from '@/lib/format';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Actions on the traveler booking detail page (BIZ-18). Flags are computed on the server. */
export default function BookingDetailActions({
  booking,
  canPay,
  canCancel,
  canDispute,
  payHref,
}: {
  booking: { id: string; label: string; status: string; totalAmount: number };
  canPay: boolean;
  canCancel: boolean;
  canDispute: boolean;
  payHref: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const cancel = async () => {
    setConfirming(false);
    setBusy(true);
    const res = await cancelBookingAsTraveler(booking.id);
    setBusy(false);
    if (res.success) {
      setNotice({
        kind: 'success',
        text: booking.status === 'confirmed'
          ? 'Your booking was canceled. The refund is on its way to your original payment method.'
          : 'Your booking was canceled.',
      });
      router.refresh();
    } else {
      setNotice({ kind: 'error', text: res.error });
    }
  };

  return (
    <div className="space-y-3 print:hidden">
      {notice && (
        <Alert variant={notice.kind === 'success' ? 'lightsuccess' : 'lighterror'} role="status">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {canPay && (
          <Button asChild>
            <Link href={payHref}>
              <CreditCard aria-hidden="true" />
              Pay now
            </Link>
          </Button>
        )}
        {canCancel && (
          <Button type="button" variant="lighterror" onClick={() => setConfirming(true)} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <XCircle aria-hidden="true" />}
            Cancel booking
          </Button>
        )}
        {canDispute && (
          <Button type="button" variant="lightwarning" onClick={() => setDisputing(true)} disabled={busy}>
            <AlertCircle aria-hidden="true" />
            Report a problem
          </Button>
        )}
        <Button type="button" variant="neutral" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print receipt
        </Button>
      </div>

      <ConfirmModal
        isOpen={confirming}
        title="Cancel this booking?"
        message={
          booking.status === 'confirmed'
            ? `Booking ${booking.label} will be canceled and ${formatPHP(booking.totalAmount)} refunded to your original payment method.`
            : 'Your held seats will be released. You have not been charged.'
        }
        confirmText="Yes, cancel booking"
        cancelText="Keep booking"
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
        isDestructive
      />
      <DisputeDialog
        booking={disputing ? { id: booking.id, label: booking.label } : null}
        onClose={() => setDisputing(false)}
        onOpened={() => {
          setDisputing(false);
          setNotice({ kind: 'success', text: 'Your dispute was opened. Our team will review it and email you the outcome.' });
          router.refresh();
        }}
      />
    </div>
  );
}
