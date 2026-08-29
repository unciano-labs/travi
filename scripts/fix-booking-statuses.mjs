import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStatuses() {
  console.log("Fetching all completed bookings for upcoming schedules...");
  
  // Find all schedules that have not yet passed
  const today = new Date().toISOString().split('T')[0];
  
  const { data: upcomingSchedules, error: schedError } = await supabase
    .from('tour_schedules')
    .select('id, end_date')
    .gte('end_date', today);
    
  if (schedError) throw schedError;
  
  if (!upcomingSchedules || upcomingSchedules.length === 0) {
    console.log("No upcoming schedules found.");
    return;
  }

  const upcomingIds = upcomingSchedules.map(s => s.id);

  // Find bookings tied to these schedules that are marked as 'completed'
  const { data: bookingsToFix, error: bookError } = await supabase
    .from('bookings')
    .select('id, tour_schedule_id, status')
    .in('tour_schedule_id', upcomingIds)
    .eq('status', 'completed');
    
  if (bookError) throw bookError;
  
  console.log(`Found ${bookingsToFix.length} bookings incorrectly marked as completed for upcoming tours.`);
  
  if (bookingsToFix.length === 0) {
    console.log("Nothing to fix.");
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;

  for (const b of bookingsToFix) {
    console.log(`Updating booking ${b.id} from completed to confirmed...`);
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', b.id);
      
    if (error) {
      console.error(`Failed to update booking ${b.id}:`, error);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log("Done fixing statuses.");
  console.log(`Updated: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

fixStatuses();
