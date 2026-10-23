import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { MapPin, Clock, Users, Car, Check, Calendar, BadgeCheck, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import TourBookingCard from '@/components/landing/TourBookingCard';
import TourReviewsCarousel from '@/components/landing/TourReviewsCarousel';
import Image from 'next/image';
import { TourJsonLd } from '@/components/seo/TourJsonLd';
import { getCachedTourBySlug } from '@/lib/data/tours';
import { getCachedTourReviews } from '@/lib/data/reviews';
import { getCachedOrganizerMerchant } from '@/lib/data/merchant';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

// getCachedTourBySlug is wrapped in React cache(): generateMetadata and the page share one fetch.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tour = await getCachedTourBySlug(slug);

  if (!tour) {
    return { title: 'Tour Not Found - Travi', robots: { index: false } };
  }

  const description = (tour.description || 'Discover incredible local tour packages on Travi.').substring(0, 160) + '...';

  return {
    title: `${tour.title || 'Tour'} | Travi`,
    description,
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title: `${tour.title || 'Tour'} - Tour in ${tour.location || 'Philippines'}`,
      url: `/tours/${tour.slug}`,
      description,
      images: tour.cover_image_url ? [tour.cover_image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tour.title || 'Tour'} | Travi`,
      description,
      images: tour.cover_image_url ? [tour.cover_image_url] : [],
    },
  };
}


export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const tour = await getCachedTourBySlug(slug);

  if (!tour) {
    notFound();
  }

  const [reviews, merchant] = await Promise.all([
    getCachedTourReviews(tour.id),
    getCachedOrganizerMerchant(tour.organizer_id),
  ]);
  const organizerName = merchant?.displayName || tour.organizer?.display_name || tour.organizer?.company_name || 'Tour organizer';

  const defaultImage = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TourJsonLd tour={tour} />
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-[60vh] min-h-[500px] w-full bg-slate-900">
          <div className="absolute inset-0 overflow-hidden">
            <Image 
              src={tour.cover_image_url || defaultImage} 
              alt={tour.title}
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
          </div>
          
          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-coral font-medium mb-4">
                <MapPin className="w-5 h-5" />
                <span className="text-lg tracking-wide">{tour.location}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 font-display leading-tight">
                {tour.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-white/90">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 opacity-70" />
                  <span>{tour.duration_days || 1} Day{(tour.duration_days || 1) > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 opacity-70" />
                  <span>Max {tour.capacity || 10} guests</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 opacity-70" />
                  <span className="capitalize">{(tour.transport_type || 'van').replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Main Content (Left) */}
            <div className="lg:col-span-2 space-y-12">
              
              {/* Overview */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
                <div className="prose prose-slate prose-lg max-w-none text-slate-600 leading-relaxed">
                  <ReactMarkdown>{tour.description || ''}</ReactMarkdown>
                </div>
              </div>

              {/* Highlights & Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-coral" /> Upcoming Dates
                  </h3>
                  {tour.schedules && tour.schedules.length > 0 ? (
                    <>
                      {/* Mobile View */}
                      <div className="block md:hidden space-y-3 mt-4">
                        {tour.schedules
                          .filter((s: any) => s.status === 'open' && new Date(s.start_date) > new Date())
                          .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                          .map((schedule: any) => (
                            <LazyMobileCard
                              key={schedule.id}
                              rows={[
                                {
                                  label: 'Dates',
                                  value: (
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                      <span className="text-sm font-medium text-slate-700">
                                        {new Date(schedule.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(schedule.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    </div>
                                  ),
                                  fullWidth: true
                                }
                              ]}
                              actions={
                                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">
                                  Available
                                </span>
                              }
                            />
                        ))}
                      </div>

                      {/* Desktop View */}
                      <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden mt-4">
                        <table className="w-full text-left border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            {tour.schedules
                              .filter((s: any) => s.status === 'open' && new Date(s.start_date) > new Date())
                              .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                              .map((schedule: any) => (
                                <tr key={schedule.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="py-3 px-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                                      <span className="text-sm font-medium text-slate-700">
                                        {new Date(schedule.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(schedule.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 group-hover:text-coral transition-colors">
                                      Available
                                    </span>
                                  </td>
                                </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">No open dates available currently.</p>
                  )}
                </div>
                {tour.accommodation_details && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Check className="w-5 h-5 text-coral" /> Accommodation
                    </h3>
                    <p className="text-slate-600">{tour.accommodation_details}</p>
                  </div>
                )}
              </div>

              {/* Gallery */}
              {tour.image_urls && tour.image_urls.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Gallery</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {tour.image_urls.map((url: string, i: number) => (
                      <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm relative group">
                        <Image 
                           src={url} 
                           alt={`${tour.title} image ${i+1}`} 
                           fill
                           sizes="(max-width: 768px) 50vw, 33vw"
                           className="object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Itinerary */}
              {tour.itineraries && tour.itineraries.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Itinerary</h2>
                  <div className="space-y-6">
                    {tour.itineraries.sort((a: any, b: any) => a.day_number - b.day_number).map((day: any) => (
                      <div key={day.id} className="relative pl-8 pb-8 border-l-2 border-slate-200 last:border-l-transparent last:pb-0">
                        <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-coral border-4 border-slate-50"></div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Day {day.day_number}: {day.title}</h3>
                        <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                          <ReactMarkdown>{day.description || ''}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              {reviews && reviews.length > 0 && (
                <TourReviewsCarousel reviews={reviews} />
              )}
            </div>

            {/* Booking Card (Right) */}
            <div className="lg:col-span-1 space-y-6">
              <TourBookingCard tour={tour} />

              {/* Merchant of record (RA 11967 / LEG-06) */}
              <section aria-labelledby="operator-heading" className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-sm">
                <h2 id="operator-heading" className="text-base font-bold text-slate-900 mb-3">Operated by</h2>
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  {organizerName}
                  {merchant?.dotAccreditationNo && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <BadgeCheck className="w-4 h-4" aria-hidden="true" /> DOT accredited
                    </span>
                  )}
                </p>
                {(merchant?.businessName || merchant?.legalName) && (
                  <p className="text-slate-600 mt-1">
                    Registered name: {merchant.businessName || merchant.legalName}
                  </p>
                )}
                {merchant?.dotAccreditationNo && (
                  <p className="text-slate-500 mt-1">DOT accreditation no. {merchant.dotAccreditationNo}</p>
                )}
                {merchant?.contactEmail ? (
                  <a href={`mailto:${merchant.contactEmail}`} className="mt-3 inline-flex items-center gap-2 font-medium text-brand hover:text-brand-dark">
                    <Mail className="w-4 h-4" aria-hidden="true" /> {merchant.contactEmail}
                  </a>
                ) : (
                  <p className="text-slate-500 mt-3">After booking, you can reach the organizer from your Travi bookings page.</p>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  This tour is sold and operated by the organizer above. Travi verifies organizers before their tours are listed.
                </p>
              </section>
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
