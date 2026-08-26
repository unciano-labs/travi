import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedTours() {
  console.log('Finding user johndoe@gmail.com...');
  const { data: userProfile, error: userError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'johndoe@gmail.com')
    .single();

  if (userError || !userProfile) {
    console.error('User not found:', userError);
    return;
  }

  const { data: organizer, error: orgError } = await supabase
    .from('organizer_profiles')
    .select('id')
    .eq('user_profile_id', userProfile.id)
    .single();

  if (orgError || !organizer) {
    console.error('Organizer profile not found:', orgError);
    return;
  }

  const organizerId = organizer.id;
  console.log('Organizer ID:', organizerId);

  const toursToInsert = [
    {
      title: 'Manila Historical City Tour',
      slug: 'manila-historical-city-tour-' + Date.now(),
      description: 'Step back in time and explore the walled city of Intramuros, Rizal Park, and Fort Santiago. Experience the rich history of the Philippine capital.',
      location: 'Manila, Metro Manila, Philippines',
      price_per_person: 1200,
      duration_days: 1,
      capacity: 20,
      start_date: '2026-09-10',
      end_date: '2026-09-10',
      accommodation_details: 'None (Day Tour)',
      travel_time_info: '6 hours total duration',
      transport_type: 'self_provided',
      transport_status: 'self_provided',
      status: 'published',
      latitude: 14.5896,
      longitude: 120.9760,
    },
    {
      title: 'Cebu City Heritage & Highland Tour',
      slug: 'cebu-city-heritage-highland-' + Date.now(),
      description: 'Discover the Queen City of the South. Visit Magellan\'s Cross, Basilica Minore del Santo Niño, and head up to Sirao Garden and Temple of Leah for spectacular views.',
      location: 'Cebu City, Cebu, Philippines',
      price_per_person: 1800,
      duration_days: 1,
      capacity: 15,
      start_date: '2026-09-15',
      end_date: '2026-09-15',
      accommodation_details: 'None (Day Tour)',
      travel_time_info: '8 hours total duration',
      transport_type: 'self_provided',
      transport_status: 'self_provided',
      status: 'published',
      latitude: 10.3157,
      longitude: 123.8854,
    },
    {
      title: 'Vigan Heritage Village Walk',
      slug: 'vigan-heritage-village-walk-' + Date.now(),
      description: 'A magical walk through Calle Crisologo in Vigan. Experience Spanish colonial architecture, try authentic Ilocano empanada, and ride a traditional kalesa.',
      location: 'Vigan, Ilocos Sur, Philippines',
      price_per_person: 1500,
      duration_days: 1,
      capacity: 25,
      start_date: '2026-10-01',
      end_date: '2026-10-01',
      accommodation_details: 'None (Day Tour)',
      travel_time_info: '4 hours total duration',
      transport_type: 'none',
      transport_status: 'not_required',
      status: 'published',
      latitude: 17.5746,
      longitude: 120.3869,
    },
    {
      title: 'Baguio City of Pines Weekend',
      slug: 'baguio-city-of-pines-weekend-' + Date.now(),
      description: 'Escape the heat and enjoy the cool breeze of Baguio. Includes visits to Burnham Park, Mines View Park, Camp John Hay, and strawberry picking in La Trinidad.',
      location: 'Baguio City, Benguet, Philippines',
      price_per_person: 6500,
      duration_days: 3,
      capacity: 12,
      start_date: '2026-11-20',
      end_date: '2026-11-22',
      accommodation_details: '2 nights stay at a cozy cabin near Camp John Hay',
      travel_time_info: '3 days, 2 nights',
      transport_type: 'none',
      transport_status: 'not_required',
      status: 'published',
      latitude: 16.4023,
      longitude: 120.5960,
    },
    {
      title: 'Davao City Nature & Culture Exploration',
      slug: 'davao-nature-culture-' + Date.now(),
      description: 'Experience the best of Davao City. Meet the Philippine Eagle, explore Eden Nature Park, and savor local fruits including the famous Durian.',
      location: 'Davao City, Davao del Sur, Philippines',
      price_per_person: 4000,
      duration_days: 2,
      capacity: 10,
      start_date: '2026-10-10',
      end_date: '2026-10-11',
      accommodation_details: '1 night stay at Apo View Hotel',
      travel_time_info: '2 days, 1 night',
      transport_type: 'self_provided',
      transport_status: 'self_provided',
      status: 'draft',
      latitude: 7.1907,
      longitude: 125.4553,
    }
  ];

  console.log('Inserting tours...');
  for (const tour of toursToInsert) {
    const { data: insertedTour, error: insertError } = await supabase
      .from('tours')
      .insert({ ...tour, organizer_id: organizerId })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert tour:', tour.title, insertError);
    } else {
      console.log(`Successfully inserted "${tour.title}" with ID: ${insertedTour.id}`);
      
      // Optionally add some itineraries for multi-day tours
      if (tour.duration_days > 1) {
        console.log(`Adding itineraries for ${tour.title}...`);
        const itineraries = [];
        for (let i = 1; i <= tour.duration_days; i++) {
          itineraries.push({
            tour_id: insertedTour.id,
            day_number: i,
            title: `Day ${i} Activities`,
            description: `Exciting activities planned for day ${i} in ${tour.location}.`
          });
        }
        await supabase.from('tour_itineraries').insert(itineraries);
      }
    }
  }

  console.log('Done seeding tours!');
}

seedTours().catch(console.error);
