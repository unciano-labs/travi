import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'other_transporter2@example.com');
  
  if (!user) {
    console.log("No user");
    return;
  }
  
  let userProfileId = null;
  const { data: existingProfile } = await supabase.from('user_profiles').select('id').eq('user_id', user.id).single();
  if (existingProfile) {
    userProfileId = existingProfile.id;
  } else {
    const { data: profile, error: pError } = await supabase.from('user_profiles').insert({
      user_id: user.id,
      email: 'other_transporter2@example.com',
      full_name: 'Global Express',
    }).select().single();
    if (pError) console.log('pError', pError);
    userProfileId = profile?.id;
  }
  
  let transporterId = null;
  const { data: existingTransporter } = await supabase.from('transporter_profiles').select('id').eq('user_profile_id', userProfileId).single();
  if (existingTransporter) {
    transporterId = existingTransporter.id;
  } else {
    const { data: transporter, error: tError } = await supabase.from('transporter_profiles').insert({
      user_profile_id: userProfileId,
      transporter_type: 'company',
      company_name: 'Global Express Transport',
      display_name: 'Global Express',
      phone: '123-456-7890',
      status: 'approved'
    }).select().single();
    if (tError) console.log('tError', tError);
    transporterId = transporter?.id;
  }
  
  if (!transporterId) {
    console.log("Could not find or create transporter");
    return;
  }

  console.log("Using transporter ID:", transporterId);
  
  const { error } = await supabase.from('vehicles').insert([
    {
      transporter_id: transporterId,
      name: 'Nissan NV350',
      vehicle_type: 'van',
      seat_capacity: 15,
      rate_per_day: 4000,
      status: 'active'
    },
    {
      transporter_id: transporterId,
      name: 'Hyundai County',
      vehicle_type: 'minibus',
      seat_capacity: 29,
      rate_per_day: 8000,
      status: 'active'
    }
  ]);
  if (error) console.log(error);
  
  console.log('Successfully seeded vehicles for another transporter!');
}

run();
