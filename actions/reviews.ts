'use server';

import { revalidatePath } from 'next/cache';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { assertRateLimit } from '@/lib/ratelimit';

export async function hideReview(reviewId: string) {
  let success = false;

  try {
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const admin = createAdminClient({ admin: true });

    // Update the review status
    const { error: updateError } = await admin
      .from('reviews')
      .update({ status: 'hidden' })
      .eq('id', reviewId);

    if (updateError) {
      throw updateError;
    }

    // Log the audit action
    await admin.from('admin_audit_logs').insert({
      admin_profile_id: profile.id,
      entity_type: 'review',
      entity_id: reviewId,
      action: 'hide',
      notes: 'Review hidden by admin manually via dashboard.',
    });

    success = true;
  } catch (err: any) {
    captureException(err, { action: 'hideReview exception' });
    return { success: false, error: err.message };
  }

  if (success) {
    revalidatePath('/admin/reviews');
    return { success: true };
  }
}
