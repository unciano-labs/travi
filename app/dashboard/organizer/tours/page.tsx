import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Plus, MapPin, Calendar, Users, Eye, Edit2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
    <>
      <PageHeader
        title="My Tours"
        description="Manage your tour packages and itineraries."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/organizer' }, { title: 'My Tours' }]}
        actions={
          <Button asChild>
            <Link href="/dashboard/organizer/tours/new">
              <Plus />
              Create New Tour
            </Link>
          </Button>
        }
      />

      {!tours || tours.length === 0 ? (
        <CardBox>
          <EmptyState
            icon={MapPin}
            title="No tours created yet"
            description="You haven't created any tour packages. Create your first tour to start accepting bookings from travelers."
            action={
              <Button asChild variant="lightprimary">
                <Link href="/dashboard/organizer/tours/new">
                  <Plus />
                  Create your first tour
                </Link>
              </Button>
            }
          />
        </CardBox>
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
            <CardBox key={tour.id} className="group p-0 gap-0 overflow-hidden transition-colors hover:border-primary/40">
              <div className="h-48 bg-muted relative overflow-hidden">
                {tour.cover_image_url ? (
                  <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/50">
                    <MapPin className="w-8 h-8 opacity-50" />
                  </div>
                )}

                {/* Floating Badges */}
                <div className="absolute top-3 left-3">
                  <StatusBadge status={tour.status} className="bg-white/90" />
                </div>
                
                <div className="absolute bottom-3 left-3">
                  <Badge variant="gray" className="bg-white/90">
                    <Calendar className="w-3.5 h-3.5" />
                    {tour.duration_days} Days
                  </Badge>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="card-title line-clamp-1 mb-2 group-hover:text-primary transition-colors">{tour.title}</h3>
                
                {/* Inline Meta Info */}
                <div className="flex items-center text-sm text-muted-foreground mb-5">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> {tour.location}
                  </span>
                  <span className="mx-2">•</span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> {maxPax}
                  </span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex flex-col">
                    {upcomingSchedules.length > 0 ? (
                      <>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                          Starting from
                        </span>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="flex items-baseline gap-1">
                            ₱{lowestPrice.toLocaleString()} <span className="text-[11px] text-muted-foreground font-medium">/pax</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-sm italic text-muted-foreground py-1">
                        No schedules set
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button asChild variant="ghostprimary" size="iconsm">
                      <Link href={`/dashboard/organizer/tours/${tour.id}/edit?tab=schedules`} title="Manage Schedules" aria-label="Manage Schedules">
                        <Calendar />
                      </Link>
                    </Button>
                    <Button asChild variant="ghostprimary" size="iconsm">
                      <Link href={`/dashboard/organizer/tours/${tour.id}/edit`} title="Edit Tour" aria-label="Edit Tour">
                        <Edit2 />
                      </Link>
                    </Button>
                    <Button asChild variant="ghostprimary" size="iconsm">
                      <Link href={`/tours/${tour.slug}`} target="_blank" title="View Public Page" aria-label="View Public Page">
                        <Eye />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardBox>
            );
          })}
        </div>
      )}
    </>
  );
}
