import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, MapPin, Calendar, Users, Eye, Edit2 } from 'lucide-react';

export default async function OrganizerToursPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Find organizer profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, organizer_profiles(id)')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.organizer_profiles) {
    return null;
  }

  // Supabase returns 1-to-1 relations as objects, not arrays, when UNIQUE constraint exists
  const organizerProfile = Array.isArray(profile.organizer_profiles) 
    ? profile.organizer_profiles[0] 
    : profile.organizer_profiles;
    
  if (!organizerProfile) {
    return null;
  }

  const organizerId = (organizerProfile as any).id;

  // Fetch tours for this organizer with their schedules to calculate dynamic max pax
  const { data: toursData } = await supabase
    .from('tours')
    .select(`
      *,
      tour_schedules (
        capacity,
        end_date,
        price_per_person
      )
    `)
    .eq('organizer_id', organizerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const tours = toursData || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Tours</h1>
          <p className="text-slate-600 mt-1">Manage your tour packages and itineraries.</p>
        </div>
        <Link 
          href="/dashboard/organizer/tours/new" 
          className="bg-coral hover:bg-coral/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create New Tour
        </Link>
      </div>

      {!tours || tours.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No tours created yet</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            You haven't created any tour packages. Create your first tour to start accepting bookings from travelers.
          </p>
          <Link 
            href="/dashboard/organizer/tours/new" 
            className="inline-flex items-center gap-2 text-coral font-medium hover:text-coral/80"
          >
            <Plus className="w-5 h-5" />
            Create your first tour
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tours.map((tour) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const upcomingSchedules = tour.tour_schedules?.filter(
              (s: any) => new Date(s.end_date) >= today
            ) || [];
            
            const maxPax = upcomingSchedules.length > 0 
              ? Math.max(...upcomingSchedules.map((s: any) => s.capacity))
              : tour.capacity;

            const lowestPrice = upcomingSchedules.length > 0
              ? Math.min(
                  ...upcomingSchedules.map((s: any) => 
                    s.price_per_person !== null ? s.price_per_person : tour.price_per_person
                  )
                )
              : tour.price_per_person;

            return (
            <div key={tour.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 overflow-hidden flex flex-col">
              <div className="h-48 bg-slate-100 relative overflow-hidden">
                {tour.cover_image_url ? (
                  <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                    <MapPin className="w-8 h-8 opacity-50" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Floating Badges */}
                <div className="absolute top-3 left-3">
                  <span className={`px-3 py-1.5 text-[11px] font-bold tracking-wide uppercase rounded-full backdrop-blur-md border ${
                    tour.status === 'published' ? 'bg-emerald-500/20 text-emerald-900 border-emerald-500/30' :
                    tour.status === 'draft' ? 'bg-amber-500/20 text-amber-900 border-amber-500/30' :
                    'bg-slate-500/20 text-slate-900 border-slate-500/30'
                  }`}>
                    {tour.status}
                  </span>
                </div>
                
                <div className="absolute bottom-3 left-3">
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-900/80 text-white backdrop-blur-md flex items-center gap-1.5 shadow-sm border border-white/10">
                    <Calendar className="w-3.5 h-3.5" />
                    {tour.duration_days} Days
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-slate-900 line-clamp-1 mb-2 group-hover:text-coral transition-colors">{tour.title}</h3>
                
                {/* Inline Meta Info */}
                <div className="flex items-center text-sm text-slate-500 font-medium mb-5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" /> {tour.location}
                  </span>
                  <span className="mx-2 text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" /> {maxPax}
                  </span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    {upcomingSchedules.length > 0 ? (
                      <>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                          Starting from
                        </span>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="flex items-baseline gap-1">
                            ₱{lowestPrice.toLocaleString()} <span className="text-[11px] text-slate-500 font-medium">/pax</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm italic text-slate-400 py-1">
                        No schedules set
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/organizer/tours/${tour.id}/edit?tab=schedules`} className="p-2 text-slate-400 hover:text-coral hover:bg-coral-50 rounded-lg transition-all" title="Manage Schedules">
                      <Calendar className="w-4 h-4" />
                    </Link>
                    <Link href={`/dashboard/organizer/tours/${tour.id}/edit`} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Tour">
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <Link href={`/tours/${tour.slug}`} target="_blank" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all" title="View Public Page">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
