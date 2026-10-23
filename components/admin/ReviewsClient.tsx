'use client';

import { useState } from 'react';
import { CheckCircle2, EyeOff, MessageSquare, Star, Trash2 } from 'lucide-react';
import { publishReview, hideReview, deleteReview } from '@/actions/reviews';
import CardBox from '@/components/ui/CardBox';
import ConfirmModal from '@/components/ui/ConfirmModal';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';

type ReviewStatus = 'pending' | 'published' | 'hidden';
type ModerationAction = 'publish' | 'hide' | 'delete';

type Review = {
  id: string;
  reviewer_profile_id: string;
  transporter_id: string | null;
  tour_id: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  created_at: string;
  reviewer: { full_name: string; email: string };
  target_name: string;
};

const TABS: { value: ReviewStatus; label: string; empty: string }[] = [
  { value: 'pending', label: 'Pending', empty: 'No reviews waiting for moderation.' },
  { value: 'published', label: 'Published', empty: 'No published reviews yet.' },
  { value: 'hidden', label: 'Hidden', empty: 'No hidden reviews.' },
];

const CONFIRM: Record<ModerationAction, { title: string; message: string; confirmText: string; destructive: boolean }> = {
  publish: {
    title: 'Publish review?',
    message: 'The review will be shown publicly and will count towards the rating.',
    confirmText: 'Publish',
    destructive: false,
  },
  hide: {
    title: 'Hide review?',
    message: 'The review will no longer be visible to users and will not count towards the rating.',
    confirmText: 'Hide',
    destructive: true,
  },
  delete: {
    title: 'Delete review?',
    message: 'The review will be removed from the moderation queue. It is kept in the database (soft delete) for the audit trail.',
    confirmText: 'Delete',
    destructive: true,
  },
};

const RUN: Record<ModerationAction, (id: string) => ReturnType<typeof publishReview>> = {
  publish: publishReview,
  hide: hideReview,
  delete: deleteReview,
};

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-warning" aria-label={`${value} out of 5 stars`}>
      <Star className="w-4 h-4 fill-current" aria-hidden="true" />
      <span className="font-medium text-bodytext">{value}</span>
    </div>
  );
}

export default function ReviewsClient({ initialReviews }: { initialReviews: Review[] }) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [pendingAction, setPendingAction] = useState<{ id: string; action: ModerationAction } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const counts = {
    pending: reviews.filter((r) => r.status === 'pending').length,
    published: reviews.filter((r) => r.status === 'published').length,
    hidden: reviews.filter((r) => r.status === 'hidden').length,
  };

  const runAction = async () => {
    if (!pendingAction) return;
    const { id, action } = pendingAction;
    setPendingAction(null);
    setProcessingId(id);
    setFeedback(null);
    try {
      const res = await RUN[action](id);
      if (res.success) {
        setReviews((prev) =>
          res.deleted ? prev.filter((r) => r.id !== id) : prev.map((r) => (r.id === id ? { ...r, status: res.status } : r))
        );
        setFeedback({
          type: 'success',
          message: action === 'publish' ? 'Review published.' : action === 'hide' ? 'Review hidden.' : 'Review deleted.',
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update the review.' });
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setProcessingId(null);
    }
  };

  const renderActions = (review: Review, mobile = false) => {
    const busy = processingId === review.id;
    const size = mobile ? 'default' : 'sm';
    const cls = mobile ? 'flex-1' : undefined;
    return (
      <div className={mobile ? 'flex gap-2' : 'flex justify-end gap-1'}>
        {review.status !== 'published' && (
          <Button type="button" variant={mobile ? 'lightsuccess' : 'ghostsuccess'} size={size} className={cls} disabled={busy}
            onClick={() => setPendingAction({ id: review.id, action: 'publish' })}
            aria-label={`Publish review by ${review.reviewer.full_name}`}>
            <CheckCircle2 aria-hidden="true" />
            Publish
          </Button>
        )}
        {review.status !== 'hidden' && (
          <Button type="button" variant={mobile ? 'lightwarning' : 'ghostwarning'} size={size} className={cls} disabled={busy}
            onClick={() => setPendingAction({ id: review.id, action: 'hide' })}
            aria-label={`Hide review by ${review.reviewer.full_name}`}>
            <EyeOff aria-hidden="true" />
            Hide
          </Button>
        )}
        <Button type="button" variant={mobile ? 'lighterror' : 'ghosterror'} size={size} className={cls} disabled={busy}
          onClick={() => setPendingAction({ id: review.id, action: 'delete' })}
          aria-label={`Delete review by ${review.reviewer.full_name}`}>
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
    );
  };

  const renderList = (list: Review[], emptyText: string) =>
    list.length === 0 ? (
      <EmptyState icon={MessageSquare} title={emptyText} />
    ) : (
      <>
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
              {list.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="px-6 py-4">
                    <h6 className="text-sm font-semibold text-foreground">{review.reviewer.full_name}</h6>
                    <p className="text-muted-foreground text-xs font-medium">{review.reviewer.email}</p>
                    <p className="text-muted-foreground text-xs mt-1">{formatDateTime(review.created_at)}</p>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {review.target_name}
                    <div className="text-xs text-muted-foreground mt-0.5">{review.tour_id ? 'Tour' : 'Transport'}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Rating value={review.rating} />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <p className="line-clamp-3 whitespace-pre-wrap" title={review.comment ?? undefined}>
                      {review.comment || <span className="text-muted-foreground">No comment</span>}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <StatusBadge status={review.status} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">{renderActions(review)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden divide-y divide-border">
          {list.map((review) => (
            <div key={review.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold text-foreground">{review.reviewer.full_name}</div>
                  <div className="text-muted-foreground text-sm">{review.target_name} ({review.tour_id ? 'Tour' : 'Transport'})</div>
                  <div className="text-muted-foreground text-xs mt-0.5">{formatDateTime(review.created_at)}</div>
                </div>
                <StatusBadge status={review.status} />
              </div>
              <Rating value={review.rating} />
              <p className="text-bodytext text-sm whitespace-pre-wrap">
                {review.comment || <span className="text-muted-foreground">No comment</span>}
              </p>
              {renderActions(review, true)}
            </div>
          ))}
        </div>
      </>
    );

  const confirm = pendingAction ? CONFIRM[pendingAction.action] : null;

  return (
    <CardBox className="p-0 gap-0 overflow-hidden">
      <Tabs value={tab} onValueChange={(value) => setTab(value as ReviewStatus)}>
        <div className="px-6 py-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h5 className="card-title">Moderation Queue</h5>
            <p className="text-sm text-muted-foreground">New reviews stay hidden until you publish them.</p>
          </div>
          <TabsList aria-label="Filter reviews by status">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({counts[t.value]})
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {feedback && (
          <div className="px-6 pt-4">
            <Alert variant={feedback.type === 'success' ? 'lightsuccess' : 'lighterror'}>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          </div>
        )}

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0">
            {renderList(reviews.filter((r) => r.status === t.value), t.empty)}
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmModal
        isOpen={pendingAction !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText}
        isDestructive={confirm?.destructive}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </CardBox>
  );
}
