'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { ZodError } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { notifySuperAdmin } from '@/lib/notifications';
import { createReviewSchema, reviewModerationSchema, type ReviewModerationAction } from '@/lib/schemas/review';

type ActionResult<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

/**
 * Traveler review for a completed booking (BIZ-20). Inserted as `pending` with the traveler's own
 * RLS client, so the database policy (can_review_booking + unique booking_id) is the real guard;
 * the pre-checks below only produce friendlier messages.
 */
export async function createReview(input: unknown): Promise<ActionResult> {
  try {
    const data = createReviewSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, tour_schedules ( tour_id )')
      .eq('id', data.bookingId)
      .eq('traveler_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (bookingError) throw bookingError;
    if (!booking) return { success: false, error: 'Booking not found.' };
    if (booking.status !== 'completed') {
      return { success: false, error: 'You can leave a review once your trip is completed.' };
    }

    const schedule = booking.tour_schedules as unknown as { tour_id: string } | { tour_id: string }[] | null;
    const tourId = Array.isArray(schedule) ? schedule[0]?.tour_id : schedule?.tour_id;
    if (!tourId) return { success: false, error: 'Booking not found.' };

    const { error: insertError } = await supabase.from('reviews').insert({
      reviewer_profile_id: profile.id,
      booking_id: booking.id,
      tour_id: tourId,
      rating: data.rating,
      comment: data.comment,
      status: 'pending',
    });

    if (insertError) {
      if (insertError.code === '23505') return { success: false, error: "You've already reviewed this trip." };
      if (insertError.code === '42501') return { success: false, error: 'This booking is not eligible for a review.' };
      throw insertError;
    }

    await notifySuperAdmin(
      'New review to moderate',
      'A traveler submitted a review that is waiting for approval.',
      'review',
      '/admin/reviews'
    );

    revalidatePath('/dashboard/traveler/bookings');
    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'createReview' });
    return { success: false, error: errorMessage(error, 'Failed to submit your review') };
  }
}

const MODERATION: Record<ReviewModerationAction, { status: 'published' | 'hidden'; softDelete: boolean; notes: string }> = {
  publish: { status: 'published', softDelete: false, notes: 'Review published by admin' },
  hide: { status: 'hidden', softDelete: false, notes: 'Review hidden by admin' },
  delete: { status: 'hidden', softDelete: true, notes: 'Review deleted (soft) by admin' },
};

// Not exported: only the three admin actions below are endpoints.
async function moderate(reviewId: unknown, action: ReviewModerationAction): Promise<ActionResult<{ status: 'published' | 'hidden'; deleted: boolean }>> {
  try {
    const data = reviewModerationSchema.parse({ reviewId, action });
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    // Service role: admin console write (authorized above, audited below).
    const admin = createAdminClient({ admin: true });
    const { data: current, error: readError } = await admin
      .from('reviews')
      .select('id, status, transporter_id')
      .eq('id', data.reviewId)
      .is('deleted_at', null)
      .maybeSingle();

    if (readError) throw readError;
    if (!current) return { success: false, error: 'Review not found.' };

    const rule = MODERATION[data.action];
    const patch: { status: 'published' | 'hidden'; deleted_at?: string } = { status: rule.status };
    if (rule.softDelete) patch.deleted_at = new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from('reviews')
      .update(patch)
      .eq('id', data.reviewId)
      .is('deleted_at', null)
      .select('id');

    if (updateError) throw updateError;
    if (!updated || updated.length === 0) return { success: false, error: 'Review not found.' };

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'review',
      entityId: data.reviewId,
      action: data.action,
      notes: rule.notes,
      diff: { from: current.status, to: rule.status, deleted: rule.softDelete },
    });

    updateTag('reviews');
    updateTag('tours');
    updateTag('platform-stats');
    if (current.transporter_id) updateTag('transporters');
    revalidatePath('/admin/reviews');
    revalidatePath('/dashboard/transporter/reviews');
    return { success: true, status: rule.status, deleted: rule.softDelete };
  } catch (error: unknown) {
    captureException(error, { action: `${action}Review`, reviewId: typeof reviewId === 'string' ? reviewId : undefined });
    return { success: false, error: errorMessage(error, 'Failed to update the review') };
  }
}

export async function publishReview(reviewId: string) {
  return moderate(reviewId, 'publish');
}

export async function hideReview(reviewId: string) {
  return moderate(reviewId, 'hide');
}

export async function deleteReview(reviewId: string) {
  return moderate(reviewId, 'delete');
}
