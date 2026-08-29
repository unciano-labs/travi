'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { revalidatePath, updateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { notifyOrganizerAccountStatus, notifyTransporterAccountStatus } from './notifications';

import { idSchema, rejectSchema, moderateReviewSchema, modifyRoleSchema } from '@/lib/schemas/admin';

/**
 * Approve an organizer application.
 */
export async function approveOrganizer(organizerId: string) {
  try {
    const validatedId = idSchema.parse(organizerId);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const admin = createAdminClient({ admin: true });

    const { error } = await admin
      .from('organizer_profiles')
      .update({ status: 'approved' })
      .eq('id', validatedId);

    if (error) return { success: false, error: error.message };

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'organizer',
      entityId: validatedId,
      action: 'approve',
      notes: 'Organizer application approved by admin',
      diff: { status: 'approved' },
    });

    await notifyOrganizerAccountStatus(validatedId, 'activated');

    updateTag('organizers');
    updateTag('platform-stats');
    revalidatePath('/admin/organizers');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'approveOrganizer', organizerId });
    return { success: false, error: error.message || 'Failed to approve organizer' };
  }
}

/**
 * Reject an organizer application.
 */
export async function rejectOrganizer(organizerId: string, reason?: string) {
  try {
    const validated = rejectSchema.parse({ id: organizerId, reason });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { error } = await supabase
      .from('organizer_profiles')
      .update({ status: 'rejected' })
      .eq('id', validated.id);

    if (error) return { success: false, error: error.message };

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'organizer',
      entityId: validated.id,
      action: 'reject',
      notes: validated.reason ? `Rejected with reason: ${validated.reason}` : 'Organizer application rejected',
      diff: { status: 'rejected' },
    });

    updateTag('organizers');
    updateTag('platform-stats');
    revalidatePath('/admin/organizers');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'rejectOrganizer', organizerId, reason });
    return { success: false, error: error.message || 'Failed to reject organizer' };
  }
}

/**
 * Approve a transporter application.
 */
export async function approveTransporter(transporterId: string) {
  try {
    const validatedId = idSchema.parse(transporterId);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const admin = createAdminClient({ admin: true });

    const { error } = await admin
      .from('transporter_profiles')
      .update({ status: 'approved' })
      .eq('id', validatedId);

    if (error) return { success: false, error: error.message };

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transporter',
      entityId: validatedId,
      action: 'approve',
      notes: 'Transporter application approved by admin',
      diff: { status: 'approved' },
    });

    await notifyTransporterAccountStatus(validatedId, 'activated');

    updateTag('transporters');
    updateTag('platform-stats');
    revalidatePath('/admin/transporters');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'approveTransporter', transporterId });
    return { success: false, error: error.message || 'Failed to approve transporter' };
  }
}

/**
 * Reject a transporter application.
 */
export async function rejectTransporter(transporterId: string, reason?: string) {
  try {
    const validated = rejectSchema.parse({ id: transporterId, reason });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const admin = createAdminClient({ admin: true });

    const { error } = await admin
      .from('transporter_profiles')
      .update({ status: 'rejected' })
      .eq('id', validated.id);

    if (error) return { success: false, error: error.message };

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transporter',
      entityId: validated.id,
      action: 'reject',
      notes: validated.reason ? `Rejected with reason: ${validated.reason}` : 'Transporter application rejected',
      diff: { status: 'rejected' },
    });

    await notifyTransporterAccountStatus(validated.id, 'deactivated', validated.reason);

    updateTag('transporters');
    updateTag('platform-stats');
    revalidatePath('/admin/transporters');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'rejectTransporter', transporterId, reason });
    return { success: false, error: error.message || 'Failed to reject transporter' };
  }
}

/**
 * Moderate a user review (hide, publish, or delete).
 */
export async function moderateReview(reviewId: string, action: 'hide' | 'publish' | 'delete') {
  try {
    const validated = moderateReviewSchema.parse({ reviewId, action });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    if (validated.action === 'delete') {
      const { error } = await supabase
        .from('reviews')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'hidden',
        })
        .eq('id', validated.reviewId);
      if (error) return { success: false, error: error.message };
    } else {
      const newStatus = validated.action === 'hide' ? 'hidden' : 'published';
      const { error } = await supabase
        .from('reviews')
        .update({ status: newStatus })
        .eq('id', validated.reviewId);

      if (error) return { success: false, error: error.message };
    }

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'review',
      entityId: validated.reviewId,
      action: validated.action,
      notes: `Review moderation action: ${validated.action}`,
      diff: { action: validated.action },
    });

    updateTag('reviews');
    updateTag('platform-stats');
    revalidatePath('/admin/reviews');
    return { success: true };
  } catch (error: any) {
    captureException(error, { handler: 'moderateReview', reviewId, targetAction: action });
    return { success: false, error: error.message || 'Failed to moderate review' };
  }
}

/**
 * Modify a user's role on the platform.
 */
export async function modifyUserRole(
  userProfileId: string,
  role: 'admin' | 'traveler' | 'organizer' | 'transporter',
  operation: 'grant' | 'revoke'
) {
  try {
    const validated = modifyRoleSchema.parse({ userProfileId, role, operation });
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const adminSupabase = createAdminClient({ admin: true });

    // Fetch the website role ID
    const { data: roleData, error: roleError } = await adminSupabase
      .from('website_roles')
      .select('id')
      .eq('role', validated.role)
      .single();

    if (roleError || !roleData) {
      return { success: false, error: `Role '${validated.role}' not found for website.` };
    }

    if (validated.operation === 'grant') {
      const { error } = await adminSupabase.from('user_roles').insert({
        user_profile_id: validated.userProfileId,
        website_role_id: roleData.id,
      });

      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await adminSupabase
        .from('user_roles')
        .delete()
        .eq('user_profile_id', validated.userProfileId)
        .eq('website_role_id', roleData.id);

      if (error) return { success: false, error: error.message };
    }

    // Record audit log
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'user_role',
      entityId: validated.userProfileId,
      action: validated.operation === 'grant' ? 'grant_role' : 'revoke_role',
      notes: `${validated.operation.toUpperCase()} role '${validated.role}' for user profile ${validated.userProfileId}`,
      diff: { role: validated.role, operation: validated.operation },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'modifyUserRole', userProfileId, role, operation });
    return { success: false, error: error.message || 'Failed to modify user role' };
  }
}

/**
 * Mark a payout request as paid and update the ledger.
 */
export async function markPayoutPaid(payoutId: string, walletId: string) {
  try {
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');

    const admin = createAdminClient({ admin: true });

    // Mark as paid
    const { error: payoutError } = await admin
      .from('payout_requests')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', payoutId)
      .eq('status', 'pending');

    if (payoutError) throw payoutError;

    // Create completed ledger entry
    const { data: request } = await admin.from('payout_requests').select('amount').eq('id', payoutId).single();
    
    if (request) {
      await admin.from('wallet_transactions').insert({
        wallet_id: walletId,
        amount: request.amount,
        type: 'withdrawal_completed',
        balance_affected: 'available',
        reference_type: 'payout',
        reference_id: payoutId,
        description: 'Payout request fulfilled'
      });
    }

    revalidatePath('/admin/payouts');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'markPayoutPaid', payoutId });
    return { success: false, error: error.message || 'Failed to mark payout as paid' };
  }
}
