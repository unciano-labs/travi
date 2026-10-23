'use client';

import { useState } from 'react';
import { Calendar, Plus, Trash2, Ban, Clock, Bus, Loader2, AlertCircle } from 'lucide-react';
import { blockVehicleDates, removeAvailabilityBlock } from '@/actions/availability';
import { useRouter } from 'next/navigation';
import { formatBusinessDate } from '@/lib/datetime';
import type { AvailabilityView } from '@/lib/schemas/transport';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as BigCalendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface VehicleOption {
  id: string;
  name: string;
  vehicle_type: string | null;
  plate_number?: string | null;
}

interface AvailabilityManagerProps {
  vehicles: VehicleOption[];
  initialAvailability: AvailabilityView[];
  /** Manila date (YYYY-MM-DD) from the server: the earliest date that can be blocked. */
  today: string;
}

// A DATE (YYYY-MM-DD) as a local calendar day. `new Date('2026-10-23')` is UTC midnight, which
// lands on the previous day in browsers west of UTC.
function localDay(date: string, endOfDay = false) {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

export default function AvailabilityManager({
  vehicles,
  initialAvailability,
  today,
}: AvailabilityManagerProps) {
  const router = useRouter();
  const [availabilityList, setAvailabilityList] = useState(initialAvailability);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [listError, setListError] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const filteredAvailability = availabilityList.filter((item) => {
    if (selectedVehicleId === 'all') return true;
    return item.vehicleId === selectedVehicleId;
  });

  const events = filteredAvailability.map((item) => {
    // All-day events covering whole local calendar days
    const start = localDay(item.startDate);
    const end = localDay(item.endDate, true);

    const isBooked = item.status === 'booked';
    let title = isBooked ? 'Booked' : 'Blocked';
    if (item.vehicle?.name) {
      title += `: ${item.vehicle.name}`;
      if (item.vehicle?.plateNumber) title += ` (${item.vehicle.plateNumber})`;
    }

    return {
      id: item.id,
      title,
      start,
      end,
      allDay: true,
      resource: item
    };
  });

  const eventStyleGetter = (event: { resource: AvailabilityView }) => {
    const isBooked = event.resource.status === 'booked';
    const backgroundColor = isBooked ? 'var(--color-primary)' : 'var(--color-warning)';
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        fontSize: '11px',
        padding: '3px 8px',
        fontWeight: 600,
      }
    };
  };

  const handleCreateBlock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const vehicleId = formData.get('vehicleId') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const notes = formData.get('notes') as string;

    const res = await blockVehicleDates({ vehicleId, startDate, endDate, notes });
    setLoading(false);

    if (res.success) {
      setShowBlockModal(false);
      router.refresh();
    } else {
      setErrorMsg(res.error || 'Failed to block dates.');
    }
  };

  const handleRemoveBlock = async (id: string) => {
    setActionLoading(id);
    setListError('');
    const res = await removeAvailabilityBlock(id);
    setActionLoading(null);

    if (res.success) {
      setAvailabilityList((prev) => prev.filter((item) => item.id !== id));
      router.refresh();
    } else {
      setListError(res.error || 'Failed to remove block.');
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');

  const formatShort = (d: string) => formatBusinessDate(d, { month: 'short', day: 'numeric' });
  const formatLong = (d: string) => formatBusinessDate(d);

  return (
    <>
      <PageHeader
        title="Availability Calendar"
        description="Control vehicle availability windows, schedule maintenance blocks, and prevent conflicting bookings."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Availability' }]}
        actions={
          <>
            <NativeSelect
              aria-label="Filter by vehicle"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-auto min-w-44 bg-white"
            >
              <option value="all">All Vehicles ({vehicles.length})</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.vehicle_type})
                </option>
              ))}
            </NativeSelect>
            <Button type="button" onClick={() => setShowBlockModal(true)} disabled={vehicles.length === 0}>
              <Plus /> Block Dates
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Calendar View */}
        <CardBox className="calendar-container col-span-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h5 className="card-title flex items-center gap-2">
              <Calendar className="size-5 text-primary" aria-hidden="true" /> Availability Overview
            </h5>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-bodytext">
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-primary" aria-hidden="true"></span>
                Booked / Reserved (Locked by confirmed trip)
              </span>
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-warning" aria-hidden="true"></span>
                Blocked (Maintenance / Private use)
              </span>
              <span className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-success" aria-hidden="true"></span>
                Open / Available for new requests
              </span>
            </div>
          </div>
          <div className="h-[500px]">
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              onNavigate={(newDate) => setCurrentDate(newDate)}
              view={currentView}
              onView={(newView) => setCurrentView(newView)}
              views={['month', 'week', 'agenda']}
              eventPropGetter={eventStyleGetter}
              tooltipAccessor={(event) => `${event.title}${event.resource.notes ? `\nNotes: ${event.resource.notes}` : ''}`}
            />
          </div>
        </CardBox>

        {listError && (
          <Alert variant="lighterror" className="col-span-12">
            <AlertCircle />
            <AlertDescription>{listError}</AlertDescription>
          </Alert>
        )}

        {/* Availability List Table */}
        <CardBox className="col-span-12 gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-6 py-4">
            <h5 className="card-title">Detailed Schedule</h5>
          </div>
          {filteredAvailability.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No scheduled blocks or bookings"
              description="Your vehicles are currently available for all dates. You can manually block dates for servicing or personal use anytime."
              action={
                vehicles.length > 0 && (
                  <Button type="button" onClick={() => setShowBlockModal(true)}>
                    <Plus /> Block Date Range
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Mobile View */}
              <div className="block space-y-4 p-4 md:hidden">
                {filteredAvailability.map((item) => {
                  const isBooked = item.status === 'booked';
                  const isRemoving = actionLoading === item.id;

                  return (
                    <LazyMobileCard
                      key={item.id}
                      headerTitle={item.vehicle?.name || 'Unknown Vehicle'}
                      headerSubtitle={item.vehicle?.plateNumber ?? undefined}
                      headerBadge={
                        <Badge variant={isBooked ? 'lightPrimary' : 'lightWarning'}>
                          {isBooked ? <Clock className="size-3" /> : <Ban className="size-3" />}
                          {isBooked ? 'Trip Booked' : 'Blocked'}
                        </Badge>
                      }
                      rows={[
                        {
                          label: 'Dates',
                          value: <span>{formatShort(item.startDate)} - {formatShort(item.endDate)}</span>,
                        },
                        {
                          label: 'Notes',
                          value: (
                            <div className="line-clamp-2">
                              {isBooked && item.booking ? (
                                <span>{item.booking.organizerName || 'Organizer booking'} ({item.booking.pickupLocation})</span>
                              ) : (
                                <span>{item.notes || 'No description provided'}</span>
                              )}
                            </div>
                          ),
                          fullWidth: true,
                        },
                      ]}
                      actions={
                        !isBooked && (
                          <Button
                            type="button"
                            variant="ghosterror"
                            size="iconsm"
                            onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(item.id); }}
                            disabled={isRemoving}
                            title="Remove Block"
                            aria-label="Remove Block"
                          >
                            {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-6">Vehicle</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details / Notes</TableHead>
                      <TableHead className="px-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailability.map((item) => {
                      const isBooked = item.status === 'booked';
                      const isRemoving = actionLoading === item.id;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="px-6 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <Bus className="size-4 text-muted-foreground" />
                              <span>{item.vehicle?.name || 'Unknown Vehicle'}</span>
                            </div>
                            {item.vehicle?.plateNumber && (
                              <span className="font-mono text-xs font-normal text-muted-foreground">
                                {item.vehicle.plateNumber}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{formatLong(item.startDate)}</TableCell>
                          <TableCell className="font-medium">{formatLong(item.endDate)}</TableCell>
                          <TableCell>
                            <Badge variant={isBooked ? 'lightPrimary' : 'lightWarning'}>
                              {isBooked ? <Clock className="size-3.5" /> : <Ban className="size-3.5" />}
                              {isBooked ? 'Trip Booked' : 'Maintenance / Blocked'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isBooked && item.booking ? (
                              <div>
                                <div className="font-semibold text-foreground">
                                  {item.booking.organizerName || 'Organizer booking'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.booking.pickupLocation} → {item.booking.dropoffLocation}
                                </div>
                              </div>
                            ) : (
                              <span>{item.notes || 'No description provided'}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 text-right">
                            {!isBooked && (
                              <Button
                                type="button"
                                variant="ghosterror"
                                size="iconsm"
                                onClick={() => setConfirmRemoveId(item.id)}
                                disabled={isRemoving}
                                title="Remove Block"
                                aria-label="Remove Block"
                              >
                                {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardBox>
      </div>

      {/* Block Dates Modal */}
      <Dialog open={showBlockModal} onOpenChange={(open) => { if (!open) setShowBlockModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-warning" aria-hidden="true" /> Block Vehicle Dates
            </DialogTitle>
            <DialogDescription className="sr-only">Block a date range for one of your vehicles.</DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateBlock} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="block-vehicleId">Select Vehicle *</Label>
              <NativeSelect id="block-vehicleId" name="vehicleId" required>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate_number || v.vehicle_type})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="block-startDate">Start Date *</Label>
                <Input id="block-startDate" type="date" name="startDate" required min={today} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-endDate">End Date *</Label>
                <Input id="block-endDate" type="date" name="endDate" required min={today} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-notes">Reason / Notes</Label>
              <Input id="block-notes" type="text" name="notes" maxLength={300} placeholder="e.g. Scheduled PMS / Maintenance" />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button type="button" variant="neutral" onClick={() => setShowBlockModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Confirm Block
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={confirmRemoveId !== null}
        title="Remove this block?"
        message="The vehicle becomes available for new transport requests on these dates."
        confirmText="Remove block"
        isDestructive
        onCancel={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          const id = confirmRemoveId;
          setConfirmRemoveId(null);
          if (id) void handleRemoveBlock(id);
        }}
      />
    </>
  );
}
