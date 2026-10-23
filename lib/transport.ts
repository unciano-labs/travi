// Server-only helpers for transport coordination (actions/transport-requests.ts, actions/availability.ts).
// Deliberately not Server Actions: exported 'use server' functions are public endpoints (AGENTS.md §3.2).
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { manilaDateOf } from '@/lib/datetime';

/** `code: 'CONFLICT'` is the action-level 409: the vehicle is already booked or blocked. */
export type TransportFailure = { success: false; error: string; code?: 'CONFLICT' };

/** Thrown for expected business-rule failures; the message is safe to show to the user. */
export class TransportError extends Error {
  constructor(message: string, readonly code?: 'CONFLICT') {
    super(message);
    this.name = 'TransportError';
  }
}

// Messages thrown by lib/auth-helpers and lib/ratelimit that are written for the user.
const SAFE_PREFIXES = ['Unauthorized', 'Forbidden', 'Too many requests', 'User profile not found'];

/** Turn any caught error into the action failure shape without leaking database internals. */
export function toTransportFailure(error: unknown, fallback: string): TransportFailure {
  if (error instanceof TransportError) {
    return error.code ? { success: false, error: error.message, code: error.code } : { success: false, error: error.message };
  }
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && SAFE_PREFIXES.some((prefix) => error.message.startsWith(prefix))) {
    return { success: false, error: error.message };
  }
  return { success: false, error: fallback };
}

/** Throw the mapped TransportError for a known database guard, or the raw error otherwise. */
export function throwTransportDbError(error: DbError): never {
  throw transportDbError(error) ?? error;
}

/** Expected failures (bad input, business rules) are not reported to Sentry. */
export function isExpectedTransportError(error: unknown): boolean {
  return error instanceof TransportError || error instanceof ZodError;
}

interface DbError {
  code?: string;
  message?: string;
}

/**
 * Map the database's transport guards (20261025110000_transport_coordination.sql and the Phase 1
 * RLS triggers) to user-safe errors. Returns null for unexpected errors, which callers report.
 */
export function transportDbError(error: DbError | null | undefined): TransportError | null {
  if (!error) return null;
  switch (error.code) {
    case '23P01': // vehicle already booked/blocked on those dates
      return new TransportError('This vehicle is already booked or blocked for those dates.', 'CONFLICT');
    case '55000': // lifecycle rule (inactive vehicle, cancelled schedule, completion date, frozen dates)
    case '23514': // date order
      return new TransportError(error.message || 'This change is not allowed right now.');
    case '42501':
      return new TransportError('You are not allowed to make this change to the transport request.');
    default:
      return null;
  }
}

/** Last Manila date a transport booking occupies: the return date, or the pickup date. */
export function transportEndDate(pickupDatetime: string, returnDatetime: string | null): string {
  return manilaDateOf(returnDatetime ?? pickupDatetime);
}

/**
 * Date from which a trip can be marked complete: the later of the schedule's end date and the
 * transport's own end date. Mirrors transport_bookings_lifecycle_check() in the database.
 */
export function transportCompletableFrom(
  scheduleEndDate: string | null | undefined,
  pickupDatetime: string,
  returnDatetime: string | null
): string {
  const own = transportEndDate(pickupDatetime, returnDatetime);
  return scheduleEndDate && scheduleEndDate > own ? scheduleEndDate : own;
}

export async function requireOwnTransporterId(supabase: SupabaseClient, userProfileId: string): Promise<string> {
  const { data, error } = await supabase
    .from('transporter_profiles')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new TransportError('Transporter profile not found.');
  return data.id as string;
}

export async function requireOwnOrganizerId(supabase: SupabaseClient, userProfileId: string): Promise<string> {
  const { data, error } = await supabase
    .from('organizer_profiles')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new TransportError('Organizer profile not found.');
  return data.id as string;
}

export interface PartnerContact {
  phone: string | null;
  email: string | null;
}

/**
 * Phone and account email of the counterparties of the caller's ACCEPTED requests. Callers must
 * pass only partner ids taken from requests they already read under RLS.
 */
export async function loadPartnerContacts(
  table: 'organizer_profiles' | 'transporter_profiles',
  ids: string[]
): Promise<Map<string, PartnerContact>> {
  const contacts = new Map<string, PartnerContact>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return contacts;

  // Service role: a partner's account email lives in user_profiles, which is readable only by its
  // owner under RLS. Limited to counterparties of the caller's own accepted requests (AGENTS.md §5.3).
  const { data, error } = await createAdminClient({ admin: true })
    .from(table)
    .select('id, phone, user_profile:user_profiles ( email )')
    .in('id', unique);
  if (error) throw error;

  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    phone: string | null;
    user_profile: { email: string | null } | { email: string | null }[] | null;
  }>) {
    const profile = Array.isArray(row.user_profile) ? row.user_profile[0] : row.user_profile;
    contacts.set(row.id, { phone: row.phone ?? null, email: profile?.email ?? null });
  }
  return contacts;
}
