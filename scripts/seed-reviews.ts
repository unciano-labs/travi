import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function seedReviews() {
  console.log('Seeding test reviews...');

  // 1. Get a traveler profile
  const { data: travelerProfile, error: err1 } = await adminClient
    .from('user_profiles')
    .select('id')
    .limit(1)
    .single();

  if (err1 || !travelerProfile) {
    console.error('Could not find a traveler profile:', err1);
    return;
  }

  // 2. Get a published tour
  const { data: tour, error: err2 } = await adminClient
    .from('tours')
    .select('id')
    .eq('status', 'published')
    .limit(1)
    .single();

  if (err2 || !tour) {
    console.log('No published tour found, cannot seed tour review.');
  } else {
    // 3. Insert a tour review
    // transporter_id is NOT actually required for a tour review but the DB schema might enforce it if it's not setup correctly.
    // Let's get any transporter profile just in case.
    const { data: tp } = await adminClient.from('transporter_profiles').select('id').limit(1).single();
    
    const { error: insertErr1 } = await adminClient.from('reviews').insert({
      reviewer_profile_id: travelerProfile.id,
      tour_id: tour.id,
      rating: 5,
      comment: 'Absolutely amazing tour! Highly recommended to everyone.',
      status: 'published',
      transporter_id: tp?.id || null // Provide if required by schema
    });
    if (insertErr1) console.error('Failed to insert tour review:', insertErr1);
    else console.log('✅ Inserted tour review.');
  }

  // 4. Get a transporter booking
  const { data: tb, error: err3 } = await adminClient
    .from('transport_bookings')
    .select('id')
    .limit(1)
    .single();

  if (err3 || !tb) {
    console.log('No transport booking found, cannot seed transport review.');
  } else {
    const { data: tp2 } = await adminClient.from('transporter_profiles').select('id').limit(1).single();

    // 5. Insert a transport review
    const { error: insertErr2 } = await adminClient.from('reviews').insert({
      reviewer_profile_id: travelerProfile.id,
      transporter_id: tp2?.id || null, // Assuming transporter_id is required
      rating: 2,
      comment: 'The van was quite late and the AC was not working properly.',
      status: 'published'
    });
    if (insertErr2) console.error('Failed to insert transport review:', insertErr2);
    else console.log('✅ Inserted transport review.');
  }

  console.log('Review seeding completed.');
}

seedReviews().catch(console.error);
