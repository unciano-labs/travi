'use client';

import { useState } from 'react';
import { updateBookingStatus } from '@/actions/bookings';
import { Search, Loader2, Calendar, Users, Ticket, XCircle } from 'lucide-react';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate, formatDateOfInstant, formatPHP, formatTimeOfInstant } from '@/lib/format';

interface Booking {
  id: string;
  seats: number;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at?: string;
  booking_ref?: string;
  paymongo_session_id?: string;
  user_profiles: { full_name: string } | null;
  tour_schedules: {
    start_date: string;
    tours: { title: string; organizer_id: string } | null;
  } | null;
}

interface OrganizerBookingsClientProps {
  initialBookings: Booking[];
}

const ITEMS_PER_PAGE = 10;

export default function OrganizerBookingsClient({ initialBookings }: OrganizerBookingsClientProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    
    const q = searchQuery.toLowerCase();
    const id = b.id.toLowerCase();
    const travelerName = (b.user_profiles?.full_name || 'Anonymous').toLowerCase();
    const tourTitle = (b.tour_schedules?.tours?.title || '').toLowerCase();
    const status = b.status.toLowerCase();

    return id.includes(q) || travelerName.includes(q) || tourTitle.includes(q) || status.includes(q);
  });

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Bookings are confirmed only by a verified payment; organizers can only decline a pending one.
  const handleUpdateStatus = async (bookingId: string, status: 'canceled') => {
    setActionLoading(`${bookingId}-${status}`);
    const res = await updateBookingStatus(bookingId, status);
    setActionLoading(null);

    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status } : null));
      }
    } else {
      alert(res.error || 'Failed to update booking status.');
    }
  };

  const fieldLabel = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1';

  return (
    <>
      <PageHeader
        title="Manage Bookings"
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/organizer' }, { title: 'Bookings' }]}
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search bookings"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 bg-white"
            />
          </div>
        }
      />

      <CardBox className="p-0 gap-0 overflow-hidden">
        {filteredBookings.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings found matching your search." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginatedBookings.map((b) => (
                <LazyMobileCard
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                  headerSubtitle={<span className="font-mono text-[10px]">ID: {b.id.split('-')[0]}...</span>}
                  headerBadge={<StatusBadge status={b.status} />}
                  rows={[
                    {
                      label: 'Tour',
                      value: <div className="line-clamp-1">{b.tour_schedules?.tours?.title}</div>,
                      fullWidth: true
                    },
                    {
                      label: 'Date',
                      value: b.tour_schedules?.start_date ? formatDate(b.tour_schedules.start_date) : 'N/A'
                    },
                    {
                      label: 'Pax',
                      value: b.seats
                    },
                    {
                      label: 'Amount',
                      value: <span className="text-successemphasis font-semibold">{formatPHP(b.total_amount || 0)}</span>
                    },
                    {
                      label: 'Booked On',
                      value: (
                        <div className="text-right">
                          <div>{formatDateOfInstant(b.created_at)}</div>
                          <div className="text-xs text-muted-foreground">{formatTimeOfInstant(b.created_at)}</div>
                        </div>
                      )
                    }
                  ]}
                  actions={
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="px-0"
                      onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); }}
                    >
                      View Details
                    </Button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Booking ID</TableHead>
                    <TableHead className="px-6">Traveler</TableHead>
                    <TableHead className="px-6">Tour & Date</TableHead>
                    <TableHead className="px-6">Amount</TableHead>
                    <TableHead className="px-6">Booked On</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="px-6 font-mono text-xs font-medium text-muted-foreground" title={b.id}>
                        {b.id.split('-')[0]}...
                      </TableCell>
                      <TableCell className="px-6 font-semibold text-foreground">{b.user_profiles?.full_name || 'Anonymous'}</TableCell>
                      <TableCell className="px-6">
                        <div className="font-semibold text-foreground line-clamp-1">{b.tour_schedules?.tours?.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {b.tour_schedules?.start_date ? formatDate(b.tour_schedules.start_date) : 'N/A'} 
                          <span className="mx-1">•</span>
                          <Users className="w-3 h-3" aria-hidden="true" />
                          {b.seats} Pax
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-foreground font-semibold tracking-tight">{formatPHP(b.total_amount || 0)}</TableCell>
                      <TableCell className="px-6">
                        <div className="text-sm font-medium text-foreground">{formatDateOfInstant(b.created_at)}</div>
                        <div className="text-xs text-muted-foreground">{formatTimeOfInstant(b.created_at)}</div>
                      </TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button type="button" variant="lightprimary" size="xs" onClick={() => setSelectedBooking(b)}>
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
          <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length}
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
      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle>Booking Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{selectedBooking.user_profiles?.full_name || 'Anonymous Traveler'}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-1 break-all">ID: {selectedBooking.id}</p>
                  </div>
                  <StatusBadge status={selectedBooking.status} />
                </div>

                {/* Grid Details */}
                <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-2 gap-4 border border-border">
                  <div>
                    <span className={fieldLabel}>Tour</span>
                    <div className="font-medium text-foreground text-sm line-clamp-2">{selectedBooking.tour_schedules?.tours?.title}</div>
                  </div>
                  <div>
                    <span className={fieldLabel}>Date</span>
                    <div className="font-medium text-foreground text-sm">
                      {selectedBooking.tour_schedules?.start_date ? formatDate(selectedBooking.tour_schedules.start_date) : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className={fieldLabel}>Guests</span>
                    <div className="font-medium text-foreground text-sm">{selectedBooking.seats} Pax</div>
                  </div>
                  <div>
                    <span className={fieldLabel}>Total Amount</span>
                    <div className="font-semibold text-successemphasis text-sm">{formatPHP(selectedBooking.total_amount || 0)}</div>
                  </div>
                  <div className="col-span-2">
                    <span className={fieldLabel}>Booked On</span>
                    <div className="font-medium text-foreground text-sm">
                      {formatDateOfInstant(selectedBooking.created_at)} at {formatTimeOfInstant(selectedBooking.created_at)}
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">Payment Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className={fieldLabel}>Status</span>
                      <div className="font-medium text-foreground text-sm capitalize">
                        {selectedBooking.status === 'confirmed' || selectedBooking.status === 'completed' ? 'Paid' : selectedBooking.status}
                      </div>
                    </div>
                    <div>
                      <span className={fieldLabel}>Mode</span>
                      <div className="font-medium text-foreground text-sm">
                        {selectedBooking.paymongo_session_id ? 'Online (PayMongo)' : 'Manual / Cash'}
                      </div>
                    </div>
                    {selectedBooking.booking_ref && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className={fieldLabel}>Reference No.</span>
                        <div className="font-mono text-foreground text-xs mt-0.5 break-all">{selectedBooking.booking_ref}</div>
                      </div>
                    )}
                    {selectedBooking.status === 'confirmed' && selectedBooking.updated_at && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className={fieldLabel}>Paid On</span>
                        <div className="font-medium text-foreground text-sm">
                          {formatDateOfInstant(selectedBooking.updated_at)} at {formatTimeOfInstant(selectedBooking.updated_at)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedBooking.status === 'pending' && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outlineerror"
                    onClick={() => handleUpdateStatus(selectedBooking.id, 'canceled')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === `${selectedBooking.id}-canceled` ? <Loader2 className="animate-spin" /> : <XCircle />}
                    Decline Request
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
