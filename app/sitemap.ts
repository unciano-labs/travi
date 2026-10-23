import { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getCachedSitemapTours } from '@/lib/data/tours';

const STATIC_PAGES = [
  { path: '/about', priority: 0.5 },
  { path: '/faq', priority: 0.5 },
  { path: '/contact', priority: 0.5 },
  { path: '/terms', priority: 0.3 },
  { path: '/privacy', priority: 0.3 },
  { path: '/refund-policy', priority: 0.3 },
  { path: '/cookies', priority: 0.2 },
  { path: '/partner-terms', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://travi.ph';
  const tours = await getCachedSitemapTours();

  const tourEntries: MetadataRoute.Sitemap = tours.map((tour) => ({
    url: `${baseUrl}/tours/${tour.slug}`,
    ...(tour.updated_at ? { lastModified: new Date(tour.updated_at) } : {}),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // The catalog changes whenever any tour does; omit lastModified when there are no tours.
  const newest = tours[0]?.updated_at ? new Date(tours[0].updated_at) : undefined;

  return [
    {
      url: baseUrl,
      ...(newest ? { lastModified: newest } : {}),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/tours`,
      ...(newest ? { lastModified: newest } : {}),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // Legal and trust pages (Phase 4: LEG-01…04, LEG-11).
    ...STATIC_PAGES.map(({ path, priority }) => ({
      url: `${baseUrl}${path}`,
      changeFrequency: 'monthly' as const,
      priority,
    })),
    ...tourEntries,
  ];
}
