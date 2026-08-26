'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface ItineraryDay {
  id?: string;
  day_number: number;
  title: string;
  description: string;
}

export function ItineraryBuilder({ initialDays = [] }: { initialDays?: ItineraryDay[] }) {
  // If no initial days, start with Day 1
  const [days, setDays] = useState<ItineraryDay[]>(
    initialDays.length > 0 
      ? initialDays.sort((a, b) => a.day_number - b.day_number)
      : [{ day_number: 1, title: '', description: '' }]
  );

  const addDay = () => {
    setDays([...days, { day_number: days.length + 1, title: '', description: '' }]);
  };

  const removeDay = (indexToRemove: number) => {
    setDays(days.filter((_, i) => i !== indexToRemove).map((day, i) => ({
      ...day,
      day_number: i + 1 // Re-calculate day numbers
    })));
  };

  const updateDay = (index: number, field: keyof ItineraryDay, value: string) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
    setDays(newDays);
  };

  return (
    <div className="space-y-6">
      {/* Hidden input to pass data to Server Action */}
      <input type="hidden" name="itineraries" value={JSON.stringify(days)} />
      
      <div className="space-y-4">
        {days.map((day, index) => (
          <div key={day.day_number} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative group">
            <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center text-slate-300 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Optional: Add drag handle later if needed */}
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-slate-700">Day {day.day_number}</h4>
              {days.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDay(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="Remove Day"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={day.title}
                  onChange={(e) => updateDay(index, 'title', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white"
                  placeholder="e.g. Arrival & Island Tour"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={day.description}
                  onChange={(e) => updateDay(index, 'description', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white"
                  placeholder="Describe the activities for this day..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        className="flex items-center gap-2 text-sm font-medium text-brand-navy hover:text-brand-navy/80 bg-brand-navy/5 px-4 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-brand-navy/30 hover:border-brand-navy"
      >
        <Plus className="w-4 h-4" /> Add Another Day
      </button>
    </div>
  );
}
