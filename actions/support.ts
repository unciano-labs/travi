'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit, getClientIp } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { env } from '@/lib/env';
import { sendEmail, siteUrl } from '@/lib/email';
import { supportMessageEmail } from '@/lib/email-templates';
import { notifySuperAdmin } from '@/lib/notifications';
import { COMPANY, configuredEmail } from '@/lib/legal/company';
import {
  SUPPORT_TOPIC_LABELS,
  supportMessageSchema,
  updateSupportMessageSchema,
} from '@/lib/schemas/legal';

// Contact form, complaints and redress (LEG-06 / RA 11967, OPS-05).

type Failure = { success: false; error: string };

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && error.message) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

/**
 * Public /contact form. Open to anonymous visitors, so it is rate-limited by IP (auth limiter) and
 * has a honeypot field. The message is stored with the caller's own client (RLS: insert-only; the DB
 * forces the sender profile and status) and emailed to the support inbox. No acknowledgement email
 * is sent to the address typed in the form, so the form cannot be used to email third parties.
 */
export async function submitSupportMessage(formData: FormData): Promise<{ success: true } | Failure> {
  try {
    await assertRateLimit(`support:${await getClientIp()}`, 'auth');

    // Honeypot: real visitors never see or fill this field. Pretend success for bots.
    if (String(formData.get('website') ?? '').trim()) return { success: true };

    const data = supportMessageSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      topic: formData.get('topic'),
      bookingRef: formData.get('bookingRef') || undefined,
      message: formData.get('message'),
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // No .select(): end users have no SELECT on support_messages.
    const { error } = await supabase.from('support_messages').insert({
      name: data.name,
      email: data.email,
      topic: data.topic,
      booking_ref: data.bookingRef,
      message: data.message,
    });
    if (error) throw new Error('We could not send your message. Please try again or email us directly.');

    const topicLabel = SUPPORT_TOPIC_LABELS[data.topic];
    const inbox = configuredEmail(COMPANY.supportEmail) ?? env.ADMIN_EMAIL ?? null;
    if (inbox) {
      await sendEmail({
        to: inbox,
        ...supportMessageEmail({
          name: data.name,
          email: data.email,
          topicLabel,
          bookingRef: data.bookingRef,
          message: data.message,
          signedIn: Boolean(user),
          adminUrl: siteUrl('/admin/requests?tab=support'),
        }),
      });
    }
    await notifySuperAdmin('New support message', `${topicLabel}${data.bookingRef ? ` (${data.bookingRef})` : ''}`, 'support_message', '/admin/requests?tab=support');

    revalidatePath('/admin/requests');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'submitSupportMessage' });
    return failure(error, 'We could not send your message. Please try again.');
  }
}

/** Admin: update a support message's status (open → in_progress → resolved | closed). Audited. */
export async function updateSupportMessageStatus(input: unknown): Promise<{ success: true } | Failure> {
  try {
    const data = updateSupportMessageSchema.parse(input);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: admin console; support_messages is insert-only for end users (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: current, error: loadError } = await admin
      .from('support_messages')
      .select('id, status')
      .eq('id', data.messageId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!current) throw new Error('Message not found');
    if (current.status === data.status && !data.note) return { success: true };

    const closing = data.status === 'resolved' || data.status === 'closed';
    const { data: updated, error } = await admin
      .from('support_messages')
      .update({
        status: data.status,
        ...(data.note ? { admin_note: data.note } : {}),
        handled_by: profile.id,
        resolved_at: closing ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.messageId)
      .eq('status', current.status)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) throw new Error('This message changed; refresh and try again.');

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'support_message',
      entityId: data.messageId,
      action: data.status,
      notes: `Support message ${current.status} → ${data.status}`,
      diff: { from: current.status, to: data.status, hasNote: Boolean(data.note) },
    });

    revalidatePath('/admin/requests');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'updateSupportMessageStatus' });
    return failure(error, 'Could not update the message.');
  }
}
