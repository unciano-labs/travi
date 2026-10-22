'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { createReview } from '@/actions/reviews';
import { REVIEW_COMMENT_MAX } from '@/lib/schemas/review';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const RATING_LABELS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

interface ReviewDialogProps {
  booking: { id: string; tourTitle: string } | null;
  onClose: () => void;
  onSubmitted: (bookingId: string) => void;
}

export default function ReviewDialog({ booking, onClose, onSubmitted }: ReviewDialogProps) {
  return (
    <Dialog open={booking !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        {/* Keyed so each booking starts with an empty form */}
        {booking && <ReviewForm key={booking.id} booking={booking} onClose={onClose} onSubmitted={onSubmitted} />}
      </DialogContent>
    </Dialog>
  );
}

function ReviewForm({
  booking,
  onClose,
  onSubmitted,
}: {
  booking: { id: string; tourTitle: string };
  onClose: () => void;
  onSubmitted: (bookingId: string) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hover || rating;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rating < 1) {
      setError('Pick a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createReview({ bookingId: booking.id, rating, comment });
      if (res.success) {
        onSubmitted(booking.id);
      } else {
        setError(res.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setRating((r) => Math.min(5, r + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setRating((r) => Math.max(1, r - 1));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Rate your trip</DialogTitle>
        <DialogDescription>
          How was <span className="font-medium text-foreground">{booking.tourTitle}</span>? Your review is published after a quick check by our team.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <span id="review-rating-label" className="text-sm font-medium text-foreground">Rating</span>
        <div
          role="radiogroup"
          aria-labelledby="review-rating-label"
          className="flex items-center gap-1"
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? '' : 's'} – ${RATING_LABELS[value - 1]}`}
              tabIndex={rating === value || (rating === 0 && value === 1) ? 0 : -1}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              className="rounded-md p-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Star
                aria-hidden="true"
                className={`size-8 transition-colors ${value <= shown ? 'fill-warning text-warning' : 'fill-muted text-border'}`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted-foreground" aria-live="polite">
            {shown > 0 ? RATING_LABELS[shown - 1] : 'Select a rating'}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="review-comment">Your review (optional)</Label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={REVIEW_COMMENT_MAX}
          rows={5}
          placeholder="What did you enjoy? What could be better?"
          aria-describedby="review-comment-count"
        />
        <p id="review-comment-count" className="text-right text-xs text-muted-foreground">
          {comment.length}/{REVIEW_COMMENT_MAX}
        </p>
      </div>

      {error && (
        <Alert variant="lighterror">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="neutral" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit review'}
        </Button>
      </DialogFooter>
    </form>
  );
}
