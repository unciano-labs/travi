import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!);
async function run() {
  const { data, error } = await supabase
      .from('vehicle_availability')
      .select(`
        *,
        vehicle:vehicles (
          id,
          name,
          vehicle_type,
          plate_number,
          transporter_id
        )
      `)
      .order('start_date', { ascending: true })
      .limit(1);
  console.log('Result:', JSON.stringify({ data, error }, null, 2));
}
run();
