'use client';

import { useState } from 'react';
import { Search, MapPin, Clock, DollarSign, Calendar, X, Building, Image as ImageIcon, ArrowRight, Users } from 'lucide-react';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Manage Tours</h1>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search tours, locations, organizers..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-72 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">
            No tours found matching your search.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {paginated.map((tour) => (
                <LazyMobileCard
                  key={tour.id}
                  onClick={() => setSelectedTour(tour)}
                  headerTitle={<div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">{tour.cover_image_url ? <img src={tour.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-3 h-3 text-slate-400" />}</div><span className="line-clamp-1">{tour.title}</span></div>}
                  headerSubtitle={tour.organizer_profiles?.company_name || tour.organizer_profiles?.display_name || 'Unknown Organizer'}
                  headerBadge={
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                      tour.status === 'published' ? 'bg-sky-100 text-sky-800' : 
                      tour.status === 'archived' ? 'bg-slate-100 text-slate-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {tour.status}
                    </span>
                  }
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
                      value: <span className="text-emerald-600 font-bold">₱{tour.price_per_person.toLocaleString()}</span>
                    },
                    {
                      label: 'Schedules',
                      value: (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedSchedulesTour(tour); }}
                          className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-bold hover:bg-brand hover:text-white transition-colors"
                        >
                          {tour.tour_schedules?.length || 0}
                        </button>
                      )
                    }
                  ]}
                  actions={
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedTour(tour); }}
                      className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                    >
                      View Details
                    </button>
                  }
                />
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Tour Info</th>
                  <th className="px-6 py-4">Organizer</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-center">Schedules</th>
                  <th className="px-6 py-4">Price (per pax)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((tour) => (
                  <tr key={tour.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                          {tour.cover_image_url ? (
                            <img src={tour.cover_image_url} alt={tour.title} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 line-clamp-1">{tour.title}</div>
                          <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {tour.duration_days} day{tour.duration_days > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">
                        {tour.organizer_profiles?.company_name || tour.organizer_profiles?.display_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {tour.location}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setSelectedSchedulesTour(tour)}
                        className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-bold hover:bg-brand hover:text-white transition-colors"
                        title="View Schedules"
                      >
                        {tour.tour_schedules?.length || 0}
                      </button>
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-600">
                      ₱{tour.price_per_person.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        tour.status === 'published' ? 'bg-sky-100 text-sky-800' : 
                        tour.status === 'archived' ? 'bg-slate-100 text-slate-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {tour.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedTour(tour)}
                        className="text-xs font-bold text-brand hover:text-brand-dark hover:underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Image */}
            <div className="h-48 w-full bg-slate-100 relative">
              {selectedTour.cover_image_url ? (
                <img src={selectedTour.cover_image_url} alt={selectedTour.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-slate-300" />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm ${
                  selectedTour.status === 'published' ? 'bg-sky-500 text-white' : 
                  selectedTour.status === 'archived' ? 'bg-slate-600 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                  {selectedTour.status}
                </span>
                <button 
                  onClick={() => setSelectedTour(null)} 
                  className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Header Info */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedTour.title}</h2>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Building className="w-4 h-4 text-slate-400" /> 
                    {selectedTour.organizer_profiles?.company_name || selectedTour.organizer_profiles?.display_name || 'Unknown Organizer'}
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-slate-400" /> 
                    {selectedTour.location}
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-slate-400" /> 
                    {selectedTour.duration_days} day{selectedTour.duration_days > 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4 border border-slate-100">
                <div className="col-span-1 border-r border-slate-200">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5" /> Price per Pax
                  </span>
                  <div className="font-bold text-emerald-600 text-lg">₱{selectedTour.price_per_person.toLocaleString()}</div>
                </div>
                <div className="col-span-1 border-r border-slate-200">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" /> Total Capacity
                  </span>
                  <div className="font-bold text-slate-900 text-lg">
                    {selectedTour.tour_schedules?.reduce((sum, s) => sum + s.capacity, 0) || 0} <span className="text-xs text-slate-500 font-medium">pax</span>
                  </div>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5" /> Created On
                  </span>
                  <div className="font-medium text-slate-900 text-sm mt-1.5">{new Date(selectedTour.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Tour Description</h3>
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {selectedTour.description}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedTour(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedules Modal */}
      {selectedSchedulesTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Schedules for {selectedSchedulesTour.title}</h2>
              </div>
              <button onClick={() => setSelectedSchedulesTour(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[75vh] overflow-y-auto">
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
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                      {new Date(schedule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(schedule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </div>
                                  </div>
                                ),
                                fullWidth: true
                              },
                              {
                                label: 'Capacity',
                                value: (
                                  <div>
                                    <div className="font-bold text-slate-900">{bookedSeats} <span className="text-sm font-medium text-slate-400">/ {schedule.capacity}</span></div>
                                    <div className="text-[10px] font-medium text-emerald-600 bg-emerald-50 inline-block px-1.5 py-0.5 rounded-full mt-0.5">{availableSeats} left</div>
                                  </div>
                                )
                              },
                              {
                                label: 'Price & Transport',
                                value: (
                                  <div>
                                    <div className="font-bold text-emerald-600 mb-1">
                                      {schedule.price_per_person ? `₱${schedule.price_per_person.toLocaleString()}` : `₱${selectedSchedulesTour.price_per_person.toLocaleString()}`}
                                    </div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                                      {schedule.transport_type.replace('_', ' ')}
                                    </span>
                                  </div>
                                )
                              }
                            ]}
                            actions={
                              <Link 
                                href={`/admin/bookings?schedule_id=${schedule.id}`}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-white transition-colors px-3 py-1.5 rounded bg-brand hover:bg-brand-dark shadow-sm"
                              >
                                Bookings <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            }
                          />
                        );
                      })}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Dates</th>
                          <th className="px-4 py-3 font-semibold text-center">Capacity</th>
                          <th className="px-4 py-3 font-semibold">Price</th>
                          <th className="px-4 py-3 font-semibold">Transport</th>
                          <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSchedulesTour.tour_schedules.map((schedule) => {
                          const bookedSeats = (schedule.bookings || [])
                            .filter(b => b.status !== 'canceled' && b.status !== 'refunded')
                            .reduce((sum, b) => sum + b.seats, 0);
                          const availableSeats = schedule.capacity - bookedSeats;
                          
                          return (
                          <tr key={schedule.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {new Date(schedule.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 pl-6">
                                to {new Date(schedule.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="font-bold text-slate-900 text-base">{bookedSeats} <span className="text-sm font-medium text-slate-400">/ {schedule.capacity}</span></div>
                              <div className="text-xs font-medium text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded-full mt-1">
                                {availableSeats} left
                              </div>
                            </td>
                            <td className="px-4 py-4 font-bold text-emerald-600">
                              {schedule.price_per_person 
                                ? `₱${schedule.price_per_person.toLocaleString()}` 
                                : `₱${selectedSchedulesTour.price_per_person.toLocaleString()}`
                              }
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 capitalize">
                                {schedule.transport_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <Link 
                                href={`/admin/bookings?schedule_id=${schedule.id}`}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-white transition-colors px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark shadow-sm"
                              >
                                Bookings <ArrowRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                  </>
                ) : (
                  <div className="p-12 bg-slate-50 text-slate-500 rounded-xl border border-dashed border-slate-300 text-center flex flex-col items-center">
                    <Calendar className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="font-medium">No active schedules found for this tour.</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
