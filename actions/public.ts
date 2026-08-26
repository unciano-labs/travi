'use server';

import { createClient } from '@/lib/supabase/server';

export async function getPublicTours(offset = 0, limit = 6) {
  const supabase = await createClient();

  // We want to fetch published tours, and we need their schedules to determine pricing and max pax,
  // and to filter out tours without active schedules.
  // Because PostgREST doesn't easily allow filtering parent rows based on computed properties of child rows
  // directly in a simple query, we'll fetch a bit more than the limit and filter in JS, 
  // or we can just fetch all published tours and filter if the catalog is small.
  // Given standard Supabase limits, let's fetch a chunk and filter.
  
  const { data: tours, error } = await supabase
    .from('tours')
    .select(`
      id,
      title,
      slug,
      location,
      duration_days,
      price_per_person,
      cover_image_url,
      image_urls,
      organizer:organizer_profiles(company_name, display_name),
      schedules:tour_schedules(capacity, price_per_person, original_price, status, start_date),
      reviews (
        id,
        rating,
        comment,
        created_at,
        reviewer:user_profiles (
          id,
          full_name,
          avatar_url
        )
      )
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching public tours:", error);
    return { tours: [], hasMore: false };
  }

  // Process and filter tours
  const processedTours = [];
  
  for (const tour of tours || []) {
    // Only consider schedules that are open and in the future
    const activeSchedules = tour.schedules?.filter(
      (s: any) => s.status === 'open' && new Date(s.start_date) >= new Date(new Date().setHours(0,0,0,0))
    ) || [];

    if (activeSchedules.length === 0) {
      continue; // Skip tours with no active schedules
    }

    // Calculate max pax (capacity)
    const maxPax = Math.max(...activeSchedules.map((s: any) => s.capacity));
    
    // Find the lowest selling price (fallback to tour.price_per_person if schedule price is null)
    const lowestPrice = Math.min(...activeSchedules.map((s: any) => 
      s.price_per_person !== null && s.price_per_person !== undefined 
        ? s.price_per_person 
        : tour.price_per_person
    ));
    
    // Check if any schedule has a comparison price (original_price > price_per_person)
    // We'll find the schedule that corresponds to the lowest price to show its original price
    const lowestPriceSchedule = activeSchedules.find((s: any) => 
      (s.price_per_person !== null && s.price_per_person !== undefined ? s.price_per_person : tour.price_per_person) === lowestPrice
    );
    const originalPrice = lowestPriceSchedule?.original_price;
    const isOnSale = originalPrice && originalPrice > lowestPrice;

    processedTours.push({
      ...tour,
      calculated_max_pax: maxPax,
      calculated_lowest_price: lowestPrice,
      calculated_original_price: originalPrice,
      is_on_sale: isOnSale
    });
  }

  // Now we apply pagination in memory
  // This ensures exactly `limit` items are returned if available
  const paginatedTours = processedTours.slice(offset, offset + limit);
  
  return {
    tours: paginatedTours,
    hasMore: offset + limit < processedTours.length
  };
}
