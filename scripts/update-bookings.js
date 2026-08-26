const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Updating all bookings to confirmed...');
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .neq('status', 'confirmed') // only update those that are not confirmed
    .select();

  if (error) {
    console.error('Error updating bookings:', error);
  } else {
    console.log(`Successfully updated ${data.length} bookings to confirmed.`);
  }
}

main();
