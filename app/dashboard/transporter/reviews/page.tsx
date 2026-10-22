import { Star, MessageSquare } from 'lucide-react';
import { getTransporterReviews } from '@/actions/transporter';
import Image from 'next/image';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Progress } from '@/components/ui/progress';

type TransporterReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: { full_name: string | null; avatar_url: string | null } | null;
};

export default async function TransporterReviewsPage() {
  const result = await getTransporterReviews();
  const { averageRating, reviewCount } = result;
  // Many-to-one embed: PostgREST returns an object, the untyped client infers an array.
  const reviews = result.reviews as unknown as TransporterReview[];
  const hasRatings = reviewCount > 0;

  // Compute breakdown
  const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    }
  });

  return (
    <>
      <PageHeader
        title="Reviews & Reputation"
        description="Monitor your customer feedback, star ratings, and service reputation from Tour Organizers and Travelers."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Reviews' }]}
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Ratings Overview Card */}
        <CardBox className="col-span-12 items-center justify-center gap-3 text-center md:col-span-4">
          {hasRatings ? (
            <>
              <div className="text-5xl font-semibold text-foreground">{averageRating.toFixed(1)}</div>
              <div className="flex gap-1" role="img" aria-label={`Average rating ${averageRating.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    aria-hidden="true"
                    className={`size-6 ${
                      star <= Math.round(averageRating)
                        ? 'fill-warning text-warning'
                        : 'fill-muted text-border'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                Based on {reviewCount} published review{reviewCount === 1 ? '' : 's'}
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-foreground">No ratings yet</div>
              <p className="text-xs font-semibold text-muted-foreground">
                Your average appears here once your first review is published.
              </p>
            </>
          )}
        </CardBox>

        {/* Rating Breakdown Bars */}
        <CardBox className="col-span-12 justify-center gap-3 md:col-span-8">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars] || 0;
            const percentage = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;

            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <div className="flex w-14 items-center gap-1 font-semibold text-bodytext">
                  <span>{stars}</span>
                  <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
                </div>
                <Progress value={percentage} variant="warning" className="h-2.5 flex-1" aria-label={`${stars} star reviews`} />
                <span className="w-10 text-right font-medium text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </CardBox>

        {/* Reviews List */}
        <div className="col-span-12 space-y-4">
          <h5 className="card-title">Recent Customer Reviews</h5>

          {reviews.length === 0 ? (
            <CardBox>
              <EmptyState
                icon={MessageSquare}
                title="No reviews yet"
                description="When you complete transport bookings, tour organizers and travelers will leave feedback here."
              />
            </CardBox>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reviews.map((r) => {
                const reviewerName = r.reviewer?.full_name || 'Verified Traveler';
                const avatar = r.reviewer?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=5d87ff&color=fff`;

                return (
                  <CardBox key={r.id} className="justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Image
                            src={avatar}
                            alt={reviewerName}
                            width={40}
                            height={40}
                            className="size-10 rounded-full object-cover"
                          />
                          <div>
                            <h6 className="text-sm font-semibold text-foreground">{reviewerName}</h6>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-0.5" role="img" aria-label={`${r.rating} out of 5 stars`}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              aria-hidden="true"
                              className={`size-4 ${
                                star <= r.rating
                                  ? 'fill-warning text-warning'
                                  : 'fill-muted text-border'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {r.comment ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-bodytext">&ldquo;{r.comment}&rdquo;</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Rating only, no written comment.</p>
                      )}
                    </div>
                  </CardBox>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
