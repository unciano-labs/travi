import type { SupabaseClient } from '@supabase/supabase-js';
import { captureException } from '@/lib/logger';

/**
 * SEC-13: organizers no longer read travelers' user_profiles rows. This attaches
 * `user_profiles: { full_name, email }` to each booking from organizer_traveler_contacts()
 * (20261025090000): the name always, the email only when the traveler has a confirmed or completed
 * booking with this organizer. Call with the organizer's own (RLS) client.
 */
export async function attachTravelerContacts<T extends { traveler_id?: string | null }>(
  supabase: SupabaseClient,
  bookings: T[]
): Promise<(T & { user_profiles: { full_name: string | null; email: string | null } | null })[]> {
  const ids = [...new Set(bookings.map((b) => b.traveler_id).filter((v): v is string => Boolean(v)))];
  const contacts = new Map<string, { full_name: string | null; email: string | null }>();

  if (ids.length > 0) {
    const { data, error } = await supabase.rpc('organizer_traveler_contacts', { p_traveler_ids: ids });
    if (error) {
      captureException(error, { action: 'attachTravelerContacts' });
    } else {
      for (const row of (data ?? []) as { traveler_id: string; full_name: string | null; email: string | null }[]) {
        contacts.set(row.traveler_id, { full_name: row.full_name, email: row.email });
      }
    }
  }

  return bookings.map((b) => ({ ...b, user_profiles: (b.traveler_id && contacts.get(b.traveler_id)) || null }));
}
