import { z } from 'zod';

export const createBookingSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule ID'),
  // Private tours ignore this: the database books the whole group (decision D3).
  seats: z.number().int().min(1, 'Must book at least 1 seat').max(500, 'Too many seats'),
});

export const bookingIdSchema = z.string().uuid('Invalid booking ID');

export const DISPUTE_REASON_MIN = 20;
export const DISPUTE_REASON_MAX = 2000;

// Mirrors open_booking_dispute() in 20261025100000_booking_guards_private_disputes.sql.
export const openDisputeSchema = z.object({
  bookingId: bookingIdSchema,
  reason: z
    .string()
    .trim()
    .min(DISPUTE_REASON_MIN, `Please describe the problem in at least ${DISPUTE_REASON_MIN} characters.`)
    .max(DISPUTE_REASON_MAX, `Please keep the description under ${DISPUTE_REASON_MAX} characters.`),
});

export const resolveDisputeSchema = z.object({
  bookingId: bookingIdSchema,
  decision: z.enum(['refund', 'deny']),
});

// Admin "Cancel & refund" (OPS-06). Omit `amount` for a full refund. Pesos, at most 2 decimals.
export const adminCancelBookingSchema = z.object({
  bookingId: bookingIdSchema,
  amount: z
    .number()
    .positive('Refund amount must be more than zero.')
    .max(10_000_000)
    .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use at most two decimals.')
    .optional(),
  reason: z.string().trim().min(5, 'Please give a short reason (at least 5 characters).').max(500),
});
