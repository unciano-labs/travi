import { MetadataRoute } from 'next';
import { getCachedPublicTours } from '@/lib/data/tours';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://travi.ph';
  const { tours } = await getCachedPublicTours(0, 100);

  const tourEntries: MetadataRoute.Sitemap = (tours || []).map((tour: any) => ({
    url: `${baseUrl}/tours/${tour.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...tourEntries,
  ];
}
