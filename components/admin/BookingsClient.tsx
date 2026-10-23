'use client';

import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Search, MapPin, Calendar, User, DollarSign, Users, Hash, AlertCircle, Ticket, XCircle, type LucideIcon } from 'lucide-react';
import { resolveDispute } from '@/actions/bookings';
import AdminCancelBookingDialog from '@/components/admin/AdminCancelBookingDialog';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CardBox from '@/components/ui/CardBox';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BookingMobileCard = dynamic(() => import('./BookingMobileCard'), {
  ssr: false,
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg border border-border" />
});

interface Booking {
  id: string;
  booking_ref: string;
  seats: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'canceled' | 'refunded' | 'completed';
  dispute_status: string;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  refunds: { amount: number; status: string; reason: string; created_at: string }[];
  created_at: string;
  traveler: {
    full_name: string | null;
    email: string;
  } | null;
  tour_schedule: {
    id: string;
    start_date: string;
    end_date: string;
    tour: {
      title: string;
      location: string;
    } | null;
  } | null;
}

interface BookingsClientProps {
  initialBookings: Booking[];
}

const ITEMS_PER_PAGE = 10;

function DisputeBadge({ disputeStatus }: { disputeStatus: string }) {
  return (
    <Badge variant={disputeStatus === 'open' ? 'lightWarning' : 'gray'}>
      Dispute: {disputeStatus.replaceAll('_', ' ')}
    </Badge>
  );
}

function DetailLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {children}
    </span>
  );
}

export default function BookingsClient({ initialBookings }: BookingsClientProps) {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialScheduleId = searchParams.get('schedule_id');

  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ id: string; decision: 'refund' | 'deny' } | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Filter logic
  const filtered = bookings.filter((booking) => {
    // Exact schedule filter
    if (initialScheduleId && booking.tour_schedule?.id !== initialScheduleId) {
      return false;
    }

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const ref = booking.booking_ref?.toLowerCase() || '';
    const id = booking.id.toLowerCase();
    const tourTitle = booking.tour_schedule?.tour?.title?.toLowerCase() || '';
    const email = booking.traveler?.email?.toLowerCase() || '';
    const name = booking.traveler?.full_name?.toLowerCase() || '';
    const status = booking.status.toLowerCase();
    const dispute = booking.dispute_status?.toLowerCase() || '';

    return ref.includes(q) || id.includes(q) || tourTitle.includes(q) || email.includes(q) || name.includes(q) || status.includes(q) || dispute.includes(q);
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Functional updates keep the table row and the open detail dialog in sync (§6 #23b).
  const handleResolveDispute = async () => {
    const target = resolving;
    if (!target) return;
    setResolving(null);
    setLoadingAction(target.id);
    const res = await resolveDispute(target.id, target.decision);
    setLoadingAction(null);
    if (res.success) {
      const refund = res.refundAmount
        ? [{ amount: res.refundAmount, status: 'succeeded', reason: 'dispute_refund', created_at: new Date().toISOString() }]
        : [];
      setBookings((prev) => prev.map((b) => (b.id === target.id
        ? { ...b, status: res.status as Booking['status'], dispute_status: res.disputeStatus, refunds: [...b.refunds, ...refund] }
        : b)));
      setSelectedBooking((prev) => (prev && prev.id === target.id
        ? { ...prev, status: res.status as Booking['status'], dispute_status: res.disputeStatus, refunds: [...prev.refunds, ...refund] }
        : prev));
      setNotice({
        kind: 'success',
        text: target.decision === 'refund'
          ? `Dispute resolved: ₱${(res.refundAmount ?? 0).toLocaleString()} refunded to the traveler.`
          : 'Dispute denied. The organizer\'s payout will be released on schedule.',
      });
    } else {
      setNotice({ kind: 'error', text: res.error });
    }
  };

  const handleCancelled = (bookingId: string, refundAmount: number | null) => {
    setCancelling(null);
    setBookings((prev) => prev.map((b) => (b.id === bookingId
      ? { ...b, status: 'canceled', refunds: refundAmount ? [...b.refunds, { amount: refundAmount, status: 'succeeded', reason: 'admin_refund', created_at: new Date().toISOString() }] : b.refunds }
      : b)));
    setSelectedBooking(null);
    setNotice({
      kind: 'success',
      text: refundAmount ? `Booking canceled and ₱${refundAmount.toLocaleString()} refunded.` : 'Booking canceled.',
    });
  };

  return (
    <>
      <PageHeader
        title="Manage Bookings"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Bookings' }]}
      />

      <CardBox className="p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="card-title">All Bookings</h5>
            <p className="text-sm text-muted-foreground">{filtered.length} booking{filtered.length === 1 ? '' : 's'}</p>
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            {initialScheduleId && (
              <Badge variant="lightPrimary" className="self-start sm:self-center">
                Filtered by Schedule
              </Badge>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="text"
                aria-label="Search bookings"
                placeholder="Search booking ID, tour, or traveler..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-80 pl-10"
              />
            </div>
          </div>
        </div>

        {notice && (
          <div className="px-6 pt-4" role="status">
            <Alert variant={notice.kind === 'success' ? 'lightsuccess' : 'lighterror'}>
              <AlertDescription>{notice.text}</AlertDescription>
            </Alert>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings found matching your search." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((booking) => (
                <BookingMobileCard
                  key={booking.id}
                  booking={booking}
                  onClick={() => setSelectedBooking(booking)}
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Booking ID</TableHead>
                    <TableHead className="px-6">Tour Info</TableHead>
                    <TableHead className="px-6">Traveler</TableHead>
                    <TableHead className="px-6">Pax</TableHead>
                    <TableHead className="px-6">Total Amount</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="px-6">
                        <span className="font-mono text-sm font-semibold text-foreground bg-muted inline-block px-2 py-1 rounded">
                          {booking.booking_ref}
                        </span>
                      </TableCell>
                      <TableCell className="px-6">
                        <h6 className="text-sm font-semibold text-foreground line-clamp-1">{booking.tour_schedule?.tour?.title || 'Unknown Tour'}</h6>
                        <p className="text-muted-foreground text-xs font-medium mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {new Date(booking.tour_schedule?.start_date || '').toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="px-6">
                        <h6 className="text-sm font-semibold text-foreground">{booking.traveler?.full_name || 'No Name'}</h6>
                        <p className="text-muted-foreground text-xs font-medium mt-0.5">{booking.traveler?.email}</p>
                      </TableCell>
                      <TableCell className="px-6 font-medium">
                        {booking.seats}
                      </TableCell>
                      <TableCell className="px-6 font-semibold text-success">
                        ₱{booking.total_amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={booking.status} />
                          {booking.dispute_status && booking.dispute_status !== 'none' && (
                            <DisputeBadge disputeStatus={booking.dispute_status} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button type="button" variant="lightprimary" size="xs" onClick={() => setSelectedBooking(booking)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="neutral"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardBox>

      {/* Details Modal */}
      {selectedBooking && (
        <Dialog open onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
          <DialogContent className="max-w-2xl p-0 gap-0">
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{selectedBooking.tour_schedule?.tour?.title || 'Unknown Tour'}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground font-mono">
                    <Hash className="w-4 h-4" aria-hidden="true" /> {selectedBooking.booking_ref}
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <StatusBadge status={selectedBooking.status} />
                  {selectedBooking.dispute_status && selectedBooking.dispute_status !== 'none' && (
                    <DisputeBadge disputeStatus={selectedBooking.dispute_status} />
                  )}
                </div>
              </div>

              {selectedBooking.dispute_status === 'open' && (
                <Alert variant="lightwarning" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <AlertCircle />
                  <div className="min-w-0">
                    <AlertTitle>Dispute Open</AlertTitle>
                    <AlertDescription className="text-xs">
                      Opened {selectedBooking.dispute_opened_at ? new Date(selectedBooking.dispute_opened_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'by the traveler'}. Funds are held in escrow.
                    </AlertDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="neutral"
                      size="xs"
                      onClick={() => setResolving({ id: selectedBooking.id, decision: 'deny' })}
                      disabled={loadingAction === selectedBooking.id}
                    >
                      Deny & Release
                    </Button>
                    <Button
                      type="button"
                      variant="error"
                      size="xs"
                      onClick={() => setResolving({ id: selectedBooking.id, decision: 'refund' })}
                      disabled={loadingAction === selectedBooking.id}
                    >
                      Approve Refund
                    </Button>
                  </div>
                </Alert>
              )}

              {selectedBooking.dispute_reason && (
                <div className="rounded-lg border border-border p-4">
                  <DetailLabel icon={AlertCircle}>Traveler&apos;s dispute reason</DetailLabel>
                  <p className="whitespace-pre-line text-sm text-bodytext">{selectedBooking.dispute_reason}</p>
                </div>
              )}

              {selectedBooking.refunds.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <DetailLabel icon={DollarSign}>Refunds</DetailLabel>
                  <ul className="space-y-1 text-sm">
                    {selectedBooking.refunds.map((r, i) => (
                      <li key={`${r.created_at}-${i}`} className="flex justify-between gap-2">
                        <span className="text-bodytext">{r.reason.replaceAll('_', ' ')} · {r.status}</span>
                        <span className="font-medium text-foreground">₱{Number(r.amount).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grid Details */}
              <div className="bg-muted/50 rounded-lg p-5 grid grid-cols-2 gap-y-6 gap-x-4 border border-border">
                <div className="col-span-2 sm:col-span-1">
                  <DetailLabel icon={User}>Traveler</DetailLabel>
                  <div className="font-semibold text-foreground">{selectedBooking.traveler?.full_name || 'No Name'}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{selectedBooking.traveler?.email}</div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <DetailLabel icon={MapPin}>Location</DetailLabel>
                  <div className="font-medium text-foreground">{selectedBooking.tour_schedule?.tour?.location || 'Unknown'}</div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <DetailLabel icon={Calendar}>Schedule</DetailLabel>
                  <div className="font-medium text-foreground text-sm">
                    {new Date(selectedBooking.tour_schedule?.start_date || '').toLocaleDateString()} - {new Date(selectedBooking.tour_schedule?.end_date || '').toLocaleDateString()}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <DetailLabel icon={Calendar}>Booked On</DetailLabel>
                  <div className="font-medium text-foreground text-sm">
                    {new Date(selectedBooking.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-lg border border-border">
                  <DetailLabel icon={Users}>Passengers</DetailLabel>
                  <div className="font-semibold text-foreground text-xl">{selectedBooking.seats} <span className="text-sm font-medium text-muted-foreground">pax</span></div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-lg border border-border">
                  <DetailLabel icon={DollarSign}>Total Amount</DetailLabel>
                  <div className="font-semibold text-success text-xl">₱{selectedBooking.total_amount.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="mt-0 px-6 py-4 border-t border-border bg-muted/50">
              {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'pending') && selectedBooking.dispute_status !== 'open' && (
                <Button
                  type="button"
                  variant="lighterror"
                  onClick={() => setCancelling(selectedBooking)}
                  disabled={loadingAction === selectedBooking.id}
                >
                  <XCircle />
                  {selectedBooking.status === 'confirmed' ? 'Cancel & refund' : 'Cancel booking'}
                </Button>
              )}
              <Button type="button" variant="neutral" onClick={() => setSelectedBooking(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <ConfirmModal
        isOpen={Boolean(resolving)}
        title={resolving?.decision === 'refund' ? 'Approve refund?' : 'Deny dispute?'}
        message={resolving?.decision === 'refund'
          ? 'The traveler gets a full refund through PayMongo, the organizer\'s escrow for this booking is reversed, and the booking is marked refunded. This is final.'
          : 'The refund is declined, the traveler is notified, and the organizer\'s payout is released on schedule. This is final.'}
        confirmText={resolving?.decision === 'refund' ? 'Approve refund' : 'Deny dispute'}
        cancelText="Back"
        onConfirm={handleResolveDispute}
        onCancel={() => setResolving(null)}
        isDestructive={resolving?.decision === 'refund'}
      />

      <AdminCancelBookingDialog
        booking={cancelling ? { id: cancelling.id, bookingRef: cancelling.booking_ref, status: cancelling.status, totalAmount: Number(cancelling.total_amount) } : null}
        onClose={() => setCancelling(null)}
        onDone={handleCancelled}
      />
    </>
  );
}
