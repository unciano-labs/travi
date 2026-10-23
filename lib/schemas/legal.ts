import { z } from 'zod';
import { emailSchema } from '@/lib/schemas/auth';

// Phase 4 (LEG-01/02/05/06/10, OPS-05). Mirrors supabase/migrations/20261026090000_legal_consent_privacy_support.sql.

/** A required consent checkbox from FormData ("on") or a boolean argument. */
export const acceptedCheckboxSchema = z.preprocess(
  (v) => v === true || v === 'on' || v === 'true',
  z.literal(true, { error: 'Please accept the terms to continue.' })
);

// ─── Data subject requests (RA 10173) ───

export const DATA_REQUEST_TYPES = ['deletion', 'access', 'correction'] as const;
export const DATA_REQUEST_STATUSES = ['open', 'in_progress', 'completed', 'rejected'] as const;
export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number];
export type DataRequestStatus = (typeof DATA_REQUEST_STATUSES)[number];

export const DATA_REQUEST_LABELS: Record<DataRequestType, string> = {
  deletion: 'Account deletion',
  access: 'Access to my data',
  correction: 'Correction of my data',
};

export const dataRequestSchema = z.object({
  type: z.enum(DATA_REQUEST_TYPES),
  details: z
    .string()
    .trim()
    .max(2000, 'Please keep the details under 2,000 characters')
    .optional()
    .transform((v) => (v ? v : null)),
});

export const updateDataRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(DATA_REQUEST_STATUSES),
  note: z.string().trim().max(2000).optional().transform((v) => (v ? v : null)),
});

// ─── Support messages (/contact) ───

export const SUPPORT_TOPICS = [
  'booking',
  'payment_refund',
  'complaint_organizer',
  'complaint_transporter',
  'partner',
  'privacy',
  'other',
] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  booking: 'A booking',
  payment_refund: 'Payment or refund',
  complaint_organizer: 'Complaint about an organizer',
  complaint_transporter: 'Complaint about a transporter',
  partner: 'Becoming or being a partner',
  privacy: 'Privacy or my personal data',
  other: 'Something else',
};

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const supportMessageSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120, 'Name is too long'),
  email: emailSchema,
  topic: z.enum(SUPPORT_TOPICS, { error: 'Please choose a topic' }),
  bookingRef: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^BK-[0-9A-F]{6}$/, 'Booking references look like BK-1A2B3C').nullable()),
  message: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more (at least 10 characters)')
    .max(5000, 'Please keep your message under 5,000 characters'),
});
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;

export const updateSupportMessageSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(SUPPORT_STATUSES),
  note: z.string().trim().max(2000).optional().transform((v) => (v ? v : null)),
});
