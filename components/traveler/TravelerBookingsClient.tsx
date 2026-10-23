'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cancelBookingAsTraveler } from '@/actions/bookings';
import { XCircle, AlertCircle, Ticket, Star, CheckCircle2, CreditCard, Eye } from 'lucide-react';
import ReviewDialog from '@/components/traveler/ReviewDialog';
import DisputeDialog from '@/components/traveler/DisputeDialog';
import { bookingFlags, formatDate, formatPeso } from '@/components/traveler/bookingRules';
import CardBox from '@/components/ui/CardBox';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type TravelerBooking = {
  id: string;
  booking_ref: string | null;
  seats: number;
  total_amount: number;
  status: string;
  dispute_status: string;
  created_at: string;
  tour_schedules: {
    start_date: string;
    end_date: string;
    tours: {
      title: string;
      slug: string;
    };
  };
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

export default function TravelerBookingsClient({
  initialBookings,
  reviewedBookingIds = [],
  today,
  disputeWindowDays,
}: {
  initialBookings: TravelerBooking[];
  reviewedBookingIds?: string[];
  /** Manila business date from the server (YYYY-MM-DD). */
  today: string;
  /** platform_settings.escrow_holding_days: disputes are allowed until end_date + this. */
  disputeWindowDays: number;
}) {
  const [bookings, setBookings] = useState<TravelerBooking[]>(initialBookings);
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set(reviewedBookingIds));
  const [reviewing, setReviewing] = useState<{ id: string; tourTitle: string } | null>(null);
  const [canceling, setCanceling] = useState<TravelerBooking | null>(null);
  const [disputing, setDisputing] = useState<{ id: string; label: string } | null>(null);

  const label = (b: TravelerBooking) => b.booking_ref ?? `${b.id.split('-')[0]}…`;

  const handleReviewSubmitted = (bookingId: string) => {
    setReviewed((prev) => new Set(prev).add(bookingId));
    setReviewing(null);
    setNotice({ kind: 'success', text: 'Thanks for your review! It will appear on the tour page once our team has checked it.' });
  };

  const confirmCancel = async () => {
    const booking = canceling;
    if (!booking) return;
    setCanceling(null);
    setLoading(booking.id);
    const res = await cancelBookingAsTraveler(booking.id);
    setLoading(null);
    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status: res.status } : b)));
      setNotice({
        kind: 'success',
        text: booking.status === 'confirmed'
          ? `Booking ${label(booking)} was canceled. Your refund is on its way to your original payment method.`
          : `Booking ${label(booking)} was canceled.`,
      });
    } else {
      setNotice({ kind: 'error', text: res.error });
    }
  };

  const handleDisputeOpened = (bookingId: string) => {
    setDisputing(null);
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, dispute_status: 'open' } : b)));
    setNotice({ kind: 'success', text: 'Your dispute was opened. Our team will review it and email you the outcome.' });
  };

  const getFlags = (b: TravelerBooking) => {
    const flags = bookingFlags(
      { status: b.status, dispute_status: b.dispute_status, start_date: b.tour_schedules?.start_date, end_date: b.tour_schedules?.end_date },
      today,
      disputeWindowDays
    );
    const isReviewed = reviewed.has(b.id);
    const canReview = b.status === 'completed' && !isReviewed;
    return { ...flags, canReview, isReviewed };
  };

  const renderStatus = (b: TravelerBooking) => (
    <div className="flex flex-col gap-1">
      <StatusBadge status={b.status} className="w-fit" />
      {b.dispute_status !== 'none' && (
        <StatusBadge
          status={b.dispute_status === 'open' ? 'pending' : b.dispute_status}
          label={`Dispute: ${b.dispute_status.replaceAll('_', ' ')}`}
          className="w-fit"
        />
      )}
    </div>
  );

  const renderActions = (b: TravelerBooking) => {
    const { canPay, canCancel, canDispute, canReview, isReviewed } = getFlags(b);
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canPay && b.tour_schedules?.tours?.slug && (
          <Button asChild variant="default" size="xs">
            <Link href={`/tours/${b.tour_schedules.tours.slug}/booking/${b.id}/pay`}>
              <CreditCard className="size-3.5" aria-hidden="true" />
              Pay now
            </Link>
          </Button>
        )}
        <Button asChild variant="neutral" size="xs">
          <Link href={`/dashboard/traveler/bookings/${b.id}`} aria-label={`View booking ${label(b)}`}>
            <Eye className="size-3.5" aria-hidden="true" />
            View
          </Link>
        </Button>
        {canCancel && (
          <Button type="button" variant="lighterror" size="xs" onClick={() => setCanceling(b)} disabled={loading === b.id}>
            <XCircle className="size-3.5" aria-hidden="true" />
            Cancel
          </Button>
        )}
        {canDispute && (
          <Button
            type="button"
            variant="lightwarning"
            size="xs"
            onClick={() => setDisputing({ id: b.id, label: label(b) })}
            disabled={loading === b.id}
          >
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Dispute
          </Button>
        )}
        {canReview && (
          <Button
            type="button"
            variant="lightprimary"
            size="xs"
            onClick={() => setReviewing({ id: b.id, tourTitle: b.tour_schedules?.tours?.title || 'your trip' })}
          >
            <Star className="size-3.5" aria-hidden="true" />
            Leave a review
          </Button>
        )}
        {isReviewed && b.status === 'completed' && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Reviewed
          </span>
        )}
      </div>
    );
  };

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h5 className="card-title">All Bookings</h5>
        <p className="text-sm text-muted-foreground">Pay for held bookings, cancel upcoming trips, open a dispute after your tour, or review completed trips.</p>
      </div>
      {notice && (
        <div className="px-6 pt-4" role="status">
          <Alert variant={notice.kind === 'success' ? 'lightsuccess' : 'lighterror'}>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        </div>
      )}
      {bookings.length === 0 ? (
        <EmptyState icon={Ticket} title="You haven't booked any tours yet." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6">Booking</TableHead>
                  <TableHead>Tour Package</TableHead>
                  <TableHead>Travel Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="px-6 font-mono text-xs font-medium text-muted-foreground" title={b.id}>
                      {label(b)}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {b.tour_schedules?.tours?.title}
                      <div className="mt-1 text-xs font-normal text-muted-foreground">{b.seats} Pax</div>
                    </TableCell>
                    <TableCell>{formatDate(b.tour_schedules?.start_date)}</TableCell>
                    <TableCell className="font-semibold text-foreground">{formatPeso(b.total_amount)}</TableCell>
                    <TableCell>{renderStatus(b)}</TableCell>
                    <TableCell className="px-6 text-right">{renderActions(b)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {bookings.map((b) => (
              <LazyMobileCard
                key={b.id}
                headerTitle={b.tour_schedules?.tours?.title}
                headerSubtitle={`${label(b)} · ${b.seats} Pax`}
                headerBadge={renderStatus(b)}
                rows={[
                  { label: 'Travel Date', value: formatDate(b.tour_schedules?.start_date) },
                  { label: 'Total Amount', value: formatPeso(b.total_amount) },
                ]}
                actions={renderActions(b)}
              />
            ))}
          </div>
        </>
      )}
      <ReviewDialog booking={reviewing} onClose={() => setReviewing(null)} onSubmitted={handleReviewSubmitted} />
      <DisputeDialog booking={disputing} onClose={() => setDisputing(null)} onOpened={handleDisputeOpened} />
      <ConfirmModal
        isOpen={Boolean(canceling)}
        title="Cancel this booking?"
        message={
          canceling?.status === 'confirmed'
            ? `Booking ${canceling ? label(canceling) : ''} will be canceled and ${formatPeso(canceling?.total_amount)} refunded to your original payment method.`
            : 'Your held seats will be released. You have not been charged.'
        }
        confirmText="Yes, cancel booking"
        cancelText="Keep booking"
        onConfirm={confirmCancel}
        onCancel={() => setCanceling(null)}
        isDestructive
      />
    </CardBox>
  );
}
