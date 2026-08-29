import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      id,
      name,
      transporter_id,
      transporter:transporter_profiles (
        id,
        company_name,
        display_name
      )
    `)
    .eq('status', 'active')
    .is('deleted_at', null);
    
  console.log('Vehicles from service role (ignores RLS):');
  console.log(JSON.stringify(data, null, 2));
}

run();
