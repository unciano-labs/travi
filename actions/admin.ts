'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { revalidatePath, updateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { notifyOrganizerAccountStatus, notifyTransporterAccountStatus, notifyOrganizerTourModeration } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { payoutPaidEmail, payoutRejectedEmail } from '@/lib/email-templates';
import { createRefund } from '@/lib/paymongo';
import { env } from '@/lib/env';

import { idSchema, rejectSchema } from '@/lib/schemas/admin';
import {
  modifyUserRoleSchema,
  payoutReasonSchema,
  payoutReferenceSchema,
  resolvePaymentReviewSchema,
  suspendUserSchema,
  unpublishTourSchema,
  uuidSchema,
} from '@/lib/schemas/admin-tools';

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


// ─────────────────────────────────────────────────────────────────────────────
// Admin tooling (Phase 3.11). Review moderation lives in actions/reviews.ts.
// Payout, payment-review and tour-moderation state changes are database functions
// (supabase/migrations/20261025120000_admin_tooling.sql) that also write the audit row.
// ─────────────────────────────────────────────────────────────────────────────

type ActionResult<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// Steps 2–4 of the §3.2 contract for every admin mutation (callers validate input first).
async function requireAdminMutation() {
  const { user, profile } = await requireSession();
  await assertRole(user.id, 'admin');
  await assertRateLimit(profile.id, 'mutation');
  return { user, profile };
}

/**
 * Grant or revoke a platform role. Never lets an admin remove their own admin role, or the last admin.
 */
export async function modifyUserRole(input: unknown): Promise<ActionResult> {
  try {
    const data = modifyUserRoleSchema.parse(input);
    const { profile } = await requireAdminMutation();

    // Service role: user_roles has no admin write policy, and role changes are admin-only (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: target } = await admin
      .from('user_profiles')
      .select('id, deleted_at')
      .eq('id', data.userProfileId)
      .maybeSingle();
    if (!target || target.deleted_at) return { success: false, error: 'User not found.' };

    let roleQuery = admin.from('website_roles').select('id').eq('role', data.role);
    if (env.WEBSITE_ID) roleQuery = roleQuery.eq('website_id', env.WEBSITE_ID);
    const { data: roleRows, error: roleError } = await roleQuery;
    if (roleError) throw roleError;
    if (!roleRows || roleRows.length !== 1) {
      return { success: false, error: `Role '${data.role}' is not configured for this website (check WEBSITE_ID).` };
    }
    const websiteRoleId = roleRows[0].id as string;

    if (data.operation === 'grant') {
      const { error } = await admin.from('user_roles').insert({ user_profile_id: data.userProfileId, website_role_id: websiteRoleId });
      if (error && error.code !== '23505') throw error; // 23505: already has the role (idempotent)
    } else {
      if (data.role === 'admin') {
        if (data.userProfileId === profile.id) return { success: false, error: 'You cannot remove your own admin role.' };
        const { count } = await admin
          .from('user_roles')
          .select('id', { count: 'exact', head: true })
          .eq('website_role_id', websiteRoleId);
        if ((count ?? 0) <= 1) return { success: false, error: 'You cannot remove the last admin.' };
      }
      const { data: removed, error } = await admin
        .from('user_roles')
        .delete()
        .eq('user_profile_id', data.userProfileId)
        .eq('website_role_id', websiteRoleId)
        .select('id');
      if (error) throw error;
      if (!removed || removed.length === 0) return { success: false, error: `This user does not have the ${data.role} role.` };
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'user_role',
      entityId: data.userProfileId,
      action: data.operation === 'grant' ? 'grant_role' : 'revoke_role',
      notes: `${data.operation === 'grant' ? 'Granted' : 'Revoked'} role '${data.role}'`,
      diff: { role: data.role, operation: data.operation },
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'modifyUserRole' });
    return { success: false, error: errorMessage(error, 'Failed to modify user role') };
  }
}

// Supabase Auth bans by duration; 100 years is effectively permanent until lifted with 'none'.
const SUSPEND_DURATION = '876000h';

/**
 * Suspend (ban sign-in) or unsuspend a user. Admins cannot suspend themselves or another admin
 * (revoke the admin role first). Existing access tokens stay valid until they expire (≤ 1 hour).
 */
export async function setUserSuspended(input: unknown): Promise<ActionResult> {
  try {
    const data = suspendUserSchema.parse(input);
    const { profile } = await requireAdminMutation();

    // Service role: auth.admin.* and cross-user reads (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: target } = await admin
      .from('user_profiles')
      .select('id, user_id, user_roles ( website_roles ( role ) )')
      .eq('id', data.userProfileId)
      .maybeSingle();
    if (!target) return { success: false, error: 'User not found.' };
    if (target.id === profile.id) return { success: false, error: 'You cannot suspend your own account.' };

    if (data.suspend) {
      const roles = (target.user_roles as unknown as { website_roles: { role: string } | { role: string }[] | null }[] | null) ?? [];
      const isAdmin = roles.some((r) => {
        const wr = Array.isArray(r.website_roles) ? r.website_roles : [r.website_roles];
        return wr.some((w) => w?.role === 'admin');
      });
      if (isAdmin) return { success: false, error: 'Remove the admin role before suspending an admin.' };
    }

    const { error } = await admin.auth.admin.updateUserById(target.user_id as string, {
      ban_duration: data.suspend ? SUSPEND_DURATION : 'none',
    });
    if (error) throw error;

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'user_profile',
      entityId: data.userProfileId,
      action: data.suspend ? 'suspend' : 'unsuspend',
      notes: data.suspend ? `Suspended. Reason: ${data.reason}` : data.reason ? `Unsuspended. ${data.reason}` : 'Unsuspended',
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'setUserSuspended' });
    return { success: false, error: errorMessage(error, 'Failed to update the account') };
  }
}

// ─── Payouts (maker-checker: OPS-07) ───

async function payoutRecipient(admin: ReturnType<typeof createAdminClient>, walletId: string) {
  const { data } = await admin.from('user_wallets').select('user_profiles(full_name, email)').eq('id', walletId).single();
  const p = Array.isArray(data?.user_profiles) ? data?.user_profiles[0] : data?.user_profiles;
  return p as { full_name: string | null; email: string | null } | undefined;
}

/**
 * First step for payouts at or above the dual-approval threshold: pending → processing.
 * A different admin must then mark it paid (enforced by mark_payout_paid()).
 */
export async function approvePayout(payoutId: string): Promise<ActionResult> {
  try {
    const id = uuidSchema.parse(payoutId);
    const { profile } = await requireAdminMutation();

    // Service role: payout state + audit row in one database function (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { error } = await admin.rpc('approve_payout', { p_payout_id: id, p_admin_profile_id: profile.id });
    if (error) throw new Error(error.message);

    revalidatePath('/admin/payouts');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'approvePayout', payoutId });
    return { success: false, error: errorMessage(error, 'Failed to approve payout') };
  }
}

/**
 * Mark a payout request as paid (after the money was sent outside Travi).
 * mark_payout_paid() only succeeds once per pending payout, derives the wallet from the request,
 * and enforces the maker-checker rule.
 */
export async function markPayoutPaid(payoutId: string, referenceNumber: string): Promise<ActionResult> {
  try {
    const id = uuidSchema.parse(payoutId);
    const reference = payoutReferenceSchema.parse(referenceNumber);
    const { profile } = await requireAdminMutation();

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
        ...payoutPaidEmail({ name: recipient.full_name, amount: Number(request?.amount ?? 0), reference }),
      });
    }

    revalidatePath('/admin/payouts');
    revalidatePath('/admin/finance');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'markPayoutPaid', payoutId });
    return { success: false, error: errorMessage(error, 'Failed to mark payout as paid') };
  }
}

/**
 * Reject a payout request and return the money to the partner's available balance.
 * reject_payout() only succeeds once per pending/approved payout and derives the wallet from the request.
 */
export async function rejectPayout(payoutId: string, reason?: string): Promise<ActionResult> {
  try {
    const id = uuidSchema.parse(payoutId);
    const why = payoutReasonSchema.parse(reason);
    const { profile } = await requireAdminMutation();

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
        ...payoutRejectedEmail({ name: recipient.full_name, amount: Number(request?.amount ?? 0), reason: why }),
      });
    }

    revalidatePath('/admin/payouts');
    revalidatePath('/admin/finance');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'rejectPayout', payoutId });
    return { success: false, error: errorMessage(error, 'Failed to reject payout') };
  }
}

// ─── Payments needing review (§6 #6, FIN-11) ───

/**
 * Refund a payment that PayMongo collected but Travi could not apply (late, duplicate, wrong amount).
 * The payment never reached escrow, so there is no ledger change. The claim in
 * begin_payment_review_refund() stops two admins from refunding the same payment.
 */
export async function refundReviewPayment(paymentId: string): Promise<ActionResult<{ refundId: string }>> {
  try {
    const id = uuidSchema.parse(paymentId);
    const { profile } = await requireAdminMutation();

    // Service role: booking_payments and the review functions are service-role only (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: payment } = await admin.from('booking_payments').select('review_reason').eq('id', id).maybeSingle();
    if (!payment) return { success: false, error: 'Payment not found.' };

    const { data: claim, error: claimError } = await admin.rpc('begin_payment_review_refund', {
      p_payment_id: id,
      p_admin_profile_id: profile.id,
    });
    if (claimError) throw new Error(claimError.message);
    const row = (Array.isArray(claim) ? claim[0] : claim) as
      | { provider_payment_id: string; amount_centavos: number; booking_id: string }
      | undefined;
    if (!row) throw new Error('Payment not found.');

    let refundId: string;
    try {
      const refund = await createRefund(
        row.provider_payment_id,
        Number(row.amount_centavos),
        payment.review_reason === 'duplicate_payment' ? 'duplicate' : 'others',
        { booking_payment_id: id, booking_id: row.booking_id }
      );
      refundId = refund.id;
    } catch (error: unknown) {
      await admin.rpc('fail_payment_review_refund', { p_payment_id: id });
      throw error;
    }

    const { error: resolveError } = await admin.rpc('resolve_payment_review', {
      p_payment_id: id,
      p_admin_profile_id: profile.id,
      p_resolution: 'refunded',
      p_provider_refund_id: refundId,
    });
    if (resolveError) {
      // The money left PayMongo but Travi did not record it. The claim stays, so nobody refunds twice.
      captureException(resolveError, { action: 'refundReviewPayment resolve', paymentId: id, refundId });
      return { success: false, error: `The refund was sent (PayMongo ${refundId}) but could not be recorded. Our team has been alerted.` };
    }

    revalidatePath('/admin/finance');
    return { success: true, refundId };
  } catch (error: unknown) {
    captureException(error, { action: 'refundReviewPayment', paymentId });
    return { success: false, error: errorMessage(error, 'Failed to refund the payment') };
  }
}

/** Close a payment review without refunding through Travi (e.g. refunded in the PayMongo dashboard). */
export async function closeReviewPayment(input: unknown): Promise<ActionResult> {
  try {
    const data = resolvePaymentReviewSchema.parse(input);
    const { profile } = await requireAdminMutation();

    // Service role: booking_payments and resolve_payment_review() are service-role only (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { error } = await admin.rpc('resolve_payment_review', {
      p_payment_id: data.paymentId,
      p_admin_profile_id: profile.id,
      p_resolution: 'no_refund',
      p_provider_refund_id: null,
      p_note: data.note,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/admin/finance');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'closeReviewPayment' });
    return { success: false, error: errorMessage(error, 'Failed to resolve the payment') };
  }
}

// ─── Tour moderation (OPS-06) ───

async function tourTitleAndSlug(admin: ReturnType<typeof createAdminClient>, tourId: string) {
  const { data } = await admin.from('tours').select('title, slug').eq('id', tourId).maybeSingle();
  return data as { title: string; slug: string } | null;
}

/** Unpublish a tour (published → draft) with a reason. The organizer cannot re-publish it until an admin does. */
export async function adminUnpublishTour(input: unknown): Promise<ActionResult> {
  try {
    const data = unpublishTourSchema.parse(input);
    const { profile } = await requireAdminMutation();

    // Service role: admin tour moderation function (status + hold + audit row) (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: organizerId, error } = await admin.rpc('admin_unpublish_tour', {
      p_tour_id: data.tourId,
      p_admin_profile_id: profile.id,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);

    const tour = await tourTitleAndSlug(admin, data.tourId);
    if (organizerId && tour) {
      await notifyOrganizerTourModeration(organizerId as string, tour.title, 'unpublished', data.reason);
    }

    updateTag('tours');
    updateTag('platform-stats');
    revalidatePath('/admin/tours');
    if (tour?.slug) revalidatePath(`/tours/${tour.slug}`);
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'adminUnpublishTour' });
    return { success: false, error: errorMessage(error, 'Failed to unpublish the tour') };
  }
}

/** Re-publish a tour an admin unpublished (lifts the hold). */
export async function adminRepublishTour(tourId: string): Promise<ActionResult> {
  try {
    const id = uuidSchema.parse(tourId);
    const { profile } = await requireAdminMutation();

    // Service role: admin tour moderation function (status + hold + audit row) (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: organizerId, error } = await admin.rpc('admin_republish_tour', {
      p_tour_id: id,
      p_admin_profile_id: profile.id,
    });
    if (error) throw new Error(error.message);

    const tour = await tourTitleAndSlug(admin, id);
    if (organizerId && tour) {
      await notifyOrganizerTourModeration(organizerId as string, tour.title, 'republished');
    }

    updateTag('tours');
    updateTag('platform-stats');
    revalidatePath('/admin/tours');
    if (tour?.slug) revalidatePath(`/tours/${tour.slug}`);
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'adminRepublishTour', tourId });
    return { success: false, error: errorMessage(error, 'Failed to re-publish the tour') };
  }
}

// ─── Platform settings ───

const platformSettingsSchema = z.object({
  organizer_fee_percent: z.number().min(0).max(50),
  transporter_fee_percent: z.number().min(0).max(50),
  escrow_holding_days: z.number().int().min(0).max(60),
  min_payout_amount: z.number().positive().max(1_000_000),
  // Pesos. null = maker-checker off. Omitted = unchanged.
  payout_dual_approval_threshold: z.number().positive('Dual-approval threshold must be greater than 0').max(100_000_000).nullable().optional(),
});

export async function updatePlatformSettings(input: z.input<typeof platformSettingsSchema>): Promise<ActionResult> {
  try {
    const data = platformSettingsSchema.parse(input);
    const { profile } = await requireAdminMutation();

    // Service role: platform_settings is admin-only to write. The table holds a single row (uuid id).
    const admin = createAdminClient({ admin: true });
    const { data: current, error: readError } = await admin
      .from('platform_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (readError || !current) throw new Error('Platform settings row not found');

    const update: Record<string, unknown> = {
      organizer_fee_percent: data.organizer_fee_percent,
      transporter_fee_percent: data.transporter_fee_percent,
      escrow_holding_days: data.escrow_holding_days,
      min_payout_amount: data.min_payout_amount,
    };
    if (data.payout_dual_approval_threshold !== undefined) {
      update.payout_dual_approval_threshold = data.payout_dual_approval_threshold;
    }

    const { error } = await admin
      .from('platform_settings')
      .update({ ...update, updated_by: profile.id, updated_at: new Date().toISOString() })
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
          payout_dual_approval_threshold: current.payout_dual_approval_threshold ?? null,
        },
        after: update,
      },
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/payouts');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'updatePlatformSettings' });
    return { success: false, error: errorMessage(error, 'Failed to update platform settings') };
  }
}
