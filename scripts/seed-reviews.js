const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const writeGuard = require('./lib/write-guard.cjs');
writeGuard.assertWriteTarget('seed-reviews.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY
);

const MOCK_COMMENTS = [
  "The rolling green hills are unreal. Sunrise was the highlight of my whole trip — our guide knew exactly where to stop for photos.",
  "Breathtaking is an understatement! The coastline views and local stops made this a once-in-a-lifetime experience.",
  "Really scenic tour and very organized. Only wish we had more time at some of the stops. Still a great trip.",
  "Our driver and guide were fantastic and the landscapes went beyond the pictures. The overnight stay was cozy and local food was amazing.",
  "Nice sceneries but the van was a bit cramped and we hit heavy fog. Worth it overall, just set expectations on the weather.",
  "The hills and long coastline stayed with me long after the trip. Excellent value and the accommodation was idyllic.",
  "Beautiful landscapes and a thoughtful itinerary. The day-trip barbecue was unforgettable — bring a good camera and layers.",
  "Great place but our pickup was delayed and one itinerary stop was skipped due to road closures. Lucky the scenery forgave the logistics issues.",
  "From the cliffs to the stony coves, everything was pristine. Our organizer handled the travel bookings wonderfully. 10/10.",
  "Stunning, peaceful, and quiet — exactly as advertised. A little expensive for the budget traveler, but for the scenery it was worth every peso."
];

async function main() {
  console.log('Seeding reviews...');

  // Fetch all tours
  const { data: tours, error: toursError } = await supabase.from('tours').select('id');
  if (toursError || !tours.length) {
    console.error('Failed to fetch tours or no tours exist.');
    return;
  }

  // Fetch all user profiles
  const { data: users, error: usersError } = await supabase.from('user_profiles').select('id');
  if (usersError || !users.length) {
    console.error('Failed to fetch users or no users exist.');
    return;
  }

  const newReviews = [];

  // Create 1-4 random reviews for each tour
  for (const tour of tours) {
    const numReviews = Math.floor(Math.random() * 4) + 1; // 1 to 4 reviews
    
    // Pick random reviewers for this tour
    const shuffledUsers = [...users].sort(() => 0.5 - Math.random());
    const selectedUsers = shuffledUsers.slice(0, numReviews);

    for (const user of selectedUsers) {
      const randomComment = MOCK_COMMENTS[Math.floor(Math.random() * MOCK_COMMENTS.length)];
      // Weighted rating: mostly 4 and 5, occasionally 3 or 2
      const randomRating = Math.random() > 0.8 ? (Math.random() > 0.5 ? 3 : 2) : (Math.random() > 0.5 ? 5 : 4);
      
      // Random date within the last 6 months
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 180));

      newReviews.push({
        tour_id: tour.id,
        reviewer_profile_id: user.id,
        rating: randomRating,
        comment: randomComment,
        status: 'published',
        created_at: date.toISOString(),
      });
    }
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert(newReviews)
    .select();

  if (error) {
    console.error('Error inserting reviews:', error);
  } else {
    console.log(`Successfully seeded ${data.length} reviews across ${tours.length} tours!`);
  }
}

main();
