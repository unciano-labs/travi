import { createAdminClient } from '@/lib/supabase/admin';
import TransportersClient from '@/components/admin/TransportersClient';

export default async function TransportersPage() {
  const admin = createAdminClient({ admin: true });

  const { data: transporters } = await admin
    .from('transporter_profiles')
    .select(`
      id,
      display_name,
      company_name,
      transporter_type,
      status,
      phone,
      service_areas,
      description,
      average_rating,
      review_count,
      created_at,
      user_profiles ( email )
    `)
    .order('created_at', { ascending: false });

  // Get active vehicles counts
  const { data: vehicles } = await admin
    .from('vehicles')
    .select('transporter_id, id')
    .eq('status', 'active');

  const formattedTransporters = (transporters || []).map((t) => {
    // Array type assertion for Supabase relations
    const userProfile = Array.isArray(t.user_profiles) ? t.user_profiles[0] : t.user_profiles;
    
    // Count vehicles
    const activeVehicles = vehicles?.filter(v => v.transporter_id === t.id).length || 0;

    return {
      ...t,
      user_profiles: userProfile,
      activeVehicles
    };
  });

  return (
    <TransportersClient initialTransporters={formattedTransporters as any} />
  );
}
