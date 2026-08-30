/**
 * SMS Service (Mock for MVP)
 * 
 * In production, replace the mock with a real SMS provider
 * such as Semaphore (PH), Twilio, or MessageBird.
 */

export interface SmsParams {
  to: string;
  body: string;
}

export async function sendSms({ to, body }: SmsParams): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Replace with real SMS provider in production
    console.log('\n================== SMS MOCK ==================');
    console.log(`To: ${to}`);
    console.log(`Body: ${body}`);
    console.log('================================================\n');
    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error sending SMS:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}
