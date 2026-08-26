'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath, updateTag } from 'next/cache';
import { captureException } from '@/lib/logger';

export async function createSchedule(tourId: string, formData: FormData) {
  const supabase = await createClient();
  
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const priceStr = formData.get('price_per_person') as string;
  const price_per_person = priceStr ? parseFloat(priceStr) : null;
  const origPriceStr = formData.get('original_price') as string;
  const original_price = origPriceStr ? parseFloat(origPriceStr) : null;
  
  const { error } = await supabase.from('tour_schedules').insert({
    tour_id: tourId,
    start_date: startDate,
    end_date: endDate,
    capacity,
    price_per_person,
    original_price,
    status: 'open'
  });
  
  if (error) {
    return { error: error.message };
  }
  
  updateTag('tours');
  revalidatePath(`/dashboard/organizer/tours/${tourId}/schedules`);
  return { success: true };
}

export async function updateSchedule(scheduleId: string, tourId: string, formData: FormData) {
  const supabase = await createClient();
  
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const priceStr = formData.get('price_per_person') as string;
  const price_per_person = priceStr ? parseFloat(priceStr) : null;
  const origPriceStr = formData.get('original_price') as string;
  const original_price = origPriceStr ? parseFloat(origPriceStr) : null;
  
  const { error } = await supabase.from('tour_schedules').update({
    start_date: startDate,
    end_date: endDate,
    capacity,
    price_per_person,
    original_price,
  }).eq('id', scheduleId).eq('tour_id', tourId);
  
  if (error) {
    return { error: error.message };
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
