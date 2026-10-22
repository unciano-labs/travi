// The platform's only email sender (ENG-12). Server-only. Build message bodies with
// lib/email-templates.ts, which escapes user-supplied text (SEC-18).
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { captureException, logger } from '@/lib/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Without a verified Resend domain only 'onboarding@resend.dev' can send (dev). Production
// requires RESEND_FROM_EMAIL (lib/env.ts), e.g. 'Travi <hello@travi.ph>'.
const SENDER_EMAIL = env.RESEND_FROM_EMAIL || 'Travi <onboarding@resend.dev>';

const DEFAULT_SITE_URL = 'https://travi.ph';

/** Absolute URL on the public site for email links, from NEXT_PUBLIC_SITE_URL (fallback https://travi.ph). */
export function siteUrl(path = '/'): string {
  const base = (env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// Escape user-supplied text (names, tour titles, reasons) before putting it in email HTML (SEC-18).
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** "ju***@example.com": enough to tell recipients apart in logs without logging the address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative; recommended for deliverability. */
  text?: string;
}

/**
 * Send an email through Resend. Never throws: returns `{ success: false, error }` instead.
 * Without RESEND_API_KEY (local dev) the email is not sent; only the masked recipient and the
 * subject are logged. Bodies are never logged: they can contain OTP codes and personal data.
 */
export async function sendEmail({ to, subject, html, text }: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!resend) {
      logger.info({ to: maskEmail(to), subject }, 'email mock: RESEND_API_KEY unset, not sent');
      return { success: true };
    }

    const { error } = await resend.emails.send({ from: SENDER_EMAIL, to, subject, html, text });
    if (error) {
      captureException(new Error(error.message), { action: 'sendEmail', to: maskEmail(to), subject });
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'sendEmail', to: maskEmail(to), subject });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
