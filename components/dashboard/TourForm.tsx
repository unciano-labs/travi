'use client';

import { useState } from 'react';
import { createTour } from '@/actions/tours';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TourForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    
    const res = await createTour(formData);
    
    setLoading(false);
    
    if (res?.error) {
      setError(res.error);
    }
    // if successful, createTour will redirect
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/organizer/tours" className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-lg border border-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Tour</h1>
          <p className="text-slate-600">Draft a new tour package for travelers to book.</p>
        </div>
      </div>

      <form action={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">1. Basic Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tour Title</label>
              <input type="text" name="title" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. Ultimate El Nido Island Hopping" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" name="location" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. El Nido, Palawan" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea name="description" required rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Describe what makes this tour special..." />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">2. Pricing & Capacity</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price per Person (₱)</label>
              <input type="number" name="pricePerPerson" required min="1" step="0.01" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="1500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
              <input type="number" name="durationDays" required min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Capacity (Pax)</label>
              <input type="number" name="capacity" required min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="12" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">3. Schedule</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" name="startDate" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" name="endDate" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">4. Logistics</h2>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Transport Requirement</label>
              <select name="transportType" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white">
                <option value="none">No transport needed (Meet at location)</option>
                <option value="self_provided">I will provide the transport</option>
                <option value="external_transporter">I need an external Transporter</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Accommodation Details (Optional)</label>
              <input type="text" name="accommodationDetails" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. 3-star hotel included" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Travel Time Info (Optional)</label>
              <input type="text" name="travelTimeInfo" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. 2 hours boat ride" />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 flex justify-end gap-3">
          <Link href="/dashboard/organizer/tours" className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="bg-coral hover:bg-coral/90 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
