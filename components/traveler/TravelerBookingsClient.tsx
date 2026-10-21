'use client';

import { useState } from 'react';
import { cancelBookingAsTraveler, openDispute } from '@/actions/bookings';
import { XCircle, AlertCircle, Ticket } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Booking = {
  id: string;
  seats: number;
  total_amount: number;
  status: string;
  dispute_status: string;
  created_at: string;
  tour_schedules: {
    start_date: string;
    tours: {
      title: string;
    };
  };
};

export default function TravelerBookingsClient({ initialBookings }: { initialBookings: Booking[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will refund your payment to the original payment method.')) return;
    setLoading(bookingId);
    try {
      const res = await cancelBookingAsTraveler(bookingId);
      if (!res.success) {
        alert(res.error || 'Failed to cancel booking');
      } else {
        alert('Booking cancelled successfully.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenDispute = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to open a dispute? We will freeze the funds for this booking and an admin will review the case.')) return;
    setLoading(bookingId);
    try {
      const res = await openDispute(bookingId);
      if (!res.success) {
        alert(res.error || 'Failed to open dispute');
      } else {
        alert('Dispute opened successfully. Please contact support to provide evidence.');
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred');
    } finally {
      setLoading(null);
    }
  };

  const getFlags = (b: Booking) => {
    const isPastDate = b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date) <= new Date() : false;
    const canCancel = (b.status === 'pending' || b.status === 'confirmed') && !isPastDate;
    // Can only dispute if tour has passed but dispute is not resolved/already open.
    const canDispute = b.status === 'confirmed' && b.dispute_status === 'none' && isPastDate;
    return { canCancel, canDispute };
  };

  const renderStatus = (b: Booking) => (
    <div className="flex flex-col gap-1">
      <StatusBadge status={b.status} className="w-fit" />
      {b.dispute_status !== 'none' && (
        <Badge variant="lightWarning" className="w-fit">
          Dispute: {b.dispute_status.replace('_', ' ')}
        </Badge>
      )}
    </div>
  );

  const renderActions = (b: Booking) => {
    const { canCancel, canDispute } = getFlags(b);
    return (
      <div className="flex justify-end gap-2">
        {canCancel && (
          <Button
            type="button"
            variant="lighterror"
            size="xs"
            onClick={() => handleCancel(b.id)}
            disabled={loading === b.id}
          >
            <XCircle className="size-3.5" />
            Cancel
          </Button>
        )}
        {canDispute && (
          <Button
            type="button"
            variant="lightwarning"
            size="xs"
            onClick={() => handleOpenDispute(b.id)}
            disabled={loading === b.id}
          >
            <AlertCircle className="size-3.5" />
            Dispute
          </Button>
        )}
        {!canCancel && !canDispute && (
          <span className="px-3 py-1.5 text-xs font-medium text-muted-foreground">—</span>
        )}
      </div>
    );
  };

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h5 className="card-title">All Bookings</h5>
        <p className="text-sm text-muted-foreground">Cancel upcoming trips or open a dispute after your tour.</p>
      </div>
      {initialBookings.length === 0 ? (
        <EmptyState icon={Ticket} title="You haven't booked any tours yet." />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6">Booking ID</TableHead>
                  <TableHead>Tour Package</TableHead>
                  <TableHead>Travel Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialBookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="px-6 font-mono text-xs font-medium text-muted-foreground" title={b.id}>
                      {b.id.split('-')[0]}...
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {b.tour_schedules?.tours?.title}
                      <div className="mt-1 text-xs font-normal text-muted-foreground">{b.seats} Pax</div>
                    </TableCell>
                    <TableCell>
                      {b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">₱{(b.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>{renderStatus(b)}</TableCell>
                    <TableCell className="px-6 text-right">{renderActions(b)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {initialBookings.map((b) => {
              const { canCancel, canDispute } = getFlags(b);
              return (
                <LazyMobileCard
                  key={b.id}
                  headerTitle={b.tour_schedules?.tours?.title}
                  headerSubtitle={`${b.id.split('-')[0]}... · ${b.seats} Pax`}
                  headerBadge={renderStatus(b)}
                  rows={[
                    { label: 'Travel Date', value: b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A' },
                    { label: 'Total Amount', value: `₱${(b.total_amount || 0).toLocaleString()}` },
                  ]}
                  actions={canCancel || canDispute ? renderActions(b) : undefined}
                />
              );
            })}
          </div>
        </>
      )}
    </CardBox>
  );
}
