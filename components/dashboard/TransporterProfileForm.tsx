'use client';

import { useState } from 'react';

type TransporterProfile = {
  id: string;
  transporter_type: string;
  company_name: string | null;
  display_name: string;
  description: string | null;
  phone: string;
  service_areas: string[] | null;
  status: string;
  average_rating: number;
  review_count: number;
  user_profiles: {
    email: string;
  } | { email: string; }[] | null;
};

export default function TransporterProfileForm({ profile }: { profile: TransporterProfile }) {
  const [loading, setLoading] = useState(false);
  
  // Handle edge cases if relation returned array
  const userProfile = Array.isArray(profile.user_profiles) 
    ? profile.user_profiles[0] 
    : profile.user_profiles;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement save profile action
    setTimeout(() => setLoading(false), 1000);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h2 className="text-lg font-medium text-slate-800">Business Details</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-amber-500">★</span>
            <span className="font-semibold text-slate-700">{profile.average_rating.toFixed(1)}</span>
            <span className="text-slate-400">({profile.review_count})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-500">Status:</span>
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
              profile.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
              profile.status === 'pending' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {profile.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Company / Legal Name</label>
          <input 
            type="text" 
            name="companyName"
            defaultValue={profile.company_name || ''}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
          <input 
            type="text" 
            name="displayName"
            defaultValue={profile.display_name}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Transporter Type</label>
          <select
            name="transporterType"
            defaultValue={profile.transporter_type}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white appearance-none"
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Business Description</label>
        <textarea 
          name="description"
          rows={3}
          defaultValue={profile.description || ''}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Service Areas</label>
        <input 
          type="text" 
          name="serviceAreas"
          defaultValue={(profile.service_areas || []).join(', ')}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
        />
        <p className="mt-1 text-xs text-slate-500">Comma separated areas where you can provide transport.</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
          <input 
            type="email" 
            defaultValue={userProfile?.email || ''}
            disabled
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contact Phone</label>
          <input 
            type="tel" 
            name="phone"
            defaultValue={profile.phone}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral bg-white"
          />
        </div>
      </div>
      
      <div className="pt-4 border-t border-slate-100">
        <button 
          type="submit"
          disabled={loading}
          className="bg-coral text-white px-5 py-2.5 rounded-lg font-medium hover:bg-coral/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
