import { Bus, Calendar, MapPin, Users, Mail, Phone } from 'lucide-react';
import { formatBusinessDate, formatManilaDateTime, formatManilaTime } from '@/lib/datetime';
import type { TransportPartyView, TransportRequestView } from '@/lib/schemas/transport';

const label = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

/** Vehicle / dates / route / passengers grid shared by the transporter and organizer request lists. */
export function TransportRequestDetails({ request }: { request: TransportRequestView }) {
  const sameDay =
    request.returnDatetime &&
    formatManilaDateTime(request.returnDatetime, { dateStyle: 'medium' }) ===
      formatManilaDateTime(request.pickupDatetime, { dateStyle: 'medium' });

  return (
    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <span className={label}>Vehicle</span>
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Bus className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>{request.vehicle?.name || 'Vehicle unavailable'}</span>
        </div>
        {request.vehicle?.plateNumber && (
          <span className="font-mono text-xs text-muted-foreground">{request.vehicle.plateNumber}</span>
        )}
      </div>

      <div className="space-y-1">
        <span className={label}>Pickup and return (Manila time)</span>
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Calendar className="size-4 shrink-0 text-secondary" aria-hidden="true" />
          <span>{formatManilaDateTime(request.pickupDatetime)}</span>
        </div>
        <div className="pl-6 text-xs text-muted-foreground">
          <span className="font-semibold">Return:</span>{' '}
          {request.returnDatetime ? (
            sameDay ? formatManilaTime(request.returnDatetime) : formatManilaDateTime(request.returnDatetime)
          ) : (
            <span className="italic">Not set</span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <span className={label}>Route</span>
        <div className="flex items-center gap-2 font-medium text-foreground">
          <MapPin className="size-4 shrink-0 text-success" aria-hidden="true" />
          <span className="line-clamp-1">{request.pickupLocation}</span>
        </div>
        <div className="line-clamp-1 pl-6 text-xs text-muted-foreground">to {request.dropoffLocation}</div>
      </div>

      <div className="space-y-1">
        <span className={label}>Passengers</span>
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{request.seatsRequired} passengers</span>
        </div>
        <p className="text-xs text-muted-foreground">Payment is arranged directly between you, off-platform.</p>
      </div>

      {request.schedule && (
        <div className="rounded-md bg-muted/50 p-3 text-xs text-bodytext md:col-span-2 lg:col-span-4">
          <span className="font-semibold text-foreground">Tour:</span>{' '}
          {request.schedule.tourTitle || 'Tour schedule'}
          {request.schedule.tourLocation && <span className="text-muted-foreground"> ({request.schedule.tourLocation})</span>}
          <span className="text-muted-foreground">
            {' '}
            · {formatBusinessDate(request.schedule.startDate)}
            {request.schedule.endDate && request.schedule.endDate !== request.schedule.startDate
              ? ` to ${formatBusinessDate(request.schedule.endDate)}`
              : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** Phone and email links for the other party, when the server included them. */
export function TransportContact({ party }: { party: TransportPartyView | null }) {
  if (!party?.phone && !party?.email) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {party.phone && (
        <a href={`tel:${party.phone}`} className="flex items-center gap-1 transition-colors hover:text-primary">
          <Phone className="size-3.5" aria-hidden="true" />
          <span>{party.phone}</span>
        </a>
      )}
      {party.email && (
        <a href={`mailto:${party.email}`} className="flex items-center gap-1 transition-colors hover:text-primary">
          <Mail className="size-3.5" aria-hidden="true" />
          <span>{party.email}</span>
        </a>
      )}
    </div>
  );
}
