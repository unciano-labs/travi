import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { data, error } = await supabase
    .from('transport_bookings')
    .select(`
      id,
      status,
      transporter:transporter_profiles(
        id,
        display_name,
        company_name,
        user_profile:user_profiles(
          id,
          user_id,
          email
        )
      )
    `)
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample transport booking connection:', JSON.stringify(data, null, 2));
  }
}

check();
