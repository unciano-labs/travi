import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import OrganizersClient from '@/components/admin/OrganizersClient';

export default async function OrganizersPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });
  
  // 1. Fetch organizers
  const { data: organizers, error } = await admin
    .from('organizer_profiles')
    .select('*, user_profiles(email)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching organizers:', error);
  }

  // 2. Fetch revenue (confirmed/completed bookings)
  const { data: bookings } = await admin
    .from('bookings')
    .select('total_amount, tour_schedules!inner(tours!inner(organizer_id))')
    .in('status', ['confirmed', 'completed']);

  const revenueMap = new Map<string, number>();
  if (bookings) {
    bookings.forEach((b: any) => {
      const orgId = b.tour_schedules?.tours?.organizer_id;
      if (orgId) {
        revenueMap.set(orgId, (revenueMap.get(orgId) || 0) + (b.total_amount || 0));
      }
    });
  }

  // 3. Fetch active tours
  const { data: tours } = await admin
    .from('tours')
    .select('organizer_id')
    .eq('status', 'published');

  const toursCountMap = new Map<string, number>();
  if (tours) {
    tours.forEach((t: any) => {
      if (t.organizer_id) {
        toursCountMap.set(t.organizer_id, (toursCountMap.get(t.organizer_id) || 0) + 1);
      }
    });
  }

  const organizersWithStats = (organizers || []).map((org) => ({
    ...org,
    revenue: revenueMap.get(org.id) || 0,
    activeTours: toursCountMap.get(org.id) || 0,
  }));

  return (
    <OrganizersClient initialOrganizers={organizersWithStats} />
  );
}
