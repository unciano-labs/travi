'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { dataRequestReceivedEmail, dataRequestUpdatedEmail } from '@/lib/email-templates';
import { createNotification, notifySuperAdmin } from '@/lib/notifications';
import { buildPersonalDataExport, deletionRetentionNote } from '@/lib/legal/privacy';
import {
  DATA_REQUEST_LABELS,
  dataRequestSchema,
  updateDataRequestSchema,
  type DataRequestType,
} from '@/lib/schemas/legal';

// Data subject rights (RA 10173; LEG-10): self-service export, deletion/correction requests, and the
// admin workflow that handles them (/admin/requests).

type Failure = { success: false; error: string };

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && error.message) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

const PROFILE_PATHS = ['/dashboard/traveler/profile', '/dashboard/organizer/profile', '/dashboard/transporter/profile'];

/** "Download my data": a JSON copy of the caller's own personal data. */
export async function downloadMyData(): Promise<{ success: true; fileName: string; json: string } | Failure> {
  try {
    const { user, profile } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    // Ids come from the session only; nothing client-supplied reaches the export.
    const data = await buildPersonalDataExport({ authUserId: user.id, email: user.email, userProfileId: profile.id });

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'user_profile',
      entityId: profile.id,
      action: 'data_export',
      notes: 'User downloaded a copy of their personal data',
    });

    const date = new Date().toISOString().slice(0, 10);
    return { success: true, fileName: `travi-my-data-${date}.json`, json: JSON.stringify(data, null, 2) };
  } catch (error: unknown) {
    captureException(error, { action: 'downloadMyData' });
    return failure(error, 'Could not prepare your data. Please try again.');
  }
}

/** File a deletion / access / correction request for the caller's own account. */
export async function submitDataRequest(input: unknown): Promise<{ success: true } | Failure> {
  try {
    const data = dataRequestSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    // RLS client: the DB forces the owner, 'open' status and empty admin fields.
    const { error } = await supabase.from('data_requests').insert({
      user_profile_id: profile.id,
      request_type: data.type,
      details: data.details,
    });
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You already have an open request of this type. We will contact you about it.' };
      }
      throw error;
    }

    const label = DATA_REQUEST_LABELS[data.type];
    await notifySuperAdmin(
      'New data request',
      `${profile.full_name || 'A user'} filed a request: ${label}.`,
      'data_request',
      '/admin/requests'
    );
    if (user.email) {
      const email = dataRequestReceivedEmail({
        name: profile.full_name,
        typeLabel: label,
        retentionNote: data.type === 'deletion'
          ? deletionRetentionNote()
          : 'We aim to respond within the period set by the Data Privacy Act and the National Privacy Commission.',
      });
      await sendEmail({ to: user.email, ...email });
    }

    for (const path of PROFILE_PATHS) revalidatePath(path);
    revalidatePath('/admin/requests');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'submitDataRequest' });
    return failure(error, 'Could not submit your request. Please try again.');
  }
}

/** Admin: move a data request through open → in_progress → completed | rejected. Audited. */
export async function updateDataRequestStatus(input: unknown): Promise<{ success: true } | Failure> {
  try {
    const data = updateDataRequestSchema.parse(input);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: admin console write; data_requests has no end-user UPDATE (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: current, error: loadError } = await admin
      .from('data_requests')
      .select('id, status, request_type, user_profiles ( user_id, email, full_name )')
      .eq('id', data.requestId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!current) throw new Error('Request not found');
    if (current.status === 'completed' || current.status === 'rejected') {
      throw new Error('This request is already closed.');
    }
    if (current.status === data.status && !data.note) return { success: true };
    if (data.status === 'open' && current.status !== 'open') throw new Error('A request cannot be moved back to open.');

    const closing = data.status === 'completed' || data.status === 'rejected';
    const { data: updated, error } = await admin
      .from('data_requests')
      .update({
        status: data.status,
        ...(data.note ? { admin_note: data.note } : {}),
        handled_by: profile.id,
        resolved_at: closing ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.requestId)
      .eq('status', current.status) // status-guarded: two admins cannot both move it
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) throw new Error('This request changed; refresh and try again.');

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'data_request',
      entityId: data.requestId,
      action: data.status,
      notes: `Data request ${current.status} → ${data.status}`,
      diff: { from: current.status, to: data.status, type: current.request_type, hasNote: Boolean(data.note) },
    });

    const owner = current.user_profiles as unknown as { user_id: string; email: string | null; full_name: string | null } | null;
    if (owner && data.status !== 'open' && data.status !== current.status) {
      const label = DATA_REQUEST_LABELS[current.request_type as DataRequestType] ?? 'Data request';
      await createNotification(owner.user_id, `Your request: ${label}`, `Status: ${data.status.replace('_', ' ')}.`, 'data_request');
      if (owner.email) {
        await sendEmail({
          to: owner.email,
          ...dataRequestUpdatedEmail({ name: owner.full_name, typeLabel: label, status: data.status, note: data.note }),
        });
      }
    }

    revalidatePath('/admin/requests');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'updateDataRequestStatus' });
    return failure(error, 'Could not update the request.');
  }
}
