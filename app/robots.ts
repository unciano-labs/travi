import { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://travi.ph';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Booking review/pay/success pages are per-traveler (they also send noindex).
        disallow: ['/admin/', '/dashboard/', '/api/', '/tours/*/booking/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
