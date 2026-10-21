'use client';

import { useState } from 'react';
import { EyeOff, Star, MessageSquare } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-warning">
      <Star className="w-4 h-4 fill-current" aria-hidden="true" />
      <span className="font-medium text-bodytext">{value}</span>
    </div>
  );
}

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
    <CardBox className="p-0 gap-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h5 className="card-title">All Reviews</h5>
        <p className="text-sm text-muted-foreground">{reviews.length} review{reviews.length === 1 ? '' : 's'}</p>
      </div>

      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No reviews found." />
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">Reviewer</TableHead>
                  <TableHead className="px-6">Target</TableHead>
                  <TableHead className="px-6">Rating</TableHead>
                  <TableHead className="px-6 w-1/3">Comment</TableHead>
                  <TableHead className="px-6">Status</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="px-6 py-4">
                      <h6 className="text-sm font-semibold text-foreground">{review.reviewer.full_name}</h6>
                      <p className="text-muted-foreground text-xs font-medium">{review.reviewer.email}</p>
                      <p className="text-muted-foreground text-xs mt-1">{formatDate(review.created_at)}</p>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {review.target_name}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {review.tour_id ? 'Tour' : 'Transport'}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Rating value={review.rating} />
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <p className="line-clamp-2">{review.comment}</p>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      {review.status !== 'hidden' && (
                        <Button
                          type="button"
                          variant="ghosterror"
                          size="sm"
                          onClick={() => handleHide(review.id)}
                          disabled={isProcessing === review.id}
                        >
                          <EyeOff aria-hidden="true" />
                          Hide
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-border">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-semibold text-foreground">{review.reviewer.full_name}</div>
                    <div className="text-muted-foreground text-sm">{review.target_name} ({review.tour_id ? 'Tour' : 'Transport'})</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{formatDate(review.created_at)}</div>
                  </div>
                  <StatusBadge status={review.status} />
                </div>
                <Rating value={review.rating} />
                <p className="text-bodytext text-sm">{review.comment}</p>
                {review.status !== 'hidden' && (
                  <Button
                    type="button"
                    variant="lighterror"
                    className="w-full"
                    onClick={() => handleHide(review.id)}
                    disabled={isProcessing === review.id}
                  >
                    <EyeOff aria-hidden="true" />
                    Hide Review
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </CardBox>
  );
}
