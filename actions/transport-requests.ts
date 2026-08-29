'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { logAdminAudit } from '@/lib/audit';
import { notifyOrganizerOfStatusChange } from './notifications';

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
    
    // 3.5 Update the tour_schedules table to 'confirmed'
    await supabase
      .from('tour_schedules')
      .update({ transport_status: 'confirmed' })
      .eq('id', request.tour_schedule_id);

    // 3.6 Notify the Organizer
    const { data: schedule } = await supabase
      .from('tour_schedules')
      .select('tour_id')
      .eq('id', request.tour_schedule_id)
      .single();
      
    if (schedule?.tour_id && request.organizer_id) {
      const transporterName = transporter.display_name || transporter.company_name || 'Transporter';
      await notifyOrganizerOfStatusChange(
        request.organizer_id,
        schedule.tour_id,
        request.tour_schedule_id,
        transporterName,
        'accepted'
      );
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
    
    // Update the tour_schedules table to 'unresolved'
    await supabase
      .from('tour_schedules')
      .update({ transport_status: 'unresolved' })
      .eq('id', request.tour_schedule_id);
      
    // Notify the Organizer
    const { data: schedule } = await supabase
      .from('tour_schedules')
      .select('tour_id')
      .eq('id', request.tour_schedule_id)
      .single();
      
    if (schedule?.tour_id && request.organizer_id) {
      const transporterName = transporter.display_name || transporter.company_name || 'Transporter';
      await notifyOrganizerOfStatusChange(
        request.organizer_id,
        schedule.tour_id,
        request.tour_schedule_id,
        transporterName,
        'declined'
      );
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

/**
 * Organizer sends a transport request to a transporter for a specific vehicle.
 */
export async function sendTransportRequest(formData: FormData) {
  try {
    const { user, profile, supabase } = await requireSession();
    
    // Validate Organizer role
    const { data: organizer } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    if (!organizer) {
      return { success: false, error: 'Organizer profile not found' };
    }

    const tourScheduleId = formData.get('tourScheduleId') as string;
    const vehicleId = formData.get('vehicleId') as string;
    const transporterId = formData.get('transporterId') as string;
    const pickupLocation = formData.get('pickupLocation') as string;
    const dropoffLocation = formData.get('dropoffLocation') as string;
    const pickupDatetime = formData.get('pickupDatetime') as string; // Expecting ISO string or YYYY-MM-DD
    const returnDatetime = formData.get('returnDatetime') as string;
    const seatsRequired = parseInt(formData.get('seatsRequired') as string, 10);

    if (!tourScheduleId || !vehicleId || !transporterId || !pickupLocation || !dropoffLocation || !pickupDatetime || isNaN(seatsRequired)) {
      return { success: false, error: 'Missing required fields for transport request' };
    }

    // Insert into transport_bookings
    const { data: request, error: reqErr } = await supabase
      .from('transport_bookings')
      .insert({
        tour_schedule_id: tourScheduleId,
        organizer_id: organizer.id,
        transporter_id: transporterId,
        vehicle_id: vehicleId,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        pickup_datetime: pickupDatetime,
        return_datetime: returnDatetime || null,
        seats_required: seatsRequired,
        status: 'pending'
      })
      .select()
      .single();

    if (reqErr) {
      captureException(reqErr, { action: 'sendTransportRequest insert' });
      return { success: false, error: reqErr.message };
    }

    // Update the schedule's transport_status to pending
    await supabase.from('tour_schedules').update({ transport_status: 'pending' }).eq('id', tourScheduleId);

    await logAdminAudit(
      profile.id,
      'SEND_TRANSPORT_REQUEST',
      'transport_bookings',
      request.id,
      { vehicleId, tourScheduleId, status: 'pending' }
    );

    revalidatePath('/dashboard/organizer/tours');
    
    // Simulate Notification Logic (Email, SMS, Dashboard)
    console.log(`[NOTIFICATION SYSTEM] Transporter ${transporterId} notified via Email: New Transport Request for vehicle ${vehicleId}`);
    console.log(`[NOTIFICATION SYSTEM] Transporter ${transporterId} notified via Dashboard Dashboard Notification.`);
    // Fetch transporter's phone number to send SMS
    const { data: transProfile } = await supabase.from('transporter_profiles').select('phone').eq('id', transporterId).single();
    if (transProfile?.phone) {
      console.log(`[NOTIFICATION SYSTEM] Transporter ${transporterId} notified via SMS to ${transProfile.phone}.`);
    }

    return { success: true, request };
  } catch (err: any) {
    captureException(err, { action: 'sendTransportRequest exception' });
    return { success: false, error: err.message || 'Failed to send transport request' };
  }
}
