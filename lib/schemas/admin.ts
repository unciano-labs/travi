import { z } from 'zod';

export const idSchema = z.string().min(1, 'ID is required');

export const rejectSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  reason: z.string().optional(),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().min(1, 'Review ID is required'),
  action: z.enum(['hide', 'publish', 'delete']),
});

export const modifyRoleSchema = z.object({
  userProfileId: z.string().min(1, 'User Profile ID is required'),
  role: z.enum(['admin', 'traveler', 'organizer', 'transporter']),
  operation: z.enum(['grant', 'revoke']),
});
