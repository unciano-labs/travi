export function TourJsonLd({
  tour,
  baseUrl = 'https://travi.ph',
}: {
  tour: {
    title: string;
    description: string;
    slug: string;
    location: string;
    price_per_person: number;
    cover_image_url?: string | null;
    duration_days?: number;
    organizer?: {
      display_name?: string;
      company_name?: string;
    };
  };
  baseUrl?: string;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: tour.title || 'Tour Package',
    description: tour.description || '',
    touristType: ['Adventure', 'Leisure', 'Culture'],
    offers: {
      '@type': 'Offer',
      price: tour.price_per_person || 0,
      priceCurrency: 'PHP',
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/tours/${tour.slug}`,
    },
    provider: {
      '@type': 'Organization',
      name: tour.organizer?.display_name || tour.organizer?.company_name || 'Travi Partner',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
