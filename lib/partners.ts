import { z } from 'zod';

// Server-side helpers shared by the partner Server Actions (organizer, transporter, vehicles,
// partner documents and admin review). Not a 'use server' module.

/** User-safe message for a caught error (zod v4: first issue). */
export function partnerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Text field from FormData: undefined when missing, trimmed string otherwise. */
export function formText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/** "Cebu, Bohol" → ['Cebu', 'Bohol'] */
export function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Postgres error from the KYC lock trigger / company-name CHECK → user-safe message. */
export function partnerDbErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  const message = error?.message ?? '';
  if (message.includes('can no longer be changed')) {
    return 'Verified business details can no longer be changed. Contact support to update them.';
  }
  if (message.includes('company_name_required')) return 'Company name is required for registered companies.';
  if (message.includes('must be approved before you can publish')) {
    return 'Your organizer account must be approved before you can publish tours.';
  }
  return fallback;
}

export type PartnerStatus = 'pending' | 'approved' | 'rejected';
