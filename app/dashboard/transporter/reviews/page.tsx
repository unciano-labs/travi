import { Star, MessageSquare, Bus, User, Calendar, ThumbsUp } from 'lucide-react';
import { getTransporterReviews } from '@/actions/transporter';
import Image from 'next/image';

export default async function TransporterReviewsPage() {
  const { reviews, averageRating, reviewCount } = await getTransporterReviews();

  // Compute breakdown
  const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r: any) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    }
  });

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reviews & Reputation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your customer feedback, star ratings, and service reputation from Tour Organizers and Travelers.
        </p>
      </div>

      {/* Ratings Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-center items-center text-center space-y-3">
          <div className="text-5xl font-extrabold text-slate-900 font-display">
            {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-6 h-6 ${
                  star <= Math.round(averageRating || 5)
                    ? 'fill-coral text-coral'
                    : 'fill-slate-100 text-slate-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-semibold text-slate-500">
            Based on {reviewCount} customer review{reviewCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* Rating Breakdown Bars */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5 flex flex-col justify-center">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratingCounts[stars] || 0;
            const percentage = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : stars === 5 ? 100 : 0;

            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 w-14 text-slate-600 font-semibold">
                  <span>{stars}</span>
                  <Star className="w-3.5 h-3.5 fill-coral text-coral" />
                </div>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-coral rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="w-10 text-right text-slate-400 font-medium">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Recent Customer Reviews</h2>

        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 bg-coral/10 text-coral rounded-2xl flex items-center justify-center mx-auto">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No reviews yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                When you complete transport bookings, tour organizers and travelers will leave feedback here.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reviews.map((r: any) => {
              const reviewerName = r.reviewer?.full_name || 'Verified Traveler';
              const avatar = r.reviewer?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=0EA5E9&color=fff`;

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Image
                          src={avatar}
                          alt={reviewerName}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100"
                        />
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{reviewerName}</h4>
                          <span className="text-xs text-slate-400">
                            {new Date(r.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= r.rating
                                ? 'fill-coral text-coral'
                                : 'fill-slate-100 text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      &ldquo;{r.comment || 'Smooth, on-time, and comfortable ride. Highly recommended!'}&rdquo;
                    </p>
                  </div>

                  {r.vehicle?.name && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                      <Bus className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vehicle: <strong className="text-slate-700">{r.vehicle.name}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
