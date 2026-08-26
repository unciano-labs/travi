'use server';

import { getCachedPublicTours } from '@/lib/data/tours';

export async function getPublicTours(offset = 0, limit = 6) {
  return await getCachedPublicTours(offset, limit);
}
