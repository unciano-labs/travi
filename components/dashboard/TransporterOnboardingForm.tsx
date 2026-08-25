'use client';

import { useState } from 'react';
import { createTransporterProfile } from '@/actions/transporter';
import { useRouter } from 'next/navigation';

export default function TransporterOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    
    const res = await createTransporterProfile(formData);
    
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
            Transporter Type
          </label>
          <select 
            name="transporterType" 
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
            placeholder="e.g. Island Rides Inc."
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
            placeholder="What should organizers see?"
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
            Service Areas (comma separated)
          </label>
          <input 
            type="text" 
            name="serviceAreas"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="e.g. Cebu, Bohol, Palawan"
          />
        </div>



        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            About Your Fleet / Service
          </label>
          <textarea 
            name="description"
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none"
            placeholder="Tell us about the vehicles you offer..."
          />
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
