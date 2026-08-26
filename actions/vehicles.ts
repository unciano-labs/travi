'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAvailableVehicles(date: string, requiredCapacity: number) {
  const supabase = await createClient();

  // For the MVP, we just fetch vehicles where capacity >= requiredCapacity
  // and we could optionally join with availability records
  // For now, simple fetch based on capacity:
  
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      name,
      vehicle_type,
      seat_capacity,
      rate_per_day,
      transporter_id,
      transporter_profiles (
        company_name,
        display_name
      )
    `)
    .gte('seat_capacity', requiredCapacity)
    .eq('status', 'active');

  if (error) {
    console.error("Error fetching vehicles:", error);
    return [];
  }

  return data || [];
}
