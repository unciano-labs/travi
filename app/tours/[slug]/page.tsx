import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { MapPin, Clock, Users, Car, Check, Calendar, PhilippinePeso, Star } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import TourBookingCard from '@/components/landing/TourBookingCard';
import TourReviewsCarousel from '@/components/landing/TourReviewsCarousel';
import Image from 'next/image';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tour } = await supabase.from('tours').select('title, description, location, cover_image_url').eq('slug', slug).single();

  if (!tour) {
    return { title: 'Tour Not Found - Travi' };
  }

  return {
    title: `${tour.title} | Travi`,
    description: tour.description.substring(0, 160) + '...',
    openGraph: {
      title: `${tour.title} - Tour in ${tour.location}`,
      description: tour.description.substring(0, 160) + '...',
      images: tour.cover_image_url ? [tour.cover_image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tour.title} | Travi`,
      description: tour.description.substring(0, 160) + '...',
      images: tour.cover_image_url ? [tour.cover_image_url] : [],
    },
  };
}


export default async function TourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const supabase = await createClient();
  
  // Fetch tour details
  const { data: tour, error } = await supabase
    .from('tours')
    .select(`
      *,
      organizer:organizer_profiles (
        id,
        company_name,
        display_name,
        user_profiles (email)
      ),
      itineraries:tour_itineraries (*),
      schedules:tour_schedules (*),
      reviews (
        id,
        rating,
        comment,
        created_at,
        user_profiles (
          full_name,
          avatar_url
        )
      )
    `)
    .eq('slug', slug)
    .single();

  if (error || !tour) {
    console.error("Tour fetch error:", error);
    notFound();
  }

  const defaultImage = "https://images.unsplash.com/photo-1544413155-44282362b7ff?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
                  <span>{tour.duration_days} Day{tour.duration_days > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 opacity-70" />
                  <span>Max {tour.capacity} guests</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-5 h-5 opacity-70" />
                  <span className="capitalize">{tour.transport_type.replace('_', ' ')}</span>
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
                  <ReactMarkdown>{tour.description}</ReactMarkdown>
                </div>
              </div>

              {/* Highlights & Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-coral" /> Upcoming Dates
                  </h3>
                  {tour.schedules && tour.schedules.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
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
                          <ReactMarkdown>{day.description}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              {tour.reviews && tour.reviews.length > 0 && (
                <TourReviewsCarousel reviews={tour.reviews} />
              )}
            </div>

            {/* Booking Card (Right) */}
            <div className="lg:col-span-1">
              <TourBookingCard tour={tour} />
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
