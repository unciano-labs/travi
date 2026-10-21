import { createAdminClient } from '@/lib/supabase/admin';
import ReviewsClient from '@/components/admin/ReviewsClient';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import PageHeader from '@/components/ui/PageHeader';

export default async function ReviewsPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  // Fetch reviews with related data
  // We use admin client to bypass RLS and view all reviews
  const { data: allReviews, error } = await admin
    .from('reviews')
    .select(`
      id,
      reviewer_profile_id,
      tour_id,
      transporter_id,
      rating,
      comment,
      status,
      created_at,
      reviewer:user_profiles!reviews_reviewer_profile_id_fkey(full_name, email),
      tour:tours(title),
      transporter:transporter_profiles!reviews_transporter_id_fkey(company_name, individual_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reviews:', error);
  }

  const formattedReviews = (allReviews || []).map((r: any) => {
    let targetName = 'Unknown Target';
    if (r.tour) {
      targetName = r.tour.title;
    } else if (r.transporter) {
      targetName = r.transporter.company_name || r.transporter.individual_name || 'Transporter';
    }

    return {
      id: r.id,
      reviewer_profile_id: r.reviewer_profile_id,
      tour_id: r.tour_id,
      transporter_id: r.transporter_id,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      created_at: r.created_at,
      reviewer: {
        full_name: r.reviewer?.full_name || 'Unknown User',
        email: r.reviewer?.email || '',
      },
      target_name: targetName,
    };
  });

  return (
    <>
      <PageHeader
        title="Reviews & Moderation"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Reviews' }]}
      />

      <ReviewsClient initialReviews={formattedReviews} />
    </>
  );
}
