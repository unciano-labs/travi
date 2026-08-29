'use server';

import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { Resend } from 'resend';

// Initialize Resend if API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function createNotification(
  userId: string, 
  title: string, 
  message: string, 
  type: string, 
  link?: string
) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });
    
    const { error } = await admin.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link
    });

    if (error) {
      captureException(error, { action: 'createNotification' });
    }
  } catch (err: any) {
    captureException(err, { action: 'createNotification exception' });
  }
}

export async function sendEmailNotification(
  toEmail: string,
  subject: string,
  htmlContent: string
) {
  try {
    if (!resend) {
      console.log('--- EMAIL MOCK ---');
      console.log(`To: ${toEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content: ${htmlContent}`);
      console.log('------------------');
      return { success: true, mock: true };
    }

    const { data, error } = await resend.emails.send({
      from: 'Travi App <notifications@travi.app>', // Change this to a verified domain if moving to production
      to: [toEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      captureException(error, { action: 'sendEmailNotification' });
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    captureException(err, { action: 'sendEmailNotification exception' });
    return { success: false, error: err };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const { supabase, user } = await requireSession();
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) {
      captureException(error, { action: 'markNotificationAsRead' });
    }
  } catch (err: any) {
    captureException(err, { action: 'markNotificationAsRead exception' });
  }
}

export async function getUnreadNotifications() {
  try {
    const { supabase, user } = await requireSession();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getUnreadNotifications' });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getUnreadNotifications exception' });
    return [];
  }
}

export async function getAllNotifications() {
  try {
    const { supabase, user } = await requireSession();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getAllNotifications' });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getAllNotifications exception' });
    return [];
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const { supabase, user } = await requireSession();
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      captureException(error, { action: 'markAllNotificationsAsRead' });
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'markAllNotificationsAsRead exception' });
    return { success: false, error: err.message };
  }
}

export async function notifyTransporterOfRequest(
  transporterId: string,
  startDate: string,
  endDate: string
) {
  try {
    const { supabase } = await requireSession();
    
    // Fetch transporter's user_id and email
    const { data: tp } = await supabase
      .from('transporter_profiles')
      .select(`
        company_name, 
        display_name, 
        user_profile:user_profiles ( user_id, email )
      `)
      .eq('id', transporterId)
      .single();

    if (!tp || !tp.user_profile) return;

    const userProfile = Array.isArray(tp.user_profile) ? tp.user_profile[0] : tp.user_profile;
    const transporterName = tp.display_name || tp.company_name || 'Transporter';

    // 1. In-app Notification
    await createNotification(
      userProfile.user_id,
      'New Vehicle Request',
      `You have a new transport request for a tour schedule from ${startDate} to ${endDate}.`,
      'transport_request',
      '/dashboard/transporter/requests'
    );

    // 2. Email Notification
    await sendEmailNotification(
      userProfile.email,
      'New Transport Request - Travi',
      `
      <div style="font-family: sans-serif; max-w-2xl mx-auto p-4 border rounded-lg">
        <h2 style="color: #ff6b6b;">New Transport Request! 🚐</h2>
        <p>Hello <strong>${transporterName}</strong>,</p>
        <p>A tour organizer has requested one of your vehicles for an upcoming tour schedule!</p>
        <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
        <p>Please log in to your dashboard to review the request, verify your availability, and either accept or decline.</p>
        <br/>
        <a href="https://travi.app/dashboard/transporter/requests" style="display: inline-block; background: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Request</a>
      </div>
      `
    );

  } catch (err: any) {
    captureException(err, { action: 'notifyTransporterOfRequest exception' });
  }
}

export async function notifyOrganizerOfStatusChange(
  organizerId: string,
  tourId: string,
  tourScheduleId: string,
  transporterName: string,
  status: 'accepted' | 'declined'
) {
  try {
    const { supabase } = await requireSession();
    
    // Fetch organizer's user_id and email
    const { data: op } = await supabase
      .from('organizer_profiles')
      .select(`
        company_name, 
        display_name, 
        user_profile:user_profiles ( user_id, email )
      `)
      .eq('id', organizerId)
      .single();

    if (!op || !op.user_profile) return;

    const userProfile = Array.isArray(op.user_profile) ? op.user_profile[0] : op.user_profile;
    const organizerName = op.display_name || op.company_name || 'Organizer';
    
    const actionText = status === 'accepted' ? 'accepted' : 'declined';
    const emoji = status === 'accepted' ? '✅' : '❌';

    // 1. In-app Notification
    await createNotification(
      userProfile.user_id,
      `Transport Request ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      `${transporterName} has ${actionText} your transport request.`,
      `transport_${status}`,
      `/dashboard/organizer/tours/${tourId}/schedules`
    );

    // 2. Email Notification
    await sendEmailNotification(
      userProfile.email,
      `Transport Request ${status === 'accepted' ? 'Accepted' : 'Declined'} - Travi`,
      `
      <div style="font-family: sans-serif; max-w-2xl mx-auto p-4 border rounded-lg">
        <h2 style="color: #ff6b6b;">Transport Request Update ${emoji}</h2>
        <p>Hello <strong>${organizerName}</strong>,</p>
        <p><strong>${transporterName}</strong> has <strong>${actionText}</strong> your transport request for your tour schedule.</p>
        <p>Please log in to your dashboard to view the updated schedule.</p>
        <br/>
        <a href="https://travi.app/dashboard/organizer/tours/${tourId}/schedules" style="display: inline-block; background: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Schedule</a>
      </div>
      `
    );

  } catch (err: any) {
    captureException(err, { action: 'notifyOrganizerOfStatusChange exception' });
  }
}

export async function notifyOrganizerAccountStatus(
  organizerId: string,
  status: 'activated' | 'deactivated',
  reason?: string
) {
  try {
    const { supabase } = await requireSession();
    
    // We must use admin client because if status was changed to rejected,
    // the admin calling this function will not be able to read the row due to RLS.
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });
    
    const { data: op } = await admin
      .from('organizer_profiles')
      .select(`
        company_name, 
        display_name, 
        user_profile:user_profiles ( user_id, email )
      `)
      .eq('id', organizerId)
      .single();

    if (!op || !op.user_profile) return;

    const userProfile = Array.isArray(op.user_profile) ? op.user_profile[0] : op.user_profile;
    const organizerName = op.display_name || op.company_name || 'Organizer';
    
    const emoji = status === 'activated' ? '🎉' : '⚠️';
    const title = `Account ${status === 'activated' ? 'Activated' : 'Deactivated'}`;
    const message = status === 'activated'
      ? 'Your organizer account has been approved and activated! You can now start creating tours.'
      : `Your organizer account has been deactivated. ${reason ? `Reason: ${reason}` : 'Please contact support for more details.'}`;

    // 1. In-app Notification
    await createNotification(
      userProfile.user_id,
      title,
      message,
      `account_${status}`,
      '/dashboard/organizer'
    );

    // 2. Email Notification
    await sendEmailNotification(
      userProfile.email,
      `${title} - Travi`,
      `
      <div style="font-family: sans-serif; max-w-2xl mx-auto p-4 border rounded-lg">
        <h2 style="color: #ff6b6b;">${title} ${emoji}</h2>
        <p>Hello <strong>${organizerName}</strong>,</p>
        <p>${message}</p>
        <br/>
        <a href="https://travi.app/dashboard/organizer" style="display: inline-block; background: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </div>
      `
    );

  } catch (err: any) {
    captureException(err, { action: 'notifyOrganizerAccountStatus exception' });
  }
}

export async function notifyTransporterAccountStatus(
  transporterId: string,
  status: 'activated' | 'deactivated',
  reason?: string
) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });
    
    const { data: tp } = await admin
      .from('transporter_profiles')
      .select(`
        company_name, 
        display_name, 
        user_profile:user_profiles ( user_id, email )
      `)
      .eq('id', transporterId)
      .single();

    if (!tp || !tp.user_profile) return;

    const userProfile = Array.isArray(tp.user_profile) ? tp.user_profile[0] : tp.user_profile;
    const transporterName = tp.display_name || tp.company_name || 'Transporter';
    
    const emoji = status === 'activated' ? '🎉' : '⚠️';
    const title = `Account ${status === 'activated' ? 'Activated' : 'Deactivated'}`;
    const message = status === 'activated'
      ? 'Your transporter account has been approved and activated! You can now start managing your vehicles.'
      : `Your transporter account has been deactivated. ${reason ? `Reason: ${reason}` : 'Please contact support for more details.'}`;

    // 1. In-app Notification
    await createNotification(
      userProfile.user_id,
      title,
      message,
      `account_${status}`,
      '/dashboard/transporter'
    );

    // 2. Email Notification
    await sendEmailNotification(
      userProfile.email,
      `${title} - Travi`,
      `
      <div style="font-family: sans-serif; max-w-2xl mx-auto p-4 border rounded-lg">
        <h2 style="color: #ff6b6b;">${title} ${emoji}</h2>
        <p>Hello <strong>${transporterName}</strong>,</p>
        <p>${message}</p>
        <br/>
        <a href="https://travi.app/dashboard/transporter" style="display: inline-block; background: #ff6b6b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </div>
      `
    );

  } catch (err: any) {
    captureException(err, { action: 'notifyTransporterAccountStatus exception' });
  }
}

export async function notifySuperAdmin(
  title: string,
  message: string,
  type: string,
  link?: string
) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('ADMIN_EMAIL not set, skipping superadmin notification');
      return;
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });

    // Find the user_id of the superadmin from their email in user_profiles
    const { data: profile } = await admin
      .from('user_profiles')
      .select('user_id')
      .eq('email', adminEmail)
      .single();

    if (profile?.user_id) {
      // Re-use createNotification for the insertion logic (which requires admin client anyway)
      await admin.from('notifications').insert({
        user_id: profile.user_id,
        title,
        message,
        type,
        link
      });
    }
  } catch (err: any) {
    captureException(err, { action: 'notifySuperAdmin exception' });
  }
}
