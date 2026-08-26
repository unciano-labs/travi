import { MapPin, Calendar, Star, Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';

export default async function TravelerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  // Fetch all bookings for traveler
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      tour_schedules (
        start_date,
        end_date,
        tours (
          title,
          slug,
          location,
          cover_image_url,
          organizer_profiles (
            display_name,
            company_name
          )
        )
      )
    `)
    .eq('traveler_id', profile.id)
    .order('created_at', { ascending: false });

  const allBookings = (bookings as any[]) || [];
  
  const now = new Date();
  
  // Calculate stats
  const upcomingTours = allBookings.filter(b => {
    const startDate = new Date(b.tour_schedules.start_date);
    return startDate >= now && b.status !== 'canceled' && b.status !== 'refunded';
  });
  
  const pastBookings = allBookings.filter(b => {
    const endDate = new Date(b.tour_schedules.end_date);
    return endDate < now || b.status === 'completed';
  });

  // Sort upcoming to find the "Next Adventure"
  upcomingTours.sort((a, b) => new Date(a.tour_schedules.start_date).getTime() - new Date(b.tour_schedules.start_date).getTime());
  const nextAdventure = upcomingTours[0];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile.full_name?.split(' ')[0] || 'Traveler'}!</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4 hover:border-coral/30 transition-colors">
          <div className="p-3 bg-coral/10 text-coral rounded-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming Tours</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{upcomingTours.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-brand-navy/10 text-brand-navy rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Past Bookings</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{pastBookings.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Bookings</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{allBookings.length}</p>
          </div>
        </div>
      </div>
      
      {nextAdventure && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900">Your Next Adventure</h2>
            <Link href={`/tours/${nextAdventure.tour_schedules.tours.slug}`} className="text-sm font-semibold text-coral hover:underline">
              View Tour
            </Link>
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-6 items-center">
            <div className="w-full sm:w-64 h-40 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 relative border border-slate-200">
               {nextAdventure.tour_schedules.tours.cover_image_url ? (
                 <Image 
                   src={nextAdventure.tour_schedules.tours.cover_image_url} 
                   alt={nextAdventure.tour_schedules.tours.title}
                   fill
                   className="object-cover"
                 />
               ) : (
                 <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                   <MapPin className="w-8 h-8 opacity-50" />
                 </div>
               )}
            </div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-2">
                <div className="inline-block px-3 py-1 bg-coral/10 text-coral text-xs font-bold rounded-full">
                  Upcoming
                </div>
                <div className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full capitalize">
                  {nextAdventure.status}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900">{nextAdventure.tour_schedules.tours.title}</h3>
              <p className="text-slate-500 mt-1 font-medium flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {nextAdventure.tour_schedules.tours.location}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                 <div className="text-sm">
                   <span className="text-slate-400 block mb-1">Start Date</span>
                   <span className="font-bold text-slate-900">{new Date(nextAdventure.tour_schedules.start_date).toLocaleDateString()}</span>
                 </div>
                 <div className="text-sm">
                   <span className="text-slate-400 block mb-1">End Date</span>
                   <span className="font-bold text-slate-900">{new Date(nextAdventure.tour_schedules.end_date).toLocaleDateString()}</span>
                 </div>
                 <div className="text-sm">
                   <span className="text-slate-400 block mb-1">Guests</span>
                   <span className="font-bold text-slate-900">{nextAdventure.seats} Pax</span>
                 </div>
                 <div className="text-sm">
                   <span className="text-slate-400 block mb-1">Total Paid</span>
                   <span className="font-bold text-coral">₱{nextAdventure.total_amount.toLocaleString()}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">My Bookings</h2>
        </div>
        
        {allBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Ticket className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-900 mb-2">No bookings yet</p>
            <p>You haven't booked any tours. <Link href="/tours" className="text-coral hover:underline">Start exploring!</Link></p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {allBookings.map((booking) => (
              <div key={booking.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{booking.tour_schedules.tours.title}</h3>
                  <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(booking.tour_schedules.start_date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {booking.tour_schedules.tours.location}</span>
                  </div>
                </div>
                <div className="flex flex-row md:flex-col gap-4 md:gap-2 items-center md:items-end w-full md:w-auto">
                  <div className="text-right">
                    <span className="block text-sm text-slate-500">Amount</span>
                    <span className="font-bold text-slate-900">₱{booking.total_amount.toLocaleString()}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                    booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    booking.status === 'canceled' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {booking.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
