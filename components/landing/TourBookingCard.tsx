'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar as CalendarIcon, Users } from 'lucide-react';
import Link from 'next/link';

export default function TourBookingCard({ tour }: { tour: any }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Filter active schedules
  const activeSchedules = tour.schedules
    ?.filter((s: any) => s.status === 'open' && new Date(s.start_date) > new Date())
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

  return (
    <div className="sticky top-24 bg-white p-6 lg:p-8 rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50">
      {/* Price Header */}
      <div className="mb-6">
        <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Price per person</span>
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
                  <Users className="w-3.5 h-3.5" />
                  {selectedSchedule.capacity - (selectedSchedule.booked_count || 0)} slots remaining
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
                    const isLowCapacity = remaining <= 3;
                    
                    return (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => {
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
                            {isLowCapacity && '🔥 Only '}
                            {remaining} slots left
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
      </div>

      <button 
        disabled={!selectedSchedule || (selectedSchedule.capacity - (selectedSchedule.booked_count || 0)) <= 0}
        className="w-full py-4 px-6 bg-coral hover:bg-coral-dark text-white text-center font-extrabold text-lg rounded-xl transition-all shadow-lg shadow-coral/30 hover:shadow-xl hover:shadow-coral/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
      >
        {!selectedSchedule 
          ? 'Select a date' 
          : (selectedSchedule.capacity - (selectedSchedule.booked_count || 0)) <= 0 
            ? 'Sold Out' 
            : 'Book This Tour'}
      </button>
      <p className="text-center text-xs text-slate-400 mt-4 font-medium flex items-center justify-center gap-1">
        🔒 You won't be charged yet
      </p>
    </div>
  );
}

// Ensure Check is imported for the checkmark
import { Check } from 'lucide-react';
