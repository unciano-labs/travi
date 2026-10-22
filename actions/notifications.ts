'use server';

import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { supabase, user } = await requireSession();
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      captureException(error, { action: 'markNotificationAsRead' });
    }
  } catch (err: any) {
    captureException(err, { action: 'markNotificationAsRead exception' });
  }
}

export async function getUnreadNotifications() {
  try {
    const { supabase, user } = await requireSession();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getUnreadNotifications' });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getUnreadNotifications exception' });
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
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getAllNotifications' });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getAllNotifications exception' });
    return [];
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const { supabase, user } = await requireSession();
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      captureException(error, { action: 'markAllNotificationsAsRead' });
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'markAllNotificationsAsRead exception' });
    return { success: false, error: err.message };
  }
}
