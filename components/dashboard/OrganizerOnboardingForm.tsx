'use client';

import { useState } from 'react';
import { createOrganizerProfile } from '@/actions/organizer';
import { useRouter } from 'next/navigation';

export default function OrganizerOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    
    const res = await createOrganizerProfile(formData);
    
    setLoading(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Organizer Type
          </label>
          <select 
            name="organizerType" 
            required 
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white"
          >
            <option value="individual">Individual / Freelancer</option>
            <option value="company">Registered Company</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Company Name (Optional if Individual)
          </label>
          <input 
            type="text" 
            name="companyName"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="e.g. Island Hoppers Inc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Display Name
          </label>
          <input 
            type="text" 
            name="displayName"
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="What should travelers see?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Phone Number
          </label>
          <input 
            type="tel" 
            name="phone"
            required
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="+63 912 345 6789"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Business Address
          </label>
          <textarea 
            name="address"
            rows={2}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="Main office or operational base..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            About Your Business
          </label>
          <textarea 
            name="description"
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="Tell us about the kinds of tours you offer..."
          />
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input 
            type="checkbox" 
            id="providesTransport"
            name="providesTransport"
            className="w-5 h-5 text-coral rounded border-slate-300 focus:ring-coral"
          />
          <div>
            <label htmlFor="providesTransport" className="font-medium text-slate-900 block">
              We provide our own transportation
            </label>
            <p className="text-sm text-slate-500">
              Check this if you have your own vehicles (vans, boats, etc.) and don't need to hire external transporters.
            </p>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
