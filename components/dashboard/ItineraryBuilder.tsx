'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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
          <div key={day.day_number} className="p-4 border border-border rounded-lg bg-muted/50 relative group">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-foreground">Day {day.day_number}</h4>
              {days.length > 1 && (
                <Button
                  type="button"
                  variant="ghosterror"
                  size="iconsm"
                  onClick={() => removeDay(index)}
                  title="Remove Day"
                  aria-label={`Remove Day ${day.day_number}`}
                >
                  <Trash2 />
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`itinerary-title-${index}`} className="text-xs text-muted-foreground">Title</Label>
                <Input
                  id={`itinerary-title-${index}`}
                  type="text"
                  required
                  value={day.title}
                  onChange={(e) => updateDay(index, 'title', e.target.value)}
                  className="bg-white"
                  placeholder="e.g. Arrival & Island Tour"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`itinerary-description-${index}`} className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  id={`itinerary-description-${index}`}
                  required
                  rows={3}
                  value={day.description}
                  onChange={(e) => updateDay(index, 'description', e.target.value)}
                  className="bg-white"
                  placeholder="Describe the activities for this day..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="lightprimary"
        onClick={addDay}
        className="w-full border border-dashed border-primary/40"
      >
        <Plus /> Add Another Day
      </Button>
    </div>
  );
}
