'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, updateTag } from 'next/cache';
import { captureException } from '@/lib/logger';
import { notifyTransporterOfRequest } from './notifications';

export async function createSchedule(tourId: string, formData: FormData) {
  const supabase = await createClient();
  
  const { data: tour } = await supabase.from('tours').select('organizer_id').eq('id', tourId).single();
  const organizerId = tour?.organizer_id;
  
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const priceStr = formData.get('price_per_person') as string;
  const price_per_person = priceStr ? parseFloat(priceStr) : null;
  const origPriceStr = formData.get('original_price') as string;
  const original_price = origPriceStr ? parseFloat(origPriceStr) : null;
  const transport_type = (formData.get('transport_type') as string) || 'none';
  const transport_status = transport_type === 'none' ? 'not_required' : (transport_type === 'self_provided' ? 'self_provided' : 'unresolved');
  
  const { data: schedule, error } = await supabase.from('tour_schedules').insert({
    tour_id: tourId,
    start_date: startDate,
    end_date: endDate,
    capacity,
    price_per_person,
    original_price,
    transport_type,
    transport_status,
    status: 'open'
  }).select().single();
  
  if (error) {
    return { error: error.message };
  }

  // Handle inline vehicle booking
  if (transport_type === 'external_transporter' && formData.get('vehicleId')) {
    const { error: tbError } = await supabase.from('transport_bookings').insert({
      tour_schedule_id: schedule.id,
      organizer_id: organizerId,
      vehicle_id: formData.get('vehicleId') as string,
      transporter_id: formData.get('transporterId') as string,
      pickup_location: formData.get('pickupLocation') as string,
      dropoff_location: formData.get('dropoffLocation') as string,
      pickup_datetime: formData.get('pickupDatetime') as string,
      return_datetime: `${endDate}T17:00:00`,
      seats_required: capacity,
      status: 'pending'
    });
    
    if (!tbError) {
      await supabase
        .from('tour_schedules')
        .update({ transport_status: 'pending' })
        .eq('id', schedule.id);
        
      await notifyTransporterOfRequest(
        formData.get('transporterId') as string,
        startDate,
        endDate
      );
    }
  }

  
  updateTag('tours');
  revalidatePath(`/dashboard/organizer/tours/${tourId}/schedules`);
  return { success: true };
}

export async function updateSchedule(scheduleId: string, tourId: string, formData: FormData) {
  const supabase = await createClient();
  
  const { data: tour } = await supabase.from('tours').select('organizer_id').eq('id', tourId).single();
  const organizerId = tour?.organizer_id;

  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const priceStr = formData.get('price_per_person') as string;
  const price_per_person = priceStr ? parseFloat(priceStr) : null;
  const origPriceStr = formData.get('original_price') as string;
  const original_price = origPriceStr ? parseFloat(origPriceStr) : null;
  const transport_type = (formData.get('transport_type') as string) || 'none';
  const transport_status = transport_type === 'none' ? 'not_required' : (transport_type === 'self_provided' ? 'self_provided' : 'unresolved');
  
  const { error } = await supabase.from('tour_schedules').update({
    start_date: startDate,
    end_date: endDate,
    capacity,
    price_per_person,
    original_price,
    transport_type,
    transport_status,
  }).eq('id', scheduleId).eq('tour_id', tourId);
  
  if (error) {
    return { error: error.message };
  }

  // Handle inline vehicle booking update
  if (transport_type === 'external_transporter' && formData.get('vehicleId')) {
    const vehicleId = formData.get('vehicleId') as string;
    
    // Check if there's an existing booking that needs to be updated or if it's new
    const { data: existingBooking } = await supabase
      .from('transport_bookings')
      .select('id, status')
      .eq('tour_schedule_id', scheduleId)
      .is('deleted_at', null)
      .single();

    if (!existingBooking || existingBooking.status === 'declined' || existingBooking.status === 'canceled') {
      const { error: tbError } = await supabase.from('transport_bookings').insert({
        tour_schedule_id: scheduleId,
        organizer_id: organizerId,
        vehicle_id: vehicleId,
        transporter_id: formData.get('transporterId') as string,
        pickup_location: formData.get('pickupLocation') as string,
        dropoff_location: formData.get('dropoffLocation') as string,
        pickup_datetime: formData.get('pickupDatetime') as string,
        return_datetime: (formData.get('returnDatetime') as string) || null,
        seats_required: capacity,
        status: 'pending'
      });

      if (!tbError) {
        await notifyTransporterOfRequest(
          formData.get('transporterId') as string,
          startDate,
          endDate
        );
      }
    } else if (existingBooking.status === 'pending') {
      // Update the pending request
      await supabase.from('transport_bookings').update({
        vehicle_id: vehicleId,
        transporter_id: formData.get('transporterId') as string,
        pickup_location: formData.get('pickupLocation') as string,
        dropoff_location: formData.get('dropoffLocation') as string,
        pickup_datetime: formData.get('pickupDatetime') as string,
        return_datetime: (formData.get('returnDatetime') as string) || null,
        seats_required: capacity,
      }).eq('id', existingBooking.id);

      // If the vehicle or transporter changed, we might want to notify them again, but for now we won't spam on every edit
      // Let's notify only if it's a completely new booking
      if (existingBooking.status === 'declined' || existingBooking.status === 'canceled') {
        await notifyTransporterOfRequest(
          formData.get('transporterId') as string,
          startDate,
          endDate
        );
      }
    }
  }
  
  updateTag('tours');
  revalidatePath(`/dashboard/organizer/tours/${tourId}/schedules`);
  revalidatePath(`/dashboard/organizer/tours/${tourId}/edit`);
  return { success: true };
}

export async function deleteSchedule(scheduleId: string, tourId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('tour_schedules')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('tour_id', tourId);
  
  if (error) {
    captureException(error, { action: 'deleteSchedule', scheduleId, tourId });
    return { error: error.message };
  }
  
  updateTag('tours');
  revalidatePath(`/dashboard/organizer/tours/${tourId}/schedules`);
  revalidatePath(`/dashboard/organizer/tours/${tourId}/edit`);
  return { success: true };
}
