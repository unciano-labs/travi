import { createAdminClient } from '@/lib/supabase/admin';
import ToursClient from '@/components/admin/ToursClient';

export default async function ToursPage() {
  const admin = createAdminClient({ admin: true });

  const { data: tours } = await admin
    .from('tours')
    .select(`
      id,
      title,
      slug,
      description,
      location,
      price_per_person,
      duration_days,
      status,
      cover_image_url,
      created_at,
      organizer_profiles (
        display_name,
        company_name
      ),
      tour_schedules (
        id,
        start_date,
        end_date,
        capacity,
        price_per_person,
        transport_type,
        bookings (
          seats,
          status
        )
      )
    `)
    .order('created_at', { ascending: false });

  // Handle Supabase relation typing (array vs object)
  const formattedTours = (tours || []).map((t) => {
    const orgProfile = Array.isArray(t.organizer_profiles) 
      ? t.organizer_profiles[0] 
      : t.organizer_profiles;

    return {
      ...t,
      organizer_profiles: orgProfile,
      tour_schedules: Array.isArray(t.tour_schedules) ? t.tour_schedules : []
    };
  });

  return (
    <ToursClient initialTours={formattedTours as any} />
  );
}
