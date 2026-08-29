import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  const { data: schedules, error: scheduleError } = await supabase
    .from('tour_schedules')
    .select(`
      id,
      capacity,
      price_per_person,
      tours (
        id,
        base_price
      )
    `)
    .limit(10);
    
  if (scheduleError) console.error("Error fetching schedules:", scheduleError);
  else console.log("Found schedules:", schedules?.length);
  
  if (schedules && schedules.length > 0) {
    console.log(schedules[0]);
  }
}

checkData();
