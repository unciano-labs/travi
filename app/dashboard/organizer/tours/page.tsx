import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, MapPin, Calendar, Users, Eye } from 'lucide-react';

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

  // Fetch tours for this organizer
  const { data: tours } = await supabase
    .from('tours')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });

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
          {tours.map((tour) => (
            <div key={tour.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="h-40 bg-slate-100 relative">
                {tour.cover_image_url ? (
                  <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <MapPin className="w-8 h-8 opacity-50" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full shadow-sm ${
                    tour.status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                    tour.status === 'draft' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {tour.status.charAt(0).toUpperCase() + tour.status.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-slate-900 line-clamp-1 mb-1">{tour.title}</h3>
                <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-4">
                  <MapPin className="w-4 h-4" /> {tour.location}
                </p>
                
                <div className="grid grid-cols-2 gap-y-3 mb-6 mt-auto">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{tour.duration_days} Days</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>Up to {tour.capacity}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="font-bold text-brand-navy">
                    ₱{tour.price_per_person.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/pax</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/organizer/tours/${tour.id}`} className="p-2 text-slate-400 hover:text-brand-navy transition-colors">
                      <Eye className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
