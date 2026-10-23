import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import TransportersClient from '@/components/admin/TransportersClient';
import type { AdminPartnerDocument } from '@/components/admin/PartnerReviewPanel';

export default async function TransportersPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  const { data: transporters } = await admin
    .from('transporter_profiles')
    .select(`
      id,
      user_profile_id,
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
      legal_name,
      tin,
      business_registration_no,
      ltfrb_franchise_no,
      review_note,
      info_requested_at,
      user_profiles ( email )
    `)
    .order('created_at', { ascending: false });

  // Get active vehicles counts (and names, for OR/CR documents)
  const { data: allVehicles } = await admin
    .from('vehicles')
    .select('transporter_id, id, name, status')
    .is('deleted_at', null);
  const vehicles = (allVehicles ?? []).filter((v) => v.status === 'active');
  const vehicleNames = new Map((allVehicles ?? []).map((v) => [v.id as string, v.name as string]));

  // KYC documents (metadata only; files are opened with short-lived signed URLs on demand)
  const { data: documents } = await admin
    .from('partner_documents')
    .select('id, owner_profile_id, doc_type, vehicle_id, file_name, status, created_at')
    .eq('partner_type', 'transporter')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const docsByOwner = new Map<string, AdminPartnerDocument[]>();
  for (const d of documents ?? []) {
    const list = docsByOwner.get(d.owner_profile_id) ?? [];
    list.push({
      id: d.id,
      doc_type: d.doc_type,
      vehicle_id: d.vehicle_id,
      vehicle_name: d.vehicle_id ? vehicleNames.get(d.vehicle_id) ?? null : null,
      file_name: d.file_name,
      status: d.status,
      created_at: d.created_at,
    });
    docsByOwner.set(d.owner_profile_id, list);
  }

  const formattedTransporters = (transporters || []).map((t) => {
    // Array type assertion for Supabase relations
    const userProfile = Array.isArray(t.user_profiles) ? t.user_profiles[0] : t.user_profiles;
    
    // Count vehicles
    const activeVehicles = vehicles?.filter(v => v.transporter_id === t.id).length || 0;

    return {
      ...t,
      user_profiles: userProfile,
      activeVehicles,
      accreditation_no: t.ltfrb_franchise_no ?? null,
      documents: docsByOwner.get(t.user_profile_id) ?? [],
    };
  });

  return (
    <TransportersClient initialTransporters={formattedTransporters} />
  );
}
