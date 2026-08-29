import { z } from 'zod';

export const createBookingSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule ID'),
  seats: z.number().int().min(1, 'Must book at least 1 seat')
});
