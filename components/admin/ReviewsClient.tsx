'use client';

import { useState } from 'react';
import { EyeOff, Star } from 'lucide-react';

type Review = {
  id: string;
  reviewer_profile_id: string;
  transporter_id: string | null;
  tour_id: string | null;
  rating: number;
  comment: string;
  status: 'pending' | 'published' | 'hidden';
  created_at: string;
  reviewer: { full_name: string; email: string };
  target_name: string;
};

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleHide = async (id: string) => {
    if (!window.confirm('Are you sure you want to hide this review? It will no longer be visible to users.')) {
      return;
    }

    setIsProcessing(id);
    try {
      // dynamically import to avoid hydration issues if it was needed, but server action is fine here
      const { hideReview } = await import('@/actions/reviews');
      const res = await hideReview(id);
      if (res?.success) {
        window.alert('Review hidden successfully');
        setReviews(reviews.map((r) => (r.id === id ? { ...r, status: 'hidden' } : r)));
      } else {
        window.alert(res?.error || 'Failed to hide review');
      }
    } catch (err: any) {
      window.alert(err.message || 'Something went wrong');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="py-4 px-6">Reviewer</th>
              <th className="py-4 px-6">Target</th>
              <th className="py-4 px-6">Rating</th>
              <th className="py-4 px-6 w-1/3">Comment</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  No reviews found.
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-medium text-slate-900">{review.reviewer.full_name}</div>
                    <div className="text-slate-500 text-xs">{review.reviewer.email}</div>
                    <div className="text-slate-400 text-xs mt-1">{new Date(review.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {review.target_name}
                    <div className="text-xs text-slate-400 mt-0.5">
                      {review.tour_id ? 'Tour' : 'Transport'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-medium text-slate-700">{review.rating}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <p className="line-clamp-2">{review.comment}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        review.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : review.status === 'hidden'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {review.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {review.status !== 'hidden' && (
                      <button
                        onClick={() => handleHide(review.id)}
                        disabled={isProcessing === review.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <EyeOff className="w-4 h-4" />
                        Hide
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-slate-100">
        {reviews.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No reviews found.</div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-slate-900">{review.reviewer.full_name}</div>
                  <div className="text-slate-500 text-sm">{review.target_name} ({review.tour_id ? 'Tour' : 'Transport'})</div>
                  <div className="text-slate-400 text-xs mt-0.5">{new Date(review.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    review.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : review.status === 'hidden'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {review.status}
                </span>
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-medium text-slate-700">{review.rating}</span>
              </div>
              <p className="text-slate-600 text-sm">{review.comment}</p>
              {review.status !== 'hidden' && (
                <button
                  onClick={() => handleHide(review.id)}
                  disabled={isProcessing === review.id}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-4 h-4" />
                  Hide Review
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
