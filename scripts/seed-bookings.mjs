import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import writeGuard from './lib/write-guard.cjs';

dotenv.config({ path: '.env.local' });
writeGuard.assertWriteTarget('seed-bookings.mjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedBookings() {
  console.log("Fetching travelers...");
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select(`
      user_profile_id,
      website_roles!inner(role)
    `)
    .eq('website_roles.role', 'traveler');
    
  if (!userRoles || userRoles.length === 0) {
    console.error("No travelers found.");
    return;
  }
  
  const travelerIds = userRoles.map(ur => ur.user_profile_id);
  console.log(`Found ${travelerIds.length} travelers.`);
  
  console.log("Fetching open tour schedules...");
  const { data: schedules } = await supabase
    .from('tour_schedules')
    .select(`
      id,
      capacity,
      price_per_person,
      tours (
        id,
        price_per_person
      )
    `)
    .eq('status', 'open');
    
  if (!schedules || schedules.length === 0) {
    console.error("No open tour schedules found.");
    return;
  }
  
  console.log(`Found ${schedules.length} open schedules. Creating random bookings...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  // Create 1-3 bookings for each traveler
  for (const travelerId of travelerIds) {
    const numBookings = Math.floor(Math.random() * 3) + 1; // 1 to 3
    
    for (let i = 0; i < numBookings; i++) {
      // Pick a random schedule
      const schedule = schedules[Math.floor(Math.random() * schedules.length)];
      
      // Random seats 1-4
      const seats = Math.floor(Math.random() * 4) + 1;
      
      const price = schedule.price_per_person || schedule.tours.price_per_person;
      const total_amount = price * seats;
      
      const statuses = ['pending', 'confirmed', 'completed'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const { error } = await supabase.from('bookings').insert({
        tour_schedule_id: schedule.id,
        traveler_id: travelerId,
        seats,
        total_amount,
        status
      });
      
      if (error) {
        console.error("Error creating booking:", error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }
  }
  
  console.log("Seeding bookings complete!");
  console.log(`Created: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

seedBookings();
