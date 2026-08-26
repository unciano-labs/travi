'use client';

import { useState, useRef } from 'react';
import { createSchedule, updateSchedule, deleteSchedule } from '@/actions/schedules';
import { Plus, Edit2, X, Trash2 } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function ScheduleForm({ tourId, basePrice, initialData }: { tourId: string, basePrice?: number, initialData?: any }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  
  const [range, setRange] = useState<DateRange | undefined>(
    initialData ? { 
      from: parseISO(initialData.start_date), 
      to: parseISO(initialData.end_date) 
    } : undefined
  );
  
  const isEdit = !!initialData;
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    if (!range?.from || !range?.to) {
      setError("Please select a complete date range.");
      return;
    }
    
    setError(null);
    setLoading(true);
    
    // Override dates with the range picker
    formData.set('startDate', format(range.from, 'yyyy-MM-dd'));
    formData.set('endDate', format(range.to, 'yyyy-MM-dd'));
    
    let res;
    if (isEdit) {
      res = await updateSchedule(initialData.id, tourId, formData);
    } else {
      res = await createSchedule(tourId, formData);
    }
    
    if (res?.error) {
      setError(res.error);
    } else {
      // success
      if (isEdit) {
        // Clear edit state by removing search param
        router.push(`?tab=schedules`);
      } else {
        formRef.current?.reset();
        setRange(undefined);
      }
    }
    
    setLoading(false);
  }

  const cancelEdit = () => {
    router.push(`?tab=schedules`);
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setError(null);
    setShowDeleteModal(false);
    
    const res = await deleteSchedule(initialData.id, tourId);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push(`?tab=schedules`);
    }
  };

  const promptDelete = () => {
    setShowDeleteModal(true);
  };

  return (
    <>
    <form ref={formRef} action={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {isEdit ? <Edit2 className="w-5 h-5 text-coral-600" /> : <Plus className="w-5 h-5 text-coral-600" />} 
          {isEdit ? 'Edit Schedule' : 'Add New Schedule'}
        </h2>
        {isEdit && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={promptDelete} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-medium">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col items-center">
        <label className="block text-sm font-medium text-slate-700 mb-2 w-full text-left">
          Date Range
          {range?.from && (
            <span className="ml-2 font-normal text-slate-500">
              ({format(range.from, 'MMM d, yyyy')} {range.to ? `- ${format(range.to, 'MMM d, yyyy')}` : ''})
            </span>
          )}
        </label>
        <DayPicker
          mode="range"
          defaultMonth={range?.from || new Date()}
          selected={range}
          onSelect={setRange}
          modifiersClassNames={{
            selected: 'bg-coral text-white',
            range_middle: 'bg-coral/10 text-coral',
            range_start: 'bg-coral text-white rounded-l-md',
            range_end: 'bg-coral text-white rounded-r-md'
          }}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
          <input type="number" name="capacity" required min="1" defaultValue={initialData?.capacity || ''} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Seats e.g. 12" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Original Price (₱)</label>
          <input type="number" step="0.01" name="original_price" min="0" defaultValue={initialData?.original_price || ''} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Compare-at price" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₱)</label>
          <input type="number" step="0.01" name="price_per_person" min="0" defaultValue={initialData?.price_per_person || ''} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder={basePrice ? `Default: ₱${basePrice}` : "Optional override"} />
        </div>
      </div>
      
      <button 
        type="submit" 
        disabled={loading || !range?.from || !range?.to}
        className="w-full bg-coral hover:bg-coral-dark text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70"
      >
        {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Schedule' : 'Add Schedule')}
      </button>
    </form>
    
    <ConfirmModal 
      isOpen={showDeleteModal}
      title="Delete Schedule"
      message="Are you sure you want to delete this schedule? This action cannot be undone and any travelers who booked might be affected."
      confirmText="Yes, Delete it"
      cancelText="Cancel"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setShowDeleteModal(false)}
      isDestructive={true}
    />
    </>
  );
}
