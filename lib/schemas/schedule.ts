import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

// Empty form fields arrive as '' and mean "not set".
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

export const scheduleFormSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    capacity: z.coerce.number().int('Capacity must be a whole number').min(1, 'Capacity must be at least 1').max(1000, 'Capacity is too large'),
    price_per_person: optional(z.coerce.number().positive('Selling price must be more than zero').max(10_000_000)),
    original_price: optional(z.coerce.number().positive('Original price must be more than zero').max(10_000_000)),
    // Vehicles are requested separately (sendTransportRequest in actions/transport-requests.ts).
    transport_type: z.enum(['none', 'self_provided', 'external_transporter']).default('none'),
  })
  .refine((s) => s.endDate >= s.startDate, { message: 'The end date must be on or after the start date.', path: ['endDate'] });

export type ScheduleFormInput = z.infer<typeof scheduleFormSchema>;

/** FormData from ScheduleForm → validated input. Throws ZodError. */
export function parseScheduleForm(formData: FormData): ScheduleFormInput {
  const raw: Record<string, unknown> = {};
  for (const key of ['startDate', 'endDate', 'capacity', 'price_per_person', 'original_price', 'transport_type']) {
    const value = formData.get(key);
    if (typeof value === 'string') raw[key] = value;
  }
  return scheduleFormSchema.parse(raw);
}

export const scheduleIdsSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule'),
  tourId: z.string().uuid('Invalid tour'),
});

export const cancelScheduleSchema = scheduleIdsSchema.extend({
  reason: z.string().trim().max(500).optional(),
});
