import { z } from 'zod';

export const tourSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  location: z.string().min(1, 'Specific address/meetup point is required'),
  pricePerPerson: z.coerce.number().min(0, 'Price cannot be negative'),
  durationDays: z.coerce.number().min(1),
  accommodationDetails: z.string().optional(),
  travelTimeInfo: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  imageUrls: z.array(z.string()).default([]),
  coverImageUrl: z.string().optional(),
  format: z.enum(['joiner', 'private', 'solo']).default('joiner'),
  themes: z.array(z.string()).default([]),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  itineraries: z.string().optional(),
});

export const TOUR_STATUSES = ['draft', 'published', 'archived'] as const;
export type TourStatus = (typeof TOUR_STATUSES)[number];
