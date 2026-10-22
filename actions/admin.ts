'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { revalidatePath, updateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { notifyOrganizerAccountStatus, notifyTransporterAccountStatus } from '@/lib/notifications';
import { escapeHtml, sendEmail } from '@/lib/email';

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
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    // Service role: admins have no UPDATE policy on organizer_profiles, and status is server-owned.
    const admin = createAdminClient({ admin: true });
    const { data: updated, error } = await admin
      .from('organizer_profiles')
      .update({ status: 'rejected' })
      .eq('id', validated.id)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!updated || updated.length === 0) return { success: false, error: 'Organizer not found.' };

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

const payoutIdSchema = z.string().uuid();
const payoutReferenceSchema = z.string().trim().min(1, 'Reference number is required').max(100);
const payoutReasonSchema = z.string().trim().max(500).optional();

async function payoutRecipient(admin: ReturnType<typeof createAdminClient>, walletId: string) {
  const { data } = await admin.from('user_wallets').select('user_profiles(full_name, email)').eq('id', walletId).single();
  const p = Array.isArray(data?.user_profiles) ? data?.user_profiles[0] : data?.user_profiles;
  return p as { full_name: string | null; email: string | null } | undefined;
}

/**
 * Mark a payout request as paid (after the money was sent outside Travi).
 * mark_payout_paid() only succeeds once per pending payout and derives the wallet from the request.
 */
export async function markPayoutPaid(payoutId: string, referenceNumber: string) {
  try {
    const id = payoutIdSchema.parse(payoutId);
    const reference = payoutReferenceSchema.parse(referenceNumber);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    // Service role: payout state + ledger + audit in one database transaction (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: walletId, error } = await admin.rpc('mark_payout_paid', {
      p_payout_id: id,
      p_admin_profile_id: profile.id,
      p_reference: reference,
    });
    if (error) throw new Error(error.message);

    const { data: request } = await admin.from('payout_requests').select('amount').eq('id', id).single();
    const recipient = await payoutRecipient(admin, walletId as string);
    if (recipient?.email) {
      await sendEmail({
        to: recipient.email,
        subject: 'Payout Request Completed',
        html: `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2>Payout Completed</h2>
            <p>Hi ${escapeHtml(recipient.full_name ?? '')},</p>
            <p>Your recent payout request for <strong>₱${Number(request?.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> has been successfully processed!</p>
            <p><strong>Reference Number:</strong> ${escapeHtml(reference)}</p>
            <p>The funds should reflect in your account shortly, depending on your bank's processing times.</p>
            <p>Thank you,<br/>Travi Support</p>
          </div>
        `
      });
    }

    revalidatePath('/admin/payouts');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'markPayoutPaid', payoutId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to mark payout as paid' };
  }
}

/**
 * Reject a payout request and return the money to the partner's available balance.
 * reject_payout() only succeeds once per pending payout and derives the wallet from the request.
 */
export async function rejectPayout(payoutId: string, reason?: string) {
  try {
    const id = payoutIdSchema.parse(payoutId);
    const why = payoutReasonSchema.parse(reason);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    // Service role: payout state + balance + ledger + audit in one database transaction.
    const admin = createAdminClient({ admin: true });
    const { data: walletId, error } = await admin.rpc('reject_payout', {
      p_payout_id: id,
      p_admin_profile_id: profile.id,
      p_reason: why ?? '',
    });
    if (error) throw new Error(error.message);

    const { data: request } = await admin.from('payout_requests').select('amount').eq('id', id).single();
    const recipient = await payoutRecipient(admin, walletId as string);
    if (recipient?.email) {
      await sendEmail({
        to: recipient.email,
        subject: 'Payout Request Rejected',
        html: `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2>Payout Request Update</h2>
            <p>Hi ${escapeHtml(recipient.full_name ?? '')},</p>
            <p>Unfortunately, your payout request for <strong>₱${Number(request?.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> was rejected.</p>
            ${why ? `<p><strong>Reason:</strong> ${escapeHtml(why)}</p>` : ''}
            <p>The funds have been returned to your Travi available balance.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>Thank you,<br/>Travi Support</p>
          </div>
        `
      });
    }

    revalidatePath('/admin/payouts');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'rejectPayout', payoutId });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reject payout' };
  }
}

const platformSettingsSchema = z.object({
  organizer_fee_percent: z.number().min(0).max(50),
  transporter_fee_percent: z.number().min(0).max(50),
  escrow_holding_days: z.number().int().min(0).max(60),
  min_payout_amount: z.number().positive().max(1_000_000),
});

export async function updatePlatformSettings(input: z.input<typeof platformSettingsSchema>) {
  try {
    const data = platformSettingsSchema.parse(input);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    // Service role: platform_settings is admin-only to write. The table holds a single row (uuid id).
    const admin = createAdminClient({ admin: true });
    const { data: current, error: readError } = await admin
      .from('platform_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (readError || !current) throw new Error('Platform settings row not found');

    const { error } = await admin
      .from('platform_settings')
      .update({ ...data, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', current.id);
    if (error) throw error;

    // platform_settings_history keeps every version (DB trigger); this adds who/why to the admin audit log.
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'platform_settings',
      entityId: current.id,
      action: 'update',
      diff: {
        before: {
          organizer_fee_percent: current.organizer_fee_percent,
          transporter_fee_percent: current.transporter_fee_percent,
          escrow_holding_days: current.escrow_holding_days,
          min_payout_amount: current.min_payout_amount,
        },
        after: data,
      },
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'updatePlatformSettings' });
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : null;
    return { success: false, error: message || 'Failed to update platform settings' };
  }
}
