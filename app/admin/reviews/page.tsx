import { createAdminClient } from '@/lib/supabase/admin';
import ReviewsClient from '@/components/admin/ReviewsClient';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import PageHeader from '@/components/ui/PageHeader';
import { captureException } from '@/lib/logger';

export default async function ReviewsPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  // Service role: admin console read across all reviewers (admin role checked above).
  // Soft-deleted reviews are left out; the moderation queue only shows live rows.
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
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    captureException(error, { action: 'AdminReviewsPage' });
  }

  type ReviewRow = {
    id: string;
    reviewer_profile_id: string;
    tour_id: string | null;
    transporter_id: string | null;
    rating: number;
    comment: string | null;
    status: 'pending' | 'published' | 'hidden';
    created_at: string;
    reviewer: { full_name: string | null; email: string | null } | null;
    tour: { title: string } | null;
    transporter: { company_name: string | null; individual_name: string | null } | null;
  };

  const formattedReviews = ((allReviews ?? []) as unknown as ReviewRow[]).map((r) => {
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
        description="Publish traveler reviews after checking them, or hide and remove ones that break the guidelines."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Reviews' }]}
      />

      <ReviewsClient initialReviews={formattedReviews} />
    </>
  );
}
