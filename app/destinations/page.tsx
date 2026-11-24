import type { Metadata } from 'next';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import DestinationsBrowser from '@/components/landing/DestinationsBrowser';
import { getCachedDestinations } from '@/lib/data/destinations';
import { serializeJsonLd } from '@/lib/json-ld';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Philippine Travel Destinations | Travi',
  description:
    'Explore top Philippine travel destinations — Palawan, Siargao, Cebu, Bohol, Boracay, Sagada, Batanes and more — with live tour schedules and local organizer pricing.',
  alternates: { canonical: '/destinations' },
  openGraph: {
    title: 'Philippine Travel Destinations | Travi',
    description:
      'Compare destinations across Luzon, Visayas, and Mindanao and book verified local tours with GCash or Maya.',
    url: '/destinations',
    type: 'website',
  },
};

export default async function DestinationsPage() {
  const { destinations, totalActiveTours } = await getCachedDestinations();
  const activeDestCount = destinations.filter((d) => d.tourCount > 0).length;
  const baseUrl = env.NEXT_PUBLIC_SITE_URL || 'https://travi.ph';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Philippine Travel Destinations on Travi',
    itemListElement: destinations.map((d, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'TouristDestination',
        name: d.name,
        description: d.highlight,
        url: `${baseUrl}/tours?destination=${encodeURIComponent(d.query)}`,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Header />

      <main className="flex-grow">
        <section className="bg-brand-navy pt-28 pb-12 lg:pt-32 lg:pb-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">
              Explore the Philippines
            </p>
            <h1 className="text-3xl lg:text-5xl font-extrabold text-white mb-4">
              Where will you explore next?
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Browse {activeDestCount} active destinations across Luzon, Visayas, and Mindanao with{' '}
              {totalActiveTours} scheduled tours from verified local organizers.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <DestinationsBrowser destinations={destinations} />
        </section>
      </main>

      <Footer />
    </div>
  );
}

