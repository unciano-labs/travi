import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { MapPin, Clock, Users, Car, Check, Calendar, PhilippinePeso, Star } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import TourBookingCard from '@/components/landing/TourBookingCard';

// TEMP: Mock reviews — hardcoded for demo until real review data is wired up.
// Each entry matches the shape returned by the `reviews` Supabase query above
// (rating, comment, created_at, nested user_profiles.full_name/avatar_url).
const MOCK_REVIEWS = [
  {
    id: 'mock-1',
    rating: 5,
    comment: 'The rolling green hills of Batanes are unreal. Sunrise at Marlboro Hills was the highlight of my whole trip — our guide knew exactly where to stop for photos.',
    created_at: '2026-07-18T09:30:00Z',
    user_profiles: { full_name: 'Maria Santos', avatar_url: 'https://ui-avatars.com/api/?name=Maria+Santos&background=0EA5E9&color=fff' },
  },
  {
    id: 'mock-2',
    rating: 5,
    comment: 'Breathtaking is an understatement! The coastline views at Alapads Point and the honesty coffee shops in Basco made this a once-in-a-lifetime experience.',
    created_at: '2026-07-02T14:12:00Z',
    user_profiles: { full_name: 'John Carlo Reyes', avatar_url: 'https://ui-avatars.com/api/?name=John+Carlo+Reyes&background=10B981&color=fff' },
  },
  {
    id: 'mock-3',
    rating: 4,
    comment: 'Really scenic tour and very organized. Only wish we had more time at the Honesty Coffee Shop and the lighthouse. Still a great 3 days in Batanes.',
    created_at: '2026-06-21T11:05:00Z',
    user_profiles: { full_name: 'Angela Lim', avatar_url: 'https://ui-avatars.com/api/?name=Angela+Lim&background=F59E0B&color=fff' },
  },
  {
    id: 'mock-4',
    rating: 5,
    comment: 'Our driver and guide were fantastic and the landscapes went beyond the pictures. The overnight stay in Sabtang was cozy and the local food was amazing.',
    created_at: '2026-06-09T08:45:00Z',
    user_profiles: { full_name: 'Mark Dela Cruz', avatar_url: 'https://ui-avatars.com/api/?name=Mark+Dela+Cruz&background=8B5CF6&color=fff' },
  },
  {
    id: 'mock-5',
    rating: 3,
    comment: 'Nice sceneries but the van was a bit cramped and we hit heavy fog on the hills. Worth it overall, just set expectations on the weather.',
    created_at: '2026-05-27T16:20:00Z',
    user_profiles: { full_name: 'Rica Mendoza', avatar_url: 'https://ui-avatars.com/api/?name=Rica+Mendoza&background=EC4899&color=fff' },
  },
  {
    id: 'mock-6',
    rating: 5,
    comment: 'The Paverial Hills and the long coastline stayed with me long after the trip. Excellent value and the accommodation right by the cliffs was idyllic.',
    created_at: '2026-05-14T13:00:00Z',
    user_profiles: { full_name: 'Dante Villanueva', avatar_url: 'https://ui-avatars.com/api/?name=Dante+Villanueva&background=0EA5E9&color=fff' },
  },
  {
    id: 'mock-7',
    rating: 4,
    comment: 'Beautiful landscapes and a thoughtful itinerary. The day-trip seafood barbecue by the ravine was unforgettable — bring a good camera and layers.',
    created_at: '2026-04-28T10:40:00Z',
    user_profiles: { full_name: 'Liza Fernandez', avatar_url: 'https://ui-avatars.com/api/?name=Liza+Fernandez&background=10B981&color=fff' },
  },
  {
    id: 'mock-8',
    rating: 2,
    comment: 'Great place but our pickup was delayed and one itinerary stop was skipped due to "road closures." Lucky the scenery forgave the logistics issues.',
    created_at: '2026-04-11T17:55:00Z',
    user_profiles: { full_name: 'Paolo Mercado', avatar_url: 'https://ui-avatars.com/api/?name=Paolo+Mercado&background=8B5CF6&color=fff' },
  },
  {
    id: 'mock-9',
    rating: 5,
    comment: 'From the cliffs to the stony coves, everything was pristine. Our organizer handled the travel_bookings with a local carrier who was wonderful. 10/10.',
    created_at: '2026-03-22T09:15:00Z',
    user_profiles: { full_name: 'Katrina Aquino', avatar_url: 'https://ui-avatars.com/api/?name=Katrina+Aquino&background=F59E0B&color=fff' },
  },
  {
    id: 'mock-10',
    rating: 4,
    comment: 'Stunning, peaceful, and quiet — exactly as advertised. A little expensive for the budget traveler, but for the scenery it was worth every peso.',
    created_at: '2026-03-05T12:25:00Z',
    user_profiles: { full_name: 'Miguel Torres', avatar_url: 'https://ui-avatars.com/api/?name=Miguel+Torres&background=EC4899&color=fff' },
  },
];
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
            <img 
              src={tour.cover_image_url || defaultImage} 
              alt={tour.title}
              className="w-full h-full object-cover opacity-60"
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
                      <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm">
                        <img src={url} alt={`${tour.title} image ${i+1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
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
              <div className="pt-8 border-t border-slate-100 mt-12">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Reviews</h2>
                  <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                    <Star className="w-5 h-5 fill-coral text-coral" />
                    <span className="font-bold text-slate-900 text-lg">
                      {(MOCK_REVIEWS.reduce((acc: number, r: any) => acc + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1)}
                    </span>
                    <span className="text-slate-500">({MOCK_REVIEWS.length} review{MOCK_REVIEWS.length === 1 ? '' : 's'})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {MOCK_REVIEWS.map((review: any) => (
                    <div key={review.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4 mb-4">
                        <img 
                          src={review.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent((review.user_profiles?.full_name || 'User'))}&background=0EA5E9&color=fff`} 
                          alt="Reviewer" 
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-50"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{review.user_profiles?.full_name || 'Anonymous User'}</div>
                          <div className="text-xs font-medium text-slate-400">{new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 mb-3">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-coral text-coral' : 'fill-slate-100 text-slate-200'}`} />
                        ))}
                      </div>
                      <p className="text-slate-600 leading-relaxed text-sm">"{review.comment}"</p>
                    </div>
                  ))}
                </div>
              </div>
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
