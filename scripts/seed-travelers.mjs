import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedTravelers() {
  console.log('Seeding 100 travelers...');
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < 100; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `traveler${i}_${faker.string.alphanumeric(6).toLowerCase()}@example.com`;
    const password = 'Password123!';

    try {
      // 1. Create user in auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Error creating auth user ${email}:`, authError.message);
        errorCount++;
        continue;
      }

      const userId = authData.user.id;

      // 2. Create profile in user_profiles
      const { data: profileData, error: profileError } = await supabase.from('user_profiles').insert({
        user_id: userId, // use user_id not id
        email: email,
        full_name: `${firstName} ${lastName}`, // use full_name
      }).select('id').single();

      if (profileError) {
        console.error(`Error creating profile for ${email}:`, profileError.message);
        errorCount++;
        continue;
      }

      // 3. Assign traveler role
      const websiteId = process.env.NEXT_PUBLIC_WEBSITE_ID || '11111111-1111-1111-1111-111111111111'; // Assuming a default or fetch it
      const { data: websiteRoleData } = await supabase
        .from('website_roles')
        .select('id')
        .eq('role', 'traveler')
        .limit(1)
        .single();
      
      if (websiteRoleData && profileData) {
        await supabase.from('user_roles').insert({
          user_profile_id: profileData.id,
          website_role_id: websiteRoleData.id
        });
      }

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`Created ${successCount}/100 travelers...`);
      }

    } catch (err) {
      console.error(`Unexpected error for ${email}:`, err);
      errorCount++;
    }
  }

  console.log('Seeding complete!');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  
  if (successCount > 0) {
    console.log(`\nYou can login with any of the created emails, using password: Password123!`);
  }
}

seedTravelers();
