'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Users, Check, Minus, Plus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBooking } from '@/actions/bookings';

export default function TourBookingCard({ tour }: { tour: any }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [seats, setSeats] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Decision D3: a private tour books the whole group (seats = capacity, price per person x capacity),
  // so a private date is only available while nobody holds it. The server enforces the same rules.
  const isPrivate = tour.format === 'private';
  const isAvailable = (s: { capacity: number; booked_count: number | null }) => isPrivate ? (s.booked_count || 0) === 0 : (s.capacity - (s.booked_count || 0)) > 0;

  // Filter active schedules that have available capacity
  const activeSchedules = tour.schedules
    ?.filter((s: any) => s.status === 'open' && new Date(s.start_date) > new Date() && isAvailable(s))
    .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()) || [];

  const [selectedSchedule, setSelectedSchedule] = useState<any>(activeSchedules[0] || null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current price to display
  const displayPrice = selectedSchedule?.price_per_person || tour.price_per_person;
  const originalPrice = selectedSchedule?.original_price;
  
  const remainingSlots = selectedSchedule ? (selectedSchedule.capacity - (selectedSchedule.booked_count || 0)) : 0;
  const groupSize = selectedSchedule?.capacity || 0;
  const bookedSeats = isPrivate ? groupSize : seats;
  const totalPrice = displayPrice * bookedSeats;

  const handleBook = async () => {
    if (!selectedSchedule) return;
    
    setIsBooking(true);
    setErrorMsg('');
    
    const result = await createBooking(selectedSchedule.id, bookedSeats);
    
    if (result.success && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else {
      setIsBooking(false);
      if (result.code === 'unauthorized') {
        // Come back to this tour after signing in (BIZ-15).
        router.push(`/login?next=${encodeURIComponent(`/tours/${tour.slug}`)}`);
      } else {
        setErrorMsg(result.error || 'Failed to book the tour.');
      }
    }
  };

  return (
    <div className="sticky top-24 bg-white p-6 lg:p-8 rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50">
      {/* Price Header */}
      <div className="mb-6">
        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">
          {isPrivate ? 'Private group · price per person' : 'Price per person'}
        </span>
        <div className="flex items-end gap-2 mt-2">
          <span className="text-4xl font-extrabold text-slate-900 font-display">₱{displayPrice.toLocaleString()}</span>
          {originalPrice && originalPrice > displayPrice && (
             <span className="text-lg text-slate-400 line-through mb-1">₱{originalPrice.toLocaleString()}</span>
          )}
        </div>
      </div>
      
      <hr className="border-slate-100 mb-6" />

      <div className="space-y-6 mb-8">
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
          <span className="text-sm font-medium text-slate-500">Organizer</span>
          <span className="font-bold text-slate-900">{tour.organizer?.company_name || tour.organizer?.display_name || 'Local Guide'}</span>
        </div>
        
        {/* Custom Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-sm font-bold text-slate-900 mb-2">Select Schedule</label>
          
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all duration-200 ${isOpen ? 'border-coral ring-4 ring-coral/10 bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
          >
            {selectedSchedule ? (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 text-base">
                  {new Date(selectedSchedule.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(selectedSchedule.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="text-sm text-emerald-600 font-medium flex items-center gap-1 mt-1">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" />
                  {isPrivate ? `Private group of up to ${groupSize}` : `${remainingSlots} slots remaining`}
                </span>
              </div>
            ) : (
              <span className="text-slate-500 font-medium">Choose a schedule...</span>
            )}
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-coral' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                {activeSchedules.length > 0 ? (
                  activeSchedules.map((schedule: any) => {
                    const remaining = schedule.capacity - (schedule.booked_count || 0);
                    const isSelected = selectedSchedule?.id === schedule.id;
                    const isLowCapacity = !isPrivate && remaining <= 3;
                    
                    return (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => {
                          const rem = schedule.capacity - (schedule.booked_count || 0);
                          if (seats > rem) {
                            setSeats(rem > 0 ? rem : 1);
                          }
                          setSelectedSchedule(schedule);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${isSelected ? 'bg-coral/10 border border-coral/20' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`font-bold ${isSelected ? 'text-coral' : 'text-slate-900'}`}>
                            {new Date(schedule.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(schedule.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className={`text-xs font-medium mt-1 flex items-center gap-1 ${isLowCapacity ? 'text-coral' : 'text-slate-500'}`}>
                            {isPrivate ? `Private group of up to ${schedule.capacity}` : <>{isLowCapacity && '🔥 Only '}{remaining} slots left</>}
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-coral" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No open schedules available.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Private tours: the whole group, no seat picker */}
        {isPrivate && selectedSchedule && (
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
            <Users className="w-5 h-5 text-coral mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-sm text-slate-700">
              <span className="font-bold text-slate-900">Private group — up to {groupSize} guests, ₱{totalPrice.toLocaleString()} total.</span>{' '}
              The whole date is reserved for your group.
            </p>
          </div>
        )}

        {/* Seats Selector */}
        {!isPrivate && selectedSchedule && remainingSlots > 0 && (
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Number of Seats</label>
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border-2 border-slate-200">
              <button 
                type="button"
                aria-label="Remove a seat"
                onClick={() => setSeats(Math.max(1, seats - 1))}
                disabled={seats <= 1}
                className="p-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Minus className="w-5 h-5 text-slate-600" />
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-slate-900">{seats}</span>
                <span className="text-xs text-slate-500 font-medium">Guest{seats > 1 ? 's' : ''}</span>
              </div>
              
              <button 
                type="button"
                aria-label="Add a seat"
                onClick={() => setSeats(Math.min(remainingSlots, seats + 1))}
                disabled={seats >= remainingSlots}
                className="p-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total & Action */}
      {selectedSchedule && remainingSlots > 0 && (
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
          <span className="text-slate-900 font-bold text-lg">{isPrivate ? `Total for up to ${groupSize} guests` : 'Total'}</span>
          <span className="text-2xl font-extrabold text-slate-900">₱{totalPrice.toLocaleString()}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100">
          {errorMsg}
        </div>
      )}

      <button 
        onClick={handleBook}
        disabled={!selectedSchedule || remainingSlots <= 0 || isBooking}
        className="w-full py-4 px-6 bg-coral hover:bg-coral-dark text-white text-center font-extrabold text-lg rounded-xl transition-all duration-300 shadow-lg shadow-coral/30 hover:shadow-xl hover:shadow-coral/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 group relative overflow-hidden"
      >
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 ease-in-out"></div>
        <span className="relative flex items-center gap-2">
        {isBooking ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : activeSchedules.length === 0 ? (
          'Sold Out'
        ) : !selectedSchedule ? (
          'Select a date' 
        ) : remainingSlots <= 0 ? (
          'Sold Out' 
        ) : isPrivate ? (
          'Book Private Tour'
        ) : (
          'Book This Tour'
        )}
        </span>
      </button>
      <p className="text-center text-xs text-slate-400 mt-4 font-medium flex items-center justify-center gap-1">
        🔒 Secure payment via PayMongo
      </p>
    </div>
  );
}
