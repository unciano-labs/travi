import { z } from 'zod';

// Transport coordination (decision D2): organizers request a vehicle for a schedule, transporters
// accept or decline, availability blocks keep calendars honest. Status values mirror the DB CHECKs.
export const TRANSPORT_STATUSES = ['pending', 'accepted', 'declined', 'canceled', 'completed'] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date (YYYY-MM-DD)');
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid time (HH:mm)');
const place = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(200, `${label} must be 200 characters or less`);

export const transportRequestIdSchema = z.object({
  requestId: z.string().uuid('Invalid transport request ID'),
});

export const declineTransportRequestSchema = transportRequestIdSchema.extend({
  reason: z.string().trim().max(500, 'Keep the reason under 500 characters').optional(),
});

export const transportStatusFilterSchema = z.enum(['all', ...TRANSPORT_STATUSES]).optional();

/**
 * Organizer → transporter request. Dates come from the schedule on the server; the organizer picks
 * Manila wall-clock pickup and return times. The transporter and seat count are derived server-side.
 */
export const sendTransportRequestSchema = z.object({
  tourScheduleId: z.string().uuid('Invalid schedule ID'),
  vehicleId: z.string().uuid('Select a vehicle'),
  pickupLocation: place('Pickup location'),
  dropoffLocation: place('Dropoff location'),
  pickupTime: clockTime,
  returnTime: clockTime.default('17:00'),
});

export const blockVehicleDatesSchema = z
  .object({
    vehicleId: z.string().uuid('Select a vehicle'),
    startDate: isoDate,
    endDate: isoDate,
    notes: z
      .string()
      .trim()
      .max(300, 'Keep the note under 300 characters')
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'The start date cannot be after the end date.',
    path: ['endDate'],
  });

export const availabilityIdSchema = z.object({
  availabilityId: z.string().uuid('Invalid availability ID'),
});

export const vehicleFilterSchema = z.string().uuid('Invalid vehicle ID').optional();

export type SendTransportRequestInput = z.input<typeof sendTransportRequestSchema>;
export type BlockVehicleDatesInput = z.input<typeof blockVehicleDatesSchema>;

// ─── View models passed from the server to the dashboard clients ───

export interface TransportPartyView {
  id: string;
  name: string;
  /** Only filled in when the request status allows contact (see actions/transport-requests.ts). */
  phone: string | null;
  email: string | null;
}

export interface TransportRequestView {
  id: string;
  status: TransportStatus;
  createdAt: string;
  pickupLocation: string;
  dropoffLocation: string;
  /** ISO timestamps; display them in Manila time (lib/datetime formatManila*). */
  pickupDatetime: string;
  returnDatetime: string | null;
  seatsRequired: number;
  /** Manila date (YYYY-MM-DD) from which the trip can be marked complete. */
  completableFrom: string;
  vehicle: { id: string; name: string; vehicleType: string | null; plateNumber: string | null; seatCapacity: number | null } | null;
  schedule: { id: string; startDate: string; endDate: string | null; tourId: string | null; tourTitle: string | null; tourLocation: string | null } | null;
  /** The other side: the organizer for a transporter, the transporter for an organizer. */
  counterparty: TransportPartyView | null;
}

export interface AvailabilityView {
  id: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  status: 'available' | 'booked' | 'blocked';
  notes: string | null;
  vehicle: { id: string; name: string; vehicleType: string | null; plateNumber: string | null } | null;
  booking: { organizerName: string | null; pickupLocation: string; dropoffLocation: string } | null;
}
