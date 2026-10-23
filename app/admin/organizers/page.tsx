import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import OrganizersClient from '@/components/admin/OrganizersClient';
import type { AdminPartnerDocument } from '@/components/admin/PartnerReviewPanel';
import { captureException } from '@/lib/logger';

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
    captureException(error, { action: 'OrganizersPage fetch' });
  }

  // KYC documents (metadata only; the files are opened with short-lived signed URLs on demand)
  const { data: documents } = await admin
    .from('partner_documents')
    .select('id, owner_profile_id, doc_type, vehicle_id, file_name, status, created_at')
    .eq('partner_type', 'organizer')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const docsByOwner = new Map<string, AdminPartnerDocument[]>();
  for (const d of documents ?? []) {
    const list = docsByOwner.get(d.owner_profile_id) ?? [];
    list.push({ id: d.id, doc_type: d.doc_type, vehicle_id: d.vehicle_id, file_name: d.file_name, status: d.status, created_at: d.created_at });
    docsByOwner.set(d.owner_profile_id, list);
  }

  // 2. Fetch revenue (confirmed/completed bookings)
  const { data: bookings } = await admin
    .from('bookings')
    .select('total_amount, tour_schedules!inner(tours!inner(organizer_id))')
    .in('status', ['confirmed', 'completed']);

  const revenueMap = new Map<string, number>();
  if (bookings) {
    bookings.forEach((b) => {
      const schedule = b.tour_schedules as unknown as { tours?: { organizer_id?: string } } | null;
      const orgId = schedule?.tours?.organizer_id;
      if (orgId) {
        revenueMap.set(orgId, (revenueMap.get(orgId) || 0) + (Number(b.total_amount) || 0));
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
    tours.forEach((t) => {
      if (t.organizer_id) {
        toursCountMap.set(t.organizer_id, (toursCountMap.get(t.organizer_id) || 0) + 1);
      }
    });
  }

  const organizersWithStats = (organizers || []).map((org) => ({
    ...org,
    revenue: revenueMap.get(org.id) || 0,
    activeTours: toursCountMap.get(org.id) || 0,
    accreditation_no: org.dot_accreditation_no ?? null,
    documents: docsByOwner.get(org.user_profile_id) ?? [],
  }));

  return (
    <OrganizersClient initialOrganizers={organizersWithStats} />
  );
}
