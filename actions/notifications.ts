'use server';

import { z } from 'zod';
import { unstable_rethrow } from 'next/navigation';
import { requireSession } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';

// Notifications belong to the signed-in user (any role): every query is scoped by
// user_id = auth user id, on top of the RLS owner policy. Users may only flip is_read
// (the notifications_guard_columns trigger blocks every other column).

const notificationIdSchema = z.string().uuid();

type MutationResult = { success: true } | { success: false; error: string };

export async function markNotificationAsRead(notificationId: unknown): Promise<MutationResult> {
  try {
    const id = notificationIdSchema.parse(notificationId);
    const { supabase, user, profile } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;

    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'markNotificationAsRead' });
    return { success: false, error: error instanceof z.ZodError ? 'Invalid notification.' : 'Could not update the notification.' };
  }
}

export async function markAllNotificationsAsRead(): Promise<MutationResult> {
  try {
    const { supabase, user, profile } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) throw error;

    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'markAllNotificationsAsRead' });
    return { success: false, error: 'Could not update notifications.' };
  }
}

// Readers return [] on failure (the bell and the admin list render an empty state).
// unstable_rethrow first: getAllNotifications runs during render (AGENTS.md §3.3).

export async function getUnreadNotifications() {
  try {
    const { supabase, user } = await requireSession();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(100); // the bell shows "99+" above 99
    if (error) throw error;
    return data ?? [];
  } catch (error: unknown) {
    unstable_rethrow(error);
    captureException(error, { action: 'getUnreadNotifications' });
    return [];
  }
}

export async function getAllNotifications() {
  try {
    const { supabase, user } = await requireSession();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  } catch (error: unknown) {
    unstable_rethrow(error);
    captureException(error, { action: 'getAllNotifications' });
    return [];
  }
}
