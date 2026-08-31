import { Resend } from 'resend';

// Initialize Resend only if the API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// The standard sender email for the platform.
// Note: If you don't have a verified domain on Resend, you must use 'onboarding@resend.dev'
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || 'Travi Support <onboarding@resend.dev>';

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using Resend.
 * If RESEND_API_KEY is not configured in the environment variables,
 * it will mock the email send by logging the contents to the console (useful for development).
 */
export async function sendEmail({ to, subject, html }: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!resend) {
      console.log('\n================== EMAIL MOCK ==================');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log('Body:');
      console.log(html.replace(/<[^>]*>?/gm, '')); // Strip HTML for console readability
      console.log('================================================\n');
      return { success: true };
    }

    const { data, error } = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error sending email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
