'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { logAdminAudit } from '@/lib/audit';

async function getTransporterSession() {
  const { user, profile, supabase } = await requireSession();
  const { data: transporter, error } = await supabase
    .from('transporter_profiles')
    .select('*')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .single();

  if (error || !transporter) {
    throw new Error('Transporter profile not found');
  }

  return { user, profile, transporter, supabase };
}

/**
 * Fetch all transport requests for the logged-in transporter with optional status filtering.
 */
export async function getTransporterRequests(statusFilter?: string) {
  try {
    const { transporter, supabase } = await getTransporterSession();

    let query = supabase
      .from('transport_bookings')
      .select(`
        *,
        organizer:organizer_profiles (
          id,
          company_name,
          display_name,
          phone,
          user_profiles:user_profile_id (
            email,
            full_name
          )
        ),
        vehicle:vehicles (
          id,
          name,
          vehicle_type,
          seat_capacity,
          plate_number,
          rate_per_day
        ),
        tour_schedule:tour_schedules (
          id,
          start_date,
          end_date,
          status,
          tour:tours (
            id,
            title,
            slug,
            location
          )
        )
      `)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      captureException(error, { action: 'getTransporterRequests', transporterId: transporter.id });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getTransporterRequests exception' });
    return [];
  }
}

/**
 * Accept an incoming transport request.
 * Automatically synchronizes vehicle_availability table with a 'booked' status record.
 */
export async function acceptTransportRequest(requestId: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    // 1. Fetch request details to ensure it belongs to transporter and is pending
    const { data: request, error: reqErr } = await supabase
      .from('transport_bookings')
      .select('*')
      .eq('id', requestId)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .single();

    if (reqErr || !request) {
      return { success: false, error: 'Transport request not found or unauthorized.' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: `Cannot accept a request with status "${request.status}".` };
    }

    // 2. Update status to 'accepted'
    const { error: updateErr } = await supabase
      .from('transport_bookings')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      captureException(updateErr, { action: 'acceptTransportRequest update', requestId });
      return { success: false, error: updateErr.message };
    }

    // 3. Automatically synchronize availability block
    const startDate = new Date(request.pickup_datetime).toISOString().split('T')[0];
    const endDate = request.return_datetime 
      ? new Date(request.return_datetime).toISOString().split('T')[0]
      : startDate;

    const { error: availErr } = await supabase
      .from('vehicle_availability')
      .insert({
        vehicle_id: request.vehicle_id,
        start_date: startDate,
        end_date: endDate,
        status: 'booked',
        transport_booking_id: request.id,
        notes: `Booked for Transport Request #${requestId.substring(0, 8)}`,
      });

    if (availErr) {
      console.warn('Could not auto-insert availability booking record:', availErr.message);
    }

    // 4. Audit logging
    await logAdminAudit(
      profile.id,
      'ACCEPT_TRANSPORT_REQUEST',
      'transport_bookings',
      requestId,
      { status: 'accepted', vehicle_id: request.vehicle_id, dates: [startDate, endDate] }
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/requests');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'acceptTransportRequest exception' });
    return { success: false, error: err.message || 'Failed to accept request.' };
  }
}

/**
 * Decline an incoming transport request.
 */
export async function declineTransportRequest(requestId: string, reason?: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const { data: request, error: reqErr } = await supabase
      .from('transport_bookings')
      .select('*')
      .eq('id', requestId)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .single();

    if (reqErr || !request) {
      return { success: false, error: 'Transport request not found or unauthorized.' };
    }

    if (request.status !== 'pending') {
      return { success: false, error: `Cannot decline a request with status "${request.status}".` };
    }

    const { error: updateErr } = await supabase
      .from('transport_bookings')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateErr) {
      captureException(updateErr, { action: 'declineTransportRequest', requestId });
      return { success: false, error: updateErr.message };
    }

    await logAdminAudit(
      profile.id,
      'DECLINE_TRANSPORT_REQUEST',
      'transport_bookings',
      requestId,
      { status: 'declined', reason }
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/requests');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'declineTransportRequest exception' });
    return { success: false, error: err.message || 'Failed to decline request.' };
  }
}

/**
 * Mark a confirmed transport booking as completed.
 */
export async function completeTransportBooking(requestId: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const { error } = await supabase
      .from('transport_bookings')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('transporter_id', transporter.id);

    if (error) {
      captureException(error, { action: 'completeTransportBooking', requestId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'COMPLETE_TRANSPORT_BOOKING',
      'transport_bookings',
      requestId,
      { status: 'completed' }
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/requests');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'completeTransportBooking exception' });
    return { success: false, error: err.message || 'Failed to complete booking.' };
  }
}
