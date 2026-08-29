import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTravelers() {
  const { data } = await supabase
    .from('user_roles')
    .select('user_profiles(email)')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log("Recent Traveler Emails:");
  data.forEach(d => console.log(d.user_profiles.email));
}

getTravelers();
