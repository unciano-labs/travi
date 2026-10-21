'use client';

import { useState } from 'react';
import { Search, MapPin, Clock, DollarSign, Calendar, X, Building, Image as ImageIcon, ArrowRight, Users, Map as MapIcon } from 'lucide-react';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import CardBox from '@/components/ui/CardBox';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Tour {
  id: string;
  title: string;
  slug: string;
  description: string;
  location: string;
  price_per_person: number;
  duration_days: number;
  status: 'draft' | 'published' | 'archived';
  cover_image_url: string | null;
  created_at: string;
  organizer_profiles: {
    display_name: string;
    company_name: string | null;
  } | null;
  tour_schedules?: {
    id: string;
    start_date: string;
    end_date: string;
    capacity: number;
    price_per_person: number | null;
    transport_type: string;
    bookings?: {
      seats: number;
      status: string;
    }[];
  }[];
}

interface ToursClientProps {
  initialTours: Tour[];
}

const ITEMS_PER_PAGE = 10;

const statLabel = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1';

export default function ToursClient({ initialTours }: ToursClientProps) {
  const [tours, setTours] = useState<Tour[]>(initialTours);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [selectedSchedulesTour, setSelectedSchedulesTour] = useState<Tour | null>(null);

  // Filter logic
  const filtered = tours.filter((tour) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = tour.title.toLowerCase();
    const location = tour.location.toLowerCase();
    const status = tour.status.toLowerCase();
    const orgName = (tour.organizer_profiles?.company_name || tour.organizer_profiles?.display_name || '').toLowerCase();

    return title.includes(q) || location.includes(q) || status.includes(q) || orgName.includes(q);
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <>
      <PageHeader
        title="Manage Tours"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Tours' }]}
      />

      <CardBox className="p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="card-title">All Tours</h5>
            <p className="text-sm text-muted-foreground">{filtered.length} tour{filtered.length === 1 ? '' : 's'}</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search tours"
              placeholder="Search tours, locations, organizers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-72 pl-10"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={MapIcon} title="No tours found matching your search." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((tour) => (
                <LazyMobileCard
                  key={tour.id}
                  onClick={() => setSelectedTour(tour)}
                  headerTitle={<div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">{tour.cover_image_url ? <img src={tour.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-3 h-3 text-muted-foreground" />}</div><span className="line-clamp-1">{tour.title}</span></div>}
                  headerSubtitle={tour.organizer_profiles?.company_name || tour.organizer_profiles?.display_name || 'Unknown Organizer'}
                  headerBadge={<StatusBadge status={tour.status} />}
                  rows={[
                    {
                      label: 'Location',
                      value: <div className="truncate max-w-[150px]">{tour.location}</div>
                    },
                    {
                      label: 'Duration',
                      value: `${tour.duration_days} day${tour.duration_days > 1 ? 's' : ''}`
                    },
                    {
                      label: 'Price (per pax)',
                      value: <span className="text-success font-semibold">₱{tour.price_per_person.toLocaleString()}</span>
                    },
                    {
                      label: 'Schedules',
                      value: (
                        <Button
                          type="button"
                          variant="lightprimary"
                          size="xs"
                          className="h-6 min-w-6 px-1.5"
                          aria-label={`View schedules (${tour.tour_schedules?.length || 0})`}
                          onClick={(e) => { e.stopPropagation(); setSelectedSchedulesTour(tour); }}
                        >
                          {tour.tour_schedules?.length || 0}
                        </Button>
                      )
                    }
                  ]}
                  actions={
                    <Button
                      type="button"
                      variant="lightprimary"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); setSelectedTour(tour); }}
                    >
                      View Details
                    </Button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">Tour Info</TableHead>
                    <TableHead className="px-6">Organizer</TableHead>
                    <TableHead className="px-6">Location</TableHead>
                    <TableHead className="px-6 text-center">Schedules</TableHead>
                    <TableHead className="px-6">Price (per pax)</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((tour) => (
                    <TableRow key={tour.id}>
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                            {tour.cover_image_url ? (
                              <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <h6 className="text-sm font-semibold text-foreground line-clamp-1">{tour.title}</h6>
                            <p className="text-muted-foreground text-xs font-medium mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" /> {tour.duration_days} day{tour.duration_days > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 font-medium">
                        {tour.organizer_profiles?.company_name || tour.organizer_profiles?.display_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="px-6 text-muted-foreground font-medium">
                        {tour.location}
                      </TableCell>
                      <TableCell className="px-6 text-center">
                        <Button
                          type="button"
                          variant="lightprimary"
                          size="xs"
                          className="h-6 min-w-6 px-1.5"
                          onClick={() => setSelectedSchedulesTour(tour)}
                          title="View Schedules"
                          aria-label={`View schedules (${tour.tour_schedules?.length || 0})`}
                        >
                          {tour.tour_schedules?.length || 0}
                        </Button>
                      </TableCell>
                      <TableCell className="px-6 font-semibold text-success">
                        ₱{tour.price_per_person.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={tour.status} />
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <Button type="button" variant="lightprimary" size="xs" onClick={() => setSelectedTour(tour)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="neutral" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                Previous
              </Button>
              <Button type="button" variant="neutral" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </CardBox>

      {/* Details Modal */}
      {selectedTour && (
        <Dialog open onOpenChange={(open) => { if (!open) setSelectedTour(null); }}>
          <DialogContent hideClose className="max-w-2xl p-0 gap-0">
            {/* Header Image */}
            <div className="h-48 w-full bg-muted relative shrink-0">
              {selectedTour.cover_image_url ? (
                <img src={selectedTour.cover_image_url} alt={selectedTour.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" aria-hidden="true" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <StatusBadge status={selectedTour.status} className="bg-white" />
                <button
                  type="button"
                  onClick={() => setSelectedTour(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-full bg-dark/60 text-white hover:bg-dark/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Header Info */}
              <DialogHeader className="pr-0">
                <DialogTitle className="text-2xl leading-tight">{selectedTour.title}</DialogTitle>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-bodytext">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Building className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    {selectedTour.organizer_profiles?.company_name || selectedTour.organizer_profiles?.display_name || 'Unknown Organizer'}
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    {selectedTour.location}
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    {selectedTour.duration_days} day{selectedTour.duration_days > 1 ? 's' : ''}
                  </div>
                </div>
              </DialogHeader>

              {/* Stats Grid */}
              <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-3 gap-4 border border-border">
                <div className="col-span-1 border-r border-border">
                  <span className={statLabel}>
                    <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Price per Pax
                  </span>
                  <div className="font-semibold text-success text-lg">₱{selectedTour.price_per_person.toLocaleString()}</div>
                </div>
                <div className="col-span-1 border-r border-border">
                  <span className={statLabel}>
                    <Users className="w-3.5 h-3.5" aria-hidden="true" /> Total Capacity
                  </span>
                  <div className="font-semibold text-foreground text-lg">
                    {selectedTour.tour_schedules?.reduce((sum, s) => sum + s.capacity, 0) || 0} <span className="text-xs text-muted-foreground font-medium">pax</span>
                  </div>
                </div>
                <div className="col-span-1">
                  <span className={statLabel}>
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Created On
                  </span>
                  <div className="font-medium text-foreground text-sm mt-1.5">{new Date(selectedTour.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Tour Description</h3>
                <div className="text-sm text-bodytext leading-relaxed whitespace-pre-wrap">
                  {selectedTour.description}
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="mt-0 px-6 py-4 border-t border-border bg-muted/50">
              <Button type="button" variant="neutral" onClick={() => setSelectedTour(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Schedules Modal */}
      {selectedSchedulesTour && (
        <Dialog open onOpenChange={(open) => { if (!open) setSelectedSchedulesTour(null); }}>
          <DialogContent className="max-w-4xl p-0 gap-0">
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Schedules for {selectedSchedulesTour.title}</DialogTitle>
            </DialogHeader>

            <div className="p-6">
              {selectedSchedulesTour.tour_schedules && selectedSchedulesTour.tour_schedules.length > 0 ? (
                <>
                  {/* Mobile View */}
                  <div className="block md:hidden space-y-4 pb-4">
                    {selectedSchedulesTour.tour_schedules.map((schedule) => {
                      const bookedSeats = (schedule.bookings || [])
                        .filter(b => b.status !== 'canceled' && b.status !== 'refunded')
                        .reduce((sum, b) => sum + b.seats, 0);
                      const availableSeats = schedule.capacity - bookedSeats;
                      return (
                        <LazyMobileCard
                          key={schedule.id}
                          rows={[
                            {
                              label: 'Dates',
                              value: (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                                  {new Date(schedule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(schedule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </div>
                              ),
                              fullWidth: true
                            },
                            {
                              label: 'Capacity',
                              value: (
                                <div>
                                  <div className="font-semibold text-foreground">{bookedSeats} <span className="text-sm font-medium text-muted-foreground">/ {schedule.capacity}</span></div>
                                  <Badge variant="lightSuccess" className="mt-0.5 px-1.5 py-0.5 text-[10px]">{availableSeats} left</Badge>
                                </div>
                              )
                            },
                            {
                              label: 'Price & Transport',
                              value: (
                                <div>
                                  <div className="font-semibold text-success mb-1">
                                    {schedule.price_per_person ? `₱${schedule.price_per_person.toLocaleString()}` : `₱${selectedSchedulesTour.price_per_person.toLocaleString()}`}
                                  </div>
                                  <StatusBadge status={schedule.transport_type} label={schedule.transport_type.replace('_', ' ')} className="text-[10px]" />
                                </div>
                              )
                            }
                          ]}
                          actions={
                            <Button asChild size="xs">
                              <Link href={`/admin/bookings?schedule_id=${schedule.id}`}>
                                Bookings <ArrowRight />
                              </Link>
                            </Button>
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:block border border-border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Dates</TableHead>
                          <TableHead className="text-center">Capacity</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Transport</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSchedulesTour.tour_schedules.map((schedule) => {
                          const bookedSeats = (schedule.bookings || [])
                            .filter(b => b.status !== 'canceled' && b.status !== 'refunded')
                            .reduce((sum, b) => sum + b.seats, 0);
                          const availableSeats = schedule.capacity - bookedSeats;

                          return (
                            <TableRow key={schedule.id}>
                              <TableCell className="py-4">
                                <div className="font-semibold text-foreground flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                  {new Date(schedule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 pl-6">
                                  to {new Date(schedule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-center">
                                <div className="font-semibold text-foreground text-base">{bookedSeats} <span className="text-sm font-medium text-muted-foreground">/ {schedule.capacity}</span></div>
                                <Badge variant="lightSuccess" className="mt-1 py-0.5">{availableSeats} left</Badge>
                              </TableCell>
                              <TableCell className="py-4 font-semibold text-success">
                                {schedule.price_per_person
                                  ? `₱${schedule.price_per_person.toLocaleString()}`
                                  : `₱${selectedSchedulesTour.price_per_person.toLocaleString()}`
                                }
                              </TableCell>
                              <TableCell className="py-4">
                                <StatusBadge status={schedule.transport_type} label={schedule.transport_type.replace('_', ' ')} />
                              </TableCell>
                              <TableCell className="py-4 text-right">
                                <Button asChild size="sm">
                                  <Link href={`/admin/bookings?schedule_id=${schedule.id}`}>
                                    Bookings <ArrowRight />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No active schedules found for this tour."
                  className="bg-muted/50 rounded-lg border border-dashed border-border"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
