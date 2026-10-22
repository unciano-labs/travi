import { z } from 'zod';

export const REVIEW_COMMENT_MAX = 1000;

export const createReviewSchema = z.object({
  bookingId: z.string().uuid('Invalid booking ID'),
  rating: z.coerce.number().int('Rating must be a whole number').min(1, 'Pick a rating from 1 to 5').max(5, 'Pick a rating from 1 to 5'),
  comment: z
    .string()
    .trim()
    .max(REVIEW_COMMENT_MAX, `Keep your review under ${REVIEW_COMMENT_MAX} characters`)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const reviewModerationSchema = z.object({
  reviewId: z.string().uuid('Invalid review ID'),
  action: z.enum(['publish', 'hide', 'delete']),
});

export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type ReviewModerationAction = z.infer<typeof reviewModerationSchema>['action'];
