-- Soft-delete demo reviews that were seeded as "published" by legacy migration 011 and by
-- scripts/seed-reviews.{js,ts}. Showing them to travelers would be false advertising
-- (docs/MVP_LAUNCH_READINESS.md BIZ-21 / LEG-07). Matches the exact seeded comment text only.
-- Applied migration 011 is not edited (AGENTS.md §3.7 #9); this runs after it on any database.

UPDATE public.reviews
SET status = 'hidden',
    deleted_at = COALESCE(deleted_at, now())
WHERE deleted_at IS NULL
  AND comment IN (
    'Absolutely amazing experience! The guide was very knowledgeable and the itinerary was perfect.',
    'Great tour, but the weather was a bit gloomy. Still had a lot of fun.',
    'The rolling green hills are unreal. Sunrise was the highlight of my whole trip — our guide knew exactly where to stop for photos.',
    'Breathtaking is an understatement! The coastline views and local stops made this a once-in-a-lifetime experience.',
    'Really scenic tour and very organized. Only wish we had more time at some of the stops. Still a great trip.',
    'Our driver and guide were fantastic and the landscapes went beyond the pictures. The overnight stay was cozy and local food was amazing.',
    'Nice sceneries but the van was a bit cramped and we hit heavy fog. Worth it overall, just set expectations on the weather.',
    'The hills and long coastline stayed with me long after the trip. Excellent value and the accommodation was idyllic.',
    'Beautiful landscapes and a thoughtful itinerary. The day-trip barbecue was unforgettable — bring a good camera and layers.',
    'Great place but our pickup was delayed and one itinerary stop was skipped due to road closures. Lucky the scenery forgave the logistics issues.',
    'From the cliffs to the stony coves, everything was pristine. Our organizer handled the travel bookings wonderfully. 10/10.',
    'Stunning, peaceful, and quiet — exactly as advertised. A little expensive for the budget traveler, but for the scenery it was worth every peso.',
    'Absolutely amazing tour! Highly recommended to everyone.',
    'The van was quite late and the AC was not working properly.'
  );
