import { z } from 'zod';

// zod schemas for the admin console tooling (Phase 3.11): users, payouts, payment reviews,
// tour moderation, finance filters and CSV exports.

export const uuidSchema = z.string().uuid('Invalid id');

export const ROLE_VALUES = ['admin', 'traveler', 'organizer', 'transporter'] as const;
export type RoleValue = (typeof ROLE_VALUES)[number];

export const modifyUserRoleSchema = z.object({
  userProfileId: uuidSchema,
  role: z.enum(ROLE_VALUES),
  operation: z.enum(['grant', 'revoke']),
});

export const suspendUserSchema = z.object({
  userProfileId: uuidSchema,
  suspend: z.boolean(),
  reason: z.string().trim().max(500).optional(),
}).refine((v) => !v.suspend || (v.reason && v.reason.length >= 3), {
  message: 'Give a reason for the suspension (at least 3 characters).',
  path: ['reason'],
});

export const payoutReferenceSchema = z.string().trim().min(1, 'Reference number is required').max(100);
export const payoutReasonSchema = z.string().trim().max(500).optional();

export const resolvePaymentReviewSchema = z.object({
  paymentId: uuidSchema,
  note: z.string().trim().min(3, 'Add a note (at least 3 characters).').max(1000),
});

export const unpublishTourSchema = z.object({
  tourId: uuidSchema,
  reason: z.string().trim().min(3, 'Give a reason (at least 3 characters).').max(1000),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

// Finance range / export filters (Manila dates, inclusive). Both optional.
export const dateRangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
}).refine((v) => !v.from || !v.to || v.from <= v.to, { message: '"From" must be on or before "To".', path: ['from'] });

export const TRANSPORT_STATUSES = ['pending', 'accepted', 'declined', 'canceled', 'completed'] as const;
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number];

export const EXPORT_KINDS = ['bookings', 'payments', 'refunds', 'payouts', 'ledger'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export const exportKindSchema = z.enum(EXPORT_KINDS);

// Users search: letters, digits and the characters that appear in names/emails. Anything else is
// dropped so the value is safe inside a PostgREST .or() filter string (AGENTS.md §5.4).
export function sanitizeSearch(value: string | undefined | null, max = 80): string {
  return (value ?? '').replace(/[^\p{L}\p{N}@._+\- ]/gu, '').trim().slice(0, max);
}

export function pageNumber(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
