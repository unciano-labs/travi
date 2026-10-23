'use client';

import { useState, useRef } from 'react';
import { createSchedule, updateSchedule } from '@/actions/schedules';
import { Plus, Edit2, X, CalendarX2, AlertCircle, Loader2, Truck } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import CancelScheduleDialog from '@/components/dashboard/CancelScheduleDialog';
import CardBox from '@/components/ui/CardBox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPHP } from '@/lib/format';

// Vehicles are requested from the schedule list (TransportManager → sendTransportRequest), which runs
// the transport checks (one active request, seat capacity, vehicle conflicts, Manila times). This form
// only records whether the date needs external transport.
export default function ScheduleForm({ tourId, basePrice, initialData }: { tourId: string, basePrice?: number, initialData?: any }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const router = useRouter();

  const [range, setRange] = useState<DateRange | undefined>(
    initialData ? {
      from: parseISO(initialData.start_date),
      to: parseISO(initialData.end_date)
    } : undefined
  );

  const isEdit = !!initialData;
  const formRef = useRef<HTMLFormElement>(null);
  const [transportType, setTransportType] = useState(initialData?.transport_type || 'none');
  const [capacity, setCapacity] = useState<string>(initialData?.capacity?.toString() || '');

  const isCancelled = initialData?.status === 'cancelled';
  const transportStatus = initialData?.transport_booking?.status as string | undefined;
  const transportActive = transportStatus === 'pending' || transportStatus === 'accepted' || transportStatus === 'completed';

  async function handleSubmit(formData: FormData) {
    if (!range?.from || !range?.to) {
      setError('Please select a complete date range.');
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    // Override dates with the range picker
    formData.set('startDate', format(range.from, 'yyyy-MM-dd'));
    formData.set('endDate', format(range.to, 'yyyy-MM-dd'));

    const res = isEdit
      ? await updateSchedule(initialData.id, tourId, formData)
      : await createSchedule(tourId, formData);

    if (!res.success) {
      setError(res.error);
    } else if (isEdit) {
      // Clear edit state by removing search param
      router.push(`?tab=schedules`);
    } else {
      formRef.current?.reset();
      setRange(undefined);
      setCapacity('');
      if (transportType === 'external_transporter') {
        setNotice('Schedule added. Use "Request Transport" on it in the schedule list to book a vehicle.');
      }
    }

    setLoading(false);
  }

  const cancelEdit = () => {
    router.push(`?tab=schedules`);
  };

  return (
    <>
    <form ref={formRef} action={handleSubmit}>
    <CardBox>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="card-title flex items-center gap-2">
          {isEdit ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
          {isEdit ? 'Edit Schedule' : 'Add New Schedule'}
        </h5>
        {isEdit && (
          <div className="flex items-center gap-1">
            {!isCancelled && (
              <Button type="button" variant="ghosterror" size="xs" onClick={() => setShowCancelDialog(true)}>
                <CalendarX2 /> Cancel schedule
              </Button>
            )}
            <Button type="button" variant="ghost" size="xs" onClick={cancelEdit} className="text-muted-foreground">
              <X /> Close
            </Button>
          </div>
        )}
      </div>

      {isCancelled && (
        <Alert variant="lightwarning">
          <AlertCircle />
          <AlertDescription>This schedule is cancelled and can no longer be edited.</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="lighterror" role="alert">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {notice && (
        <Alert variant="lightsuccess" role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <div
        className="border border-border rounded-lg p-4 bg-white flex flex-col items-center overflow-x-auto"
        style={{ '--rdp-accent-color': 'var(--color-primary)', '--rdp-accent-background-color': 'var(--color-lightprimary)' } as React.CSSProperties}
      >
        <Label className="mb-2 w-full flex-wrap text-left">
          Date Range
          {range?.from && (
            <span className="font-normal text-muted-foreground">
              ({format(range.from, 'MMM d, yyyy')} {range.to ? `- ${format(range.to, 'MMM d, yyyy')}` : ''})
            </span>
          )}
        </Label>
        <DayPicker
          mode="range"
          defaultMonth={range?.from || new Date()}
          selected={range}
          onSelect={setRange}
          modifiersClassNames={{
            selected: 'bg-primary text-white',
            range_middle: 'bg-lightprimary text-primary',
            range_start: 'bg-primary text-white rounded-l-md',
            range_end: 'bg-primary text-white rounded-r-md'
          }}
        />
        {transportStatus === 'accepted' && (
          <p className="mt-2 w-full text-xs text-muted-foreground">
            A transporter has accepted this date, so its dates can&apos;t change until that request is canceled.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-6">
        <div className="space-y-2">
          <Label htmlFor="schedule-capacity">Capacity</Label>
          <Input
            id="schedule-capacity"
            type="number"
            name="capacity"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            required
            min={Math.max(1, Number(initialData?.booked_count) || 0)}
            max="1000"
            placeholder="Seats e.g. 12"
            aria-describedby={initialData?.booked_count > 0 ? 'schedule-capacity-hint' : undefined}
          />
          {initialData?.booked_count > 0 && (
            <p id="schedule-capacity-hint" className="text-xs text-muted-foreground">
              {initialData.booked_count} seat{initialData.booked_count === 1 ? ' is' : 's are'} already booked; capacity can&apos;t go lower.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-original-price">Original Price (₱)</Label>
          <Input id="schedule-original-price" type="number" step="0.01" name="original_price" min="0" defaultValue={initialData?.original_price || ''} placeholder="Compare-at price" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-price">Selling Price (₱)</Label>
          <Input id="schedule-price" type="number" step="0.01" name="price_per_person" min="0" defaultValue={initialData?.price_per_person || ''} placeholder={basePrice ? `Default: ${formatPHP(basePrice, { cents: 'auto' })}` : 'Optional override'} />
        </div>
      </div>

      <div className="border border-border rounded-lg p-4 bg-white space-y-3">
        <Label htmlFor="schedule-transport-type">Transport Requirement</Label>
        <NativeSelect
          id="schedule-transport-type"
          name="transport_type"
          value={transportType}
          onChange={e => setTransportType(e.target.value)}
          disabled={transportActive}
          aria-describedby="schedule-transport-help"
        >
          <option value="none">None (Travelers meet at location)</option>
          <option value="self_provided">Self-provided (We will provide the transport)</option>
          <option value="external_transporter">External Transporter (Need to book a vehicle)</option>
        </NativeSelect>
        {/* A disabled select is not submitted: keep the current value in the form. */}
        {transportActive && <input type="hidden" name="transport_type" value={transportType} />}
        <p id="schedule-transport-help" className="flex items-start gap-2 text-xs text-muted-foreground">
          <Truck className="size-4 shrink-0" aria-hidden="true" />
          {transportActive
            ? 'A vehicle request is active for this date. Manage it with "Request Transport" in the schedule list.'
            : transportType === 'external_transporter'
              ? 'After saving, use "Request Transport" on this date in the schedule list to choose a vehicle.'
              : 'Choose "External Transporter" if you need to book a vehicle from a Travi transporter.'}
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading || isCancelled || !range?.from || !range?.to}
        className="w-full"
      >
        {loading && <Loader2 className="animate-spin" />}
        {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Schedule' : 'Add Schedule')}
      </Button>
    </CardBox>
    </form>

    {isEdit && (
      <CancelScheduleDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        scheduleId={initialData.id}
        tourId={tourId}
      />
    )}
    </>
  );
}
